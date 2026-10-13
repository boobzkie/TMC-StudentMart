<?php

use App\Models\Product;
use App\Models\ProductImage;
use App\Models\OrderPaymentMethod;
use App\Models\PickupLocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function postStockLifecycleOrder($test, array $payload)
{
    $paymentMethod = OrderPaymentMethod::query()->firstOrCreate(
        ['name' => 'Stock test manual payment'],
        ['instructions' => 'Pay in person.', 'is_active' => true, 'sort_order' => 0],
    );
    $pickupLocation = PickupLocation::query()->firstOrCreate(
        ['name' => 'Stock test pickup point'],
        ['campus_area' => 'Test area', 'is_active' => true, 'sort_order' => 0],
    );

    return $test->postJson('/api/orders', array_merge([
        'payment_method_id' => $paymentMethod->id,
        'pickup_location_id' => $pickupLocation->id,
    ], $payload));
}

function makeStockLifecycleUser(string $role, string $suffix): User
{
    return User::create([
        'name' => ucfirst($role).' '.$suffix,
        'student_id' => $role === 'student' ? 'STK-'.$suffix : null,
        'email' => strtolower($role.'-'.$suffix).'@example.test',
        'password' => 'password123',
        'role' => $role,
        'status' => 'active',
    ]);
}

function makeStockLifecycleProduct(User $seller, array $overrides = []): Product
{
    return Product::create(array_merge([
        'user_id' => $seller->id,
        'name' => 'Stocked textbook',
        'description' => 'Product stock test listing.',
        'price' => '100.00',
        'category' => 'Books',
        'status' => 'active',
        'stock_quantity' => 1,
    ], $overrides));
}

test('checkout reserves exact stock and exposes a sold-out listing for one hour', function () {
    $buyer = makeStockLifecycleUser('student', 'buyer-soldout');
    $seller = makeStockLifecycleUser('student', 'seller-soldout');
    $product = makeStockLifecycleProduct($seller, ['stock_quantity' => 2]);
    Sanctum::actingAs($buyer);

    postStockLifecycleOrder($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 2]],
    ])->assertCreated();

    expect($product->fresh()->stock_quantity)->toBe(0)
        ->and($product->fresh()->status)->toBe('sold_out')
        ->and($product->fresh()->sold_out_at)->not->toBeNull();
    $this->assertDatabaseHas('product_history_events', [
        'product_id' => $product->id,
        'event' => 'stock_reserved',
        'stock_before' => 2,
        'stock_after' => 0,
    ]);

    $this->getJson('/api/products')
        ->assertOk()
        ->assertJsonFragment(['id' => $product->id, 'status' => 'sold_out']);

    postStockLifecycleOrder($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertUnprocessable();
    $this->assertDatabaseCount('orders', 1);
});

test('checkout rejects quantities above stock without creating orders or changing stock', function () {
    $buyer = makeStockLifecycleUser('student', 'buyer-too-many');
    $seller = makeStockLifecycleUser('student', 'seller-too-many');
    $product = makeStockLifecycleProduct($seller, ['stock_quantity' => 1]);
    Sanctum::actingAs($buyer);

    postStockLifecycleOrder($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 2]],
    ])->assertUnprocessable()->assertJsonValidationErrors('items.0.quantity');

    $this->assertDatabaseCount('orders', 0);
    expect($product->fresh()->stock_quantity)->toBe(1)
        ->and($product->fresh()->status)->toBe('active');
});

