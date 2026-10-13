<?php

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function makePhaseTwoProductUser(string $role, string $email, array $permissions = []): User
{
    $user = User::create([
        'name' => ucfirst($role).' '.str_replace('@example.test', '', $email),
        'student_id' => $role === 'student' ? strtoupper(str_replace('@example.test', '', $email)) : null,
        'email' => $email,
        'password' => 'password123',
        'role' => $role,
        'status' => 'active',
    ]);

    if ($role === 'staff') {
        $user->staffProfile()->create([
            'permissions' => $permissions,
            'is_admin_created' => true,
            'reviewed_at' => now(),
        ]);
    }

    return $user;
}

function makePhaseTwoPendingProduct(User $owner, array $overrides = []): Product
{
    return Product::create(array_merge([
        'user_id' => $owner->id,
        'name' => 'TMC textbook',
        'description' => 'A used textbook in good condition.',
        'price' => 250,
        'category' => 'Books',
        'status' => 'pending',
    ], $overrides));
}

test('authorized staff can filter pending products and approval creates an audit event', function () {
    $staff = makePhaseTwoProductUser('staff', 'moderator@example.test', ['moderate_products']);
    $seller = makePhaseTwoProductUser('student', 'seller@example.test');
    $matching = makePhaseTwoPendingProduct($seller);
    makePhaseTwoPendingProduct($seller, ['name' => 'Calculator', 'category' => 'Supplies']);
    Sanctum::actingAs($staff);

    $this->getJson('/api/staff/products?status=pending&category=Book&seller=seller@example.test&date_from=2000-01-01&date_to=2099-12-31')
        ->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('products.0.id', $matching->id);

    $this->putJson('/api/staff/products/'.$matching->id.'/approve')
        ->assertOk()
        ->assertJsonPath('product.status', 'active')
        ->assertJsonPath('product.moderation_events.0.actor.name', $staff->name)
        ->assertJsonPath('product.moderation_events.0.from_status', 'pending')
        ->assertJsonPath('product.moderation_events.0.to_status', 'active');

    $this->assertDatabaseHas('product_moderation_events', [
        'product_id' => $matching->id,
        'actor_id' => $staff->id,
        'from_status' => 'pending',
        'to_status' => 'active',
        'reason' => null,
    ]);
});

test('an administrator can grant and remove the product moderation permission', function () {
    $admin = makePhaseTwoProductUser('admin', 'permission-admin@example.test');
    Sanctum::actingAs($admin);

    $response = $this->postJson('/api/admin/staff', [
        'name' => 'Product Moderator',
        'email' => 'product-moderator@example.test',
        'password' => 'moderator-password-123',
        'password_confirmation' => 'moderator-password-123',
        'permissions' => ['moderate_products'],
    ])->assertCreated()
        ->assertJsonPath('staff.staff_permissions.0', 'moderate_products');

    $staffId = $response->json('staff.id');
    $this->putJson('/api/admin/staff/'.$staffId, ['permissions' => []])
        ->assertOk()
        ->assertJsonPath('staff.staff_permissions', []);
    $this->assertDatabaseHas('staff_profiles', [
        'user_id' => $staffId,
        'permissions' => '[]',
    ]);
});

test('rejection requires a reason and the seller can see their rejection feedback', function () {
    $staff = makePhaseTwoProductUser('staff', 'rejector@example.test', ['moderate_products']);
    $seller = makePhaseTwoProductUser('student', 'owner@example.test');
    $product = makePhaseTwoPendingProduct($seller);
    Sanctum::actingAs($staff);

    $this->putJson('/api/staff/products/'.$product->id.'/reject', [])->assertUnprocessable();
    $this->putJson('/api/staff/products/'.$product->id.'/reject', ['reason' => '  Please add clearer product photos.  '])
        ->assertOk()
        ->assertJsonPath('product.status', 'rejected')
        ->assertJsonPath('product.moderation_events.0.reason', 'Please add clearer product photos.');

    Sanctum::actingAs($seller->fresh());
    $this->getJson('/api/my-products')
        ->assertOk()
        ->assertJsonPath('products.0.rejection_reason', 'Please add clearer product photos.');
    $this->getJson('/api/products/'.$product->id)
        ->assertOk()
        ->assertJsonPath('product.rejection_reason', 'Please add clearer product photos.');
});

