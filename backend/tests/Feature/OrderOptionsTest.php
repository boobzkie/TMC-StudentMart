<?php

use App\Models\OrderPaymentMethod;
use App\Models\PickupLocation;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function makeOrderOptionsUser(string $role, string $key): User
{
    return User::create([
        'name' => ucfirst($role).' '.$key,
        'student_id' => $role === 'student' ? 'OPT-'.$key : null,
        'email' => strtolower($role.'-'.$key).'@example.test',
        'password' => 'password123',
        'role' => $role,
        'status' => 'active',
    ]);
}

function makeOrderOptionsProduct(User $seller): Product
{
    return Product::create([
        'user_id' => $seller->id,
        'name' => 'Test listing',
        'description' => 'A test listing for order option checks.',
        'price' => '40.00',
        'category' => 'Books',
        'status' => 'active',
        'stock_quantity' => 5,
    ]);
}

function makeOrderPaymentMethod(array $overrides = []): OrderPaymentMethod
{
    return OrderPaymentMethod::query()->create(array_merge([
        'name' => 'Cash in person',
        'instructions' => 'Pay the seller at handover.',
        'is_active' => true,
        'sort_order' => 0,
    ], $overrides));
}

function makePickupLocation(array $overrides = []): PickupLocation
{
    return PickupLocation::query()->create(array_merge([
        'name' => 'Admin approved meeting point',
        'building_room' => 'Building entered by Admin',
        'campus_area' => 'Area entered by Admin',
        'instructions' => 'Follow the Admin-provided handover instructions.',
        'operating_hours' => 'Hours entered by Admin',
        'is_active' => true,
        'sort_order' => 0,
    ], $overrides));
}

test('only Admin can manage order methods and pickup locations while students see active choices', function () {
    $admin = makeOrderOptionsUser('admin', 'config');
    $student = makeOrderOptionsUser('student', 'options');

    Sanctum::actingAs($admin);
    $this->postJson('/api/admin/payment-methods', [
        'name' => 'Cash in person',
        'instructions' => 'Pay the seller at handover.',
    ])->assertCreated();
    $this->postJson('/api/admin/payment-methods', [
        'name' => 'Temporarily unavailable',
        'is_active' => false,
    ])->assertCreated();
    $this->postJson('/api/admin/pickup-locations', [
        'name' => 'Approved location entered by Admin',
        'building_room' => 'Room entered by Admin',
        'campus_area' => 'Campus area entered by Admin',
        'instructions' => 'Meet at the approved point.',
    ])->assertCreated();

    Sanctum::actingAs($student);
    $this->getJson('/api/admin/order-options')->assertForbidden();
    $this->getJson('/api/order-options')
        ->assertOk()
        ->assertJsonCount(1, 'payment_methods')
        ->assertJsonCount(1, 'pickup_locations')
        ->assertJsonPath('pickup_locations.0.name', 'Approved location entered by Admin');
});

test('checkout requires active options and preserves the agreed payment and pickup snapshots', function () {
    $buyer = makeOrderOptionsUser('student', 'buyer');
    $seller = makeOrderOptionsUser('student', 'seller');
    $product = makeOrderOptionsProduct($seller);
    $method = makeOrderPaymentMethod();
    $location = makePickupLocation();
    Sanctum::actingAs($buyer);

    $this->postJson('/api/orders', [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['payment_method_id', 'pickup_location_id']);

    $created = $this->postJson('/api/orders', [
        'payment_method_id' => $method->id,
        'pickup_location_id' => $location->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated()
        ->assertJsonPath('orders.0.payment_method.name', 'Cash in person')
        ->assertJsonPath('orders.0.payment_method.instructions', 'Pay the seller at handover.')
        ->assertJsonPath('orders.0.pickup_location.name', 'Admin approved meeting point')
        ->assertJsonPath('orders.0.pickup_location.area', 'Area entered by Admin');

    $orderId = $created->json('orders.0.id');
    $method->update(['name' => 'Renamed method', 'instructions' => 'Updated instructions.', 'is_active' => false]);
    $location->update(['name' => 'Renamed location', 'instructions' => 'Updated location instructions.', 'is_active' => false]);

    $this->getJson('/api/order-options')
        ->assertOk()
        ->assertJsonCount(0, 'payment_methods')
        ->assertJsonCount(0, 'pickup_locations');

    $this->getJson('/api/orders')
        ->assertOk()
        ->assertJsonPath('orders.0.id', $orderId)
        ->assertJsonPath('orders.0.payment_method.name', 'Cash in person')
        ->assertJsonPath('orders.0.pickup_location.name', 'Admin approved meeting point')
        ->assertJsonPath('orders.0.pickup_location.instructions', 'Follow the Admin-provided handover instructions.');

    $this->assertDatabaseHas('orders', [
        'id' => $orderId,
        'payment_method_name_snapshot' => 'Cash in person',
        'pickup_location_name_snapshot' => 'Admin approved meeting point',
    ]);
});

test('checkout rejects an inactive option and Admin can filter orders for a pickup location', function () {
    $admin = makeOrderOptionsUser('admin', 'orders');
    $buyer = makeOrderOptionsUser('student', 'filter-buyer');
    $seller = makeOrderOptionsUser('student', 'filter-seller');
    $method = makeOrderPaymentMethod();
    $firstLocation = makePickupLocation();
    $secondLocation = makePickupLocation(['name' => 'Second approved point']);
    $product = makeOrderOptionsProduct($seller);
    Sanctum::actingAs($buyer);

    $method->update(['is_active' => false]);
    $this->postJson('/api/orders', [
        'payment_method_id' => $method->id,
        'pickup_location_id' => $firstLocation->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertUnprocessable()->assertJsonValidationErrors('payment_method_id');
    $method->update(['is_active' => true]);

    $this->postJson('/api/orders', [
        'payment_method_id' => $method->id,
        'pickup_location_id' => $firstLocation->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated();
    $this->postJson('/api/orders', [
        'payment_method_id' => $method->id,
        'pickup_location_id' => $secondLocation->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated();

    Sanctum::actingAs($admin);
    $this->getJson('/api/admin/orders?pickup_location_id='.$firstLocation->id)
        ->assertOk()
        ->assertJsonCount(1, 'orders')
        ->assertJsonPath('orders.0.pickup_location.id', $firstLocation->id);

    $this->getJson('/api/admin/order-options')
        ->assertOk()
        ->assertJsonPath('pickup_locations.0.orders_count', 1);
});