test('buyer cancellation and seller decline restore stock exactly once', function () {
    $buyer = makeStockLifecycleUser('student', 'buyer-restock');
    $seller = makeStockLifecycleUser('student', 'seller-restock');
    $product = makeStockLifecycleProduct($seller, ['stock_quantity' => 1]);
    Sanctum::actingAs($buyer);

    $orderId = postStockLifecycleOrder($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');
    $this->putJson('/api/orders/'.$orderId.'/cancel', [])->assertOk();
    $this->putJson('/api/orders/'.$orderId.'/cancel', [])->assertUnprocessable();

    expect($product->fresh()->stock_quantity)->toBe(1)
        ->and($product->fresh()->status)->toBe('active');

    $secondOrderId = postStockLifecycleOrder($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');
    Sanctum::actingAs($seller);
    $this->putJson('/api/seller/orders/'.$secondOrderId, [
        'status' => 'declined',
        'seller_note' => 'The item is no longer available.',
    ])->assertOk()->assertJsonPath('order.status', 'declined');

    expect($product->fresh()->stock_quantity)->toBe(1)
        ->and($product->fresh()->status)->toBe('active');
    $this->assertDatabaseCount('product_history_events', 6);
});

test('idempotent checkout does not reserve stock twice', function () {
    $buyer = makeStockLifecycleUser('student', 'buyer-idempotent-stock');
    $seller = makeStockLifecycleUser('student', 'seller-idempotent-stock');
    $product = makeStockLifecycleProduct($seller, ['stock_quantity' => 3]);
    Sanctum::actingAs($buyer);
    $request = [
        'idempotency_key' => 'stock-reservation-001',
        'items' => [['product_id' => $product->id, 'quantity' => 2]],
    ];

    postStockLifecycleOrder($this, $request)->assertCreated();
    postStockLifecycleOrder($this, $request)->assertOk();

    expect($product->fresh()->stock_quantity)->toBe(1);
    $this->assertDatabaseCount('orders', 1);
    $this->assertDatabaseCount('product_history_events', 1);
});

test('seller can restock a sold-out listing and only the owner can change stock', function () {
    $seller = makeStockLifecycleUser('student', 'seller-manage-stock');
    $otherSeller = makeStockLifecycleUser('student', 'other-manage-stock');
    $product = makeStockLifecycleProduct($seller, [
        'stock_quantity' => 0,
        'status' => 'sold_out',
        'sold_out_at' => now()->subMinutes(5),
    ]);

    Sanctum::actingAs($otherSeller);
    $this->putJson('/api/my-products/'.$product->id.'/stock', ['stock_quantity' => 5])
        ->assertForbidden();

    Sanctum::actingAs($seller);
    $this->putJson('/api/my-products/'.$product->id.'/stock', ['stock_quantity' => 5])
        ->assertOk()
        ->assertJsonPath('product.stock_quantity', 5)
        ->assertJsonPath('product.status', 'active');
    expect($product->fresh()->sold_out_at)->toBeNull();

    $this->putJson('/api/my-products/'.$product->id.'/stock', ['stock_quantity' => 0])
        ->assertOk()
        ->assertJsonPath('product.status', 'sold_out');
    expect($product->fresh()->stock_quantity)->toBe(0)
        ->and($product->fresh()->sold_out_at)->not->toBeNull();
});

test('seller product history includes orders and moderation records and is owner-only', function () {
    $seller = makeStockLifecycleUser('student', 'seller-history');
    $buyer = makeStockLifecycleUser('student', 'buyer-history');
    $otherSeller = makeStockLifecycleUser('student', 'other-history');
    $product = makeStockLifecycleProduct($seller, ['stock_quantity' => 2]);
    $product->moderationEvents()->create([
        'actor_id' => makeStockLifecycleUser('admin', 'history-admin')->id,
        'from_status' => 'pending',
        'to_status' => 'active',
        'reason' => null,
    ]);
    Sanctum::actingAs($buyer);
    postStockLifecycleOrder($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated();

    Sanctum::actingAs($seller);
    $response = $this->getJson('/api/my-products/'.$product->id.'/history')
        ->assertOk()
        ->assertJsonPath('product.id', $product->id);
    expect(collect($response->json('history'))->pluck('event')->all())
        ->toContain('listing_created', 'moderation', 'stock_reserved', 'order_activity');

    Sanctum::actingAs($otherSeller);
    $this->getJson('/api/my-products/'.$product->id.'/history')->assertForbidden();
});

test('seller archive preserves product images, orders, and history records', function () {
    $seller = makeStockLifecycleUser('student', 'seller-archive');
    $buyer = makeStockLifecycleUser('student', 'buyer-archive');
    $product = makeStockLifecycleProduct($seller);
    $image = ProductImage::create([
        'product_id' => $product->id,
        'path' => 'products/archive-test.jpg',
        'sort_order' => 0,
        'is_primary' => true,
    ]);
    Sanctum::actingAs($buyer);
    postStockLifecycleOrder($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated();

    Sanctum::actingAs($seller);

    $this->deleteJson('/api/products/'.$product->id)
        ->assertOk()
        ->assertJsonPath('product.status', 'archived');

    $this->assertDatabaseHas('products', ['id' => $product->id, 'status' => 'archived']);
    $this->assertDatabaseHas('product_images', ['id' => $image->id, 'product_id' => $product->id]);
    $this->assertDatabaseHas('product_history_events', ['product_id' => $product->id, 'event' => 'seller_archived']);
    $this->assertDatabaseCount('orders', 1);
    $this->assertDatabaseHas('order_items', ['product_id' => $product->id]);
});

test('sold-out listings are archived after one hour without deleting them', function () {
    $seller = makeStockLifecycleUser('student', 'seller-auto-archive');
    $expired = makeStockLifecycleProduct($seller, [
        'status' => 'sold_out',
        'stock_quantity' => 0,
        'sold_out_at' => now()->subHours(2),
    ]);
    $recent = makeStockLifecycleProduct($seller, [
        'status' => 'sold_out',
        'stock_quantity' => 0,
        'sold_out_at' => now()->subMinutes(20),
    ]);

    $this->artisan('products:archive-sold-out')->assertSuccessful();

    expect($expired->fresh()->status)->toBe('archived')
        ->and($recent->fresh()->status)->toBe('sold_out');
    $this->assertDatabaseHas('products', ['id' => $expired->id]);
    $this->assertDatabaseHas('product_history_events', [
        'product_id' => $expired->id,
        'event' => 'auto_archived',
    ]);
});

test('deleting a seller account archives products and keeps order history', function () {
    $admin = makeStockLifecycleUser('admin', 'account-history-admin');
    $seller = makeStockLifecycleUser('student', 'account-history-seller');
    $buyer = makeStockLifecycleUser('student', 'account-history-buyer');
    $product = makeStockLifecycleProduct($seller, ['stock_quantity' => 3]);
    Sanctum::actingAs($buyer);
    $orderId = postStockLifecycleOrder($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');

    Sanctum::actingAs($admin);
    $this->deleteJson('/api/admin/users/'.$seller->id)->assertOk();

    $this->assertDatabaseHas('products', [
        'id' => $product->id,
        'user_id' => null,
        'status' => 'archived',
    ]);
    $this->assertDatabaseHas('orders', [
        'id' => $orderId,
        'seller_id' => null,
        'seller_name_snapshot' => $seller->name,
    ]);
    $this->assertDatabaseHas('order_items', ['product_id' => $product->id]);
    $this->assertDatabaseHas('product_history_events', [
        'product_id' => $product->id,
        'event' => 'seller_account_archived',
    ]);
});