test('staff moderation requires active staff and the explicit permission while admin access remains available', function () {
    $seller = makePhaseTwoProductUser('student', 'second-seller@example.test');
    $product = makePhaseTwoPendingProduct($seller);
    $noPermission = makePhaseTwoProductUser('staff', 'no-permission@example.test', []);
    $inactive = makePhaseTwoProductUser('staff', 'inactive-moderator@example.test', ['moderate_products']);
    $inactive->update(['status' => 'inactive']);
    $student = makePhaseTwoProductUser('student', 'student-access@example.test');
    $admin = makePhaseTwoProductUser('admin', 'admin-access@example.test');

    foreach ([$noPermission, $inactive, $student] as $user) {
        Sanctum::actingAs($user);
        $this->getJson('/api/staff/products')->assertForbidden();
        $this->putJson('/api/staff/products/'.$product->id.'/approve')->assertForbidden();
    }

    Sanctum::actingAs($noPermission);
    $this->getJson('/api/admin/products')->assertForbidden();

    Sanctum::actingAs($admin);
    $this->getJson('/api/admin/products')->assertOk();
    $this->putJson('/api/admin/products/'.$product->id.'/approve')
        ->assertOk()
        ->assertJsonPath('product.status', 'active');
});

test('a moderator cannot review their own product and cannot decide a product twice', function () {
    $staff = makePhaseTwoProductUser('staff', 'owner-moderator@example.test', ['moderate_products']);
    $ownProduct = makePhaseTwoPendingProduct($staff);
    $otherSeller = makePhaseTwoProductUser('student', 'other-seller@example.test');
    $product = makePhaseTwoPendingProduct($otherSeller);
    Sanctum::actingAs($staff);

    $this->putJson('/api/staff/products/'.$ownProduct->id.'/approve')->assertForbidden();
    $this->putJson('/api/staff/products/'.$product->id.'/approve')->assertOk();
    $this->putJson('/api/staff/products/'.$product->id.'/reject', ['reason' => 'No longer pending.'])
        ->assertStatus(409);

    $this->assertDatabaseCount('product_moderation_events', 1);
    $this->assertDatabaseHas('products', ['id' => $product->id, 'status' => 'active']);
});

test('authorized Staff can warn without changing listing status and the seller receives warning history and notice', function () {
    $staff = makePhaseTwoProductUser('staff', 'warning-moderator@example.test', ['moderate_products']);
    $seller = makePhaseTwoProductUser('student', 'warning-seller@example.test');
    $product = makePhaseTwoPendingProduct($seller, ['status' => 'active']);
    Sanctum::actingAs($staff);

    $this->postJson('/api/staff/products/'.$product->id.'/warn', ['reason' => 'Please clarify the item condition.'])
        ->assertOk()
        ->assertJsonPath('product.status', 'active')
        ->assertJsonPath('message', 'Warning recorded and sent to the seller. The listing remains active.');

    $this->assertDatabaseHas('product_warnings', [
        'product_id' => $product->id,
        'actor_id' => $staff->id,
        'reason' => 'Please clarify the item condition.',
    ]);
    $this->assertDatabaseHas('notifications', [
        'notifiable_id' => $seller->id,
        'type' => \App\Notifications\ProductModerationNotification::class,
    ]);
    $this->assertDatabaseHas('products', ['id' => $product->id, 'status' => 'active']);

    Sanctum::actingAs($seller);
    $this->getJson('/api/my-products')
        ->assertOk()
        ->assertJsonPath('products.0.warnings.0.reason', 'Please clarify the item condition.');
});

test('only Admin can suspend an active listing and suspension is recorded and removed from marketplace results', function () {
    $staff = makePhaseTwoProductUser('staff', 'suspension-moderator@example.test', ['moderate_products']);
    $admin = makePhaseTwoProductUser('admin', 'suspension-admin@example.test');
    $seller = makePhaseTwoProductUser('student', 'suspension-seller@example.test');
    $product = makePhaseTwoPendingProduct($seller, ['status' => 'active']);

    Sanctum::actingAs($staff);
    $this->putJson('/api/admin/products/'.$product->id.'/suspend', ['reason' => 'Listing requires an urgent safety review.'])
        ->assertForbidden();
    $this->putJson('/api/staff/products/'.$product->id.'/suspend', ['reason' => 'Listing requires an urgent safety review.'])
        ->assertNotFound();
    $this->assertDatabaseHas('products', ['id' => $product->id, 'status' => 'active']);

    Sanctum::actingAs($admin);
    $this->putJson('/api/admin/products/'.$product->id.'/suspend', ['reason' => 'Listing requires an urgent safety review.'])
        ->assertOk()
        ->assertJsonPath('product.status', 'suspended');
    $this->assertDatabaseHas('product_moderation_events', [
        'product_id' => $product->id,
        'actor_id' => $admin->id,
        'from_status' => 'active',
        'to_status' => 'suspended',
        'reason' => 'Listing requires an urgent safety review.',
    ]);
    $this->assertDatabaseHas('notifications', [
        'notifiable_id' => $seller->id,
        'type' => \App\Notifications\ProductModerationNotification::class,
    ]);
    Sanctum::actingAs($seller);
    $this->getJson('/api/products')->assertOk()->assertJsonMissing(['id' => $product->id]);
    Sanctum::actingAs($admin);
    $this->putJson('/api/admin/products/'.$product->id.'/suspend', ['reason' => 'Repeated suspension attempt.'])
        ->assertStatus(409);
});
