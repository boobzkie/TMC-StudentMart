<?php

use App\Models\Order;
use App\Models\OrderPaymentMethod;
use App\Models\PickupLocation;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\User;
use App\Notifications\AccountEnforcementNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function postOrderWithDefaultOptions($test, array $payload)
{
    $paymentMethod = OrderPaymentMethod::query()->firstOrCreate(
        ['name' => 'Test cash in person'],
        ['instructions' => 'Pay the seller in person.', 'is_active' => true, 'sort_order' => 0],
    );
    $pickupLocation = PickupLocation::query()->firstOrCreate(
        ['name' => 'Test approved pickup point'],
        ['campus_area' => 'Test campus', 'is_active' => true, 'sort_order' => 0],
    );

    return $test->postJson('/api/orders', array_merge([
        'payment_method_id' => $paymentMethod->id,
        'pickup_location_id' => $pickupLocation->id,
    ], $payload));
}

function makeOrderFlowUser(string $role, string $suffix, array $overrides = []): User
{
    return User::create(array_merge([
        'name' => ucfirst($role).' '.$suffix,
        'student_id' => $role === 'student' ? 'ORD-'.$suffix : null,
        'email' => strtolower($role.'-'.$suffix).'@example.test',
        'password' => 'password123',
        'role' => $role,
        'status' => 'active',
    ], $overrides));
}

function makeOrderFlowProduct(User $seller, array $overrides = []): Product
{
    return Product::create(array_merge([
        'user_id' => $seller->id,
        'name' => 'TMC textbook',
        'description' => 'A marketplace listing.',
        'price' => '125.50',
        'category' => 'Books',
        'status' => 'active',
        'stock_quantity' => 99,
    ], $overrides));
}

test('order endpoints require an active student account', function () {
    postOrderWithDefaultOptions($this, ['items' => [['product_id' => 1, 'quantity' => 1]]])
        ->assertUnauthorized();

    $admin = makeOrderFlowUser('admin', 'auth');
    Sanctum::actingAs($admin);

    postOrderWithDefaultOptions($this, ['items' => [['product_id' => 1, 'quantity' => 1]]])
        ->assertForbidden();
});

test('the backend rejects a student trying to order their own product', function () {
    $seller = makeOrderFlowUser('student', 'owner');
    $product = makeOrderFlowProduct($seller);
    Sanctum::actingAs($seller);

    postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items.0.product_id')
        ->assertJsonFragment(['items.0.product_id' => ['You cannot purchase your own product.']]);

    $this->assertDatabaseCount('orders', 0);
});

test('checkout trusts database prices and creates one pending order per seller', function () {
    $buyer = makeOrderFlowUser('student', 'buyer');
    $sellerOne = makeOrderFlowUser('student', 'seller-one');
    $sellerTwo = makeOrderFlowUser('student', 'seller-two');
    $book = makeOrderFlowProduct($sellerOne, ['name' => 'Book', 'price' => '125.50']);
    ProductImage::create(['product_id' => $book->id, 'path' => 'products/book-secondary.jpg', 'sort_order' => 0, 'is_primary' => false]);
    ProductImage::create(['product_id' => $book->id, 'path' => 'products/book-primary.jpg', 'sort_order' => 1, 'is_primary' => true]);
    $calculator = makeOrderFlowProduct($sellerOne, ['name' => 'Calculator', 'price' => '80.00']);
    $notebook = makeOrderFlowProduct($sellerTwo, ['name' => 'Notebook', 'price' => '35.25']);
    Sanctum::actingAs($buyer);

    $response = postOrderWithDefaultOptions($this, [
        'buyer_id' => $sellerOne->id,
        'total_amount' => 0,
        'items' => [
            ['product_id' => $book->id, 'quantity' => 2, 'unit_price' => 0],
            ['product_id' => $calculator->id, 'quantity' => 1],
            ['product_id' => $notebook->id, 'quantity' => 3],
        ],
        'buyer_note' => 'Please message me about pickup.',
    ])->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('message', 'Order request placed. No payment was collected.')
        ->assertJsonCount(2, 'orders');

    $orders = $response->json('orders');
    $firstSellerOrder = collect($orders)->firstWhere('seller.id', $sellerOne->id);
    $secondSellerOrder = collect($orders)->firstWhere('seller.id', $sellerTwo->id);

    expect($firstSellerOrder['total_amount'])->toBe('331.00')
        ->and($firstSellerOrder['buyer']['id'])->toBe($buyer->id)
        ->and($firstSellerOrder['status'])->toBe('pending')
        ->and($firstSellerOrder['buyer_note'])->toBe('Please message me about pickup.')
        ->and(count($firstSellerOrder['items']))->toBe(2)
        ->and($firstSellerOrder['items'][0]['product_image'])->toBe('products/book-primary.jpg')
        ->and($secondSellerOrder['total_amount'])->toBe('105.75');

    $this->assertDatabaseCount('orders', 2);
    $this->assertDatabaseHas('orders', [
        'buyer_id' => $buyer->id,
        'seller_id' => $sellerOne->id,
        'total_amount' => '331.00',
        'status' => 'pending',
    ]);
    $this->assertDatabaseHas('order_items', [
        'product_id' => $book->id,
        'unit_price' => '125.50',
        'quantity' => 2,
        'line_total' => '251.00',
    ]);
});

test('admin can mark COD orders paid without changing order status and repeated requests stay idempotent', function () {
    $buyer = makeOrderFlowUser('student', 'cod-buyer');
    $seller = makeOrderFlowUser('student', 'cod-seller');
    $product = makeOrderFlowProduct($seller);

    Sanctum::actingAs($buyer);
    $created = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated();
    $orderId = $created->json('orders.0.id');
    $order = Order::findOrFail($orderId);

    expect($order->payment_status)->toBe('unpaid')
        ->and($order->status)->toBe('pending');

    $this->putJson('/api/admin/orders/'.$orderId.'/mark-paid')->assertForbidden();

    $admin = makeOrderFlowUser('admin', 'cod-admin');
    Sanctum::actingAs($admin);

    $this->putJson('/api/admin/orders/'.$orderId.'/mark-paid')
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('order.payment_status', 'paid')
        ->assertJsonPath('order.status', 'pending');

    $this->assertDatabaseHas('orders', [
        'id' => $orderId,
        'status' => 'pending',
        'payment_status' => 'paid',
    ]);

    $this->putJson('/api/admin/orders/'.$orderId.'/mark-paid')
        ->assertOk()
        ->assertJsonPath('order.payment_status', 'paid')
        ->assertJsonPath('order.status', 'pending');

    $this->assertDatabaseCount('orders', 1);
});

test('seller dashboard reports paid revenue separately and paginates only the seller orders', function () {
    $buyer = makeOrderFlowUser('student', 'sales-dashboard-buyer');
    $seller = makeOrderFlowUser('student', 'sales-dashboard-seller');
    $otherSeller = makeOrderFlowUser('student', 'sales-dashboard-other');
    $completedProduct = makeOrderFlowProduct($seller, ['name' => 'Completed item', 'price' => '125.50']);
    $paidProduct = makeOrderFlowProduct($seller, ['name' => 'Paid item', 'price' => '80.00']);
    $closedProduct = makeOrderFlowProduct($seller, ['name' => 'Closed item', 'price' => '35.25']);
    $cancelledProduct = makeOrderFlowProduct($seller, ['name' => 'Cancelled item', 'price' => '45.00']);
    $otherProduct = makeOrderFlowProduct($otherSeller, ['name' => 'Other seller item', 'price' => '60.00']);
    Sanctum::actingAs($buyer);

    $orderId = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $completedProduct->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');
    $paidOrderId = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $paidProduct->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');
    $closedOrderId = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $closedProduct->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');
    $cancelledOrderId = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $cancelledProduct->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');
    postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $otherProduct->id, 'quantity' => 1]],
    ])->assertCreated();

    Order::query()->whereKey($orderId)->update(['status' => 'completed']);
    Order::query()->whereKey($paidOrderId)->update(['payment_status' => 'paid']);
    Order::query()->whereKey($closedOrderId)->update([
        'status' => 'declined',
        'payment_status' => 'paid',
    ]);
    Order::query()->whereKey($cancelledOrderId)->update([
        'status' => 'cancelled',
        'payment_status' => 'paid',
    ]);

    Sanctum::actingAs($seller);
    $response = $this->getJson('/api/seller/orders?dashboard=1&page=1&per_page=1')
        ->assertOk()
        ->assertJsonCount(1, 'orders')
        ->assertJsonPath('total', 4)
        ->assertJsonPath('pagination.total', 4)
        ->assertJsonPath('pagination.per_page', 1)
        ->assertJsonPath('summary.total_orders', 3)
        ->assertJsonPath('summary.pending_orders', 1)
        ->assertJsonPath('summary.completed_orders', 1)
        ->assertJsonPath('summary.gross_order_value', '205.50')
        ->assertJsonPath('summary.completed_order_value', '125.50')
        ->assertJsonPath('summary.paid_revenue', '80.00')
        ->assertJsonPath('summary.open_order_value', '80.00')
        ->assertJsonPath('summary.status_counts.declined', 1)
        ->assertJsonPath('summary.status_counts.cancelled', 1)
        ->assertJsonPath('summary.average_completed_order_value', '125.50');

    expect(collect($response->json('orders'))->pluck('seller.id')->unique()->all())
        ->toBe([$seller->id]);
});

test('seller dashboard preserves the existing invalid status filter behavior and validates new query parameters', function () {
    $seller = makeOrderFlowUser('student', 'sales-dashboard-validation');
    Sanctum::actingAs($seller);

    $this->getJson('/api/seller/orders?status=unknown')->assertOk()->assertJsonCount(0, 'orders');
    $this->getJson('/api/seller/orders?per_page=51')->assertUnprocessable();
    $this->getJson('/api/seller/orders?from=2026-10-30T00:00:00Z&to=2026-10-01T00:00:00Z')
        ->assertUnprocessable();
});

test('checkout rejects inactive listings and inactive sellers', function () {
    $buyer = makeOrderFlowUser('student', 'buyer-inactive');
    $inactiveListing = makeOrderFlowProduct(
        makeOrderFlowUser('student', 'seller-inactive-listing'),
        ['status' => 'pending']
    );
    $inactiveSeller = makeOrderFlowUser('student', 'seller-account-inactive', ['status' => 'inactive']);
    $unavailableSellerProduct = makeOrderFlowProduct($inactiveSeller);
    Sanctum::actingAs($buyer);

    postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $inactiveListing->id, 'quantity' => 1]],
    ])->assertUnprocessable();

    postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $unavailableSellerProduct->id, 'quantity' => 1]],
    ])->assertUnprocessable();

    $this->assertDatabaseCount('orders', 0);
});

test('buyers and sellers can only see their own order records', function () {
    $buyer = makeOrderFlowUser('student', 'view-buyer');
    $seller = makeOrderFlowUser('student', 'view-seller');
    $otherStudent = makeOrderFlowUser('student', 'view-other');
    $product = makeOrderFlowProduct($seller);
    Sanctum::actingAs($buyer);

    $created = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated();
    $orderId = $created->json('orders.0.id');

    $this->getJson('/api/orders')
        ->assertOk()
        ->assertJsonCount(1, 'orders')
        ->assertJsonPath('orders.0.id', $orderId);

    $this->putJson('/api/orders/'.$orderId.'/cancel', [])
        ->assertOk()
        ->assertJsonPath('order.status', 'cancelled');

    Sanctum::actingAs($otherStudent);
    $this->getJson('/api/orders')->assertOk()->assertJsonCount(0, 'orders');
    $this->putJson('/api/orders/'.$orderId.'/cancel', [])->assertForbidden();

    Sanctum::actingAs($seller);
    $this->getJson('/api/seller/orders')
        ->assertOk()
        ->assertJsonCount(1, 'orders')
        ->assertJsonPath('orders.0.buyer.id', $buyer->id);

    Sanctum::actingAs($otherStudent);
    $this->getJson('/api/seller/orders')->assertOk()->assertJsonCount(0, 'orders');
    $this->putJson('/api/seller/orders/'.$orderId, ['status' => 'confirmed'])->assertForbidden();
});

test('buyer order history supports optional seller-safe pagination', function () {
    $buyer = makeOrderFlowUser('student', 'order-pagination-buyer');
    $otherBuyer = makeOrderFlowUser('student', 'order-pagination-other');
    $seller = makeOrderFlowUser('student', 'order-pagination-seller');
    $firstProduct = makeOrderFlowProduct($seller, ['name' => 'First order item']);
    $secondProduct = makeOrderFlowProduct($seller, ['name' => 'Second order item']);
    Sanctum::actingAs($buyer);
    $firstOrderId = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $firstProduct->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');
    $secondOrderId = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $secondProduct->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');

    $firstPage = $this->getJson('/api/orders?page=1&per_page=1')
        ->assertOk()
        ->assertJsonCount(1, 'orders')
        ->assertJsonPath('pagination.total', 2)
        ->assertJsonPath('pagination.per_page', 1);
    $secondPage = $this->getJson('/api/orders?page=2&per_page=1')
        ->assertOk()
        ->assertJsonCount(1, 'orders')
        ->assertJsonPath('pagination.current_page', 2);
    $pageOrderIds = [
        $firstPage->json('orders.0.id'),
        $secondPage->json('orders.0.id'),
    ];
    expect($pageOrderIds[0])->not->toBe($pageOrderIds[1])
        ->and($pageOrderIds)->toContain($firstOrderId)
        ->and($pageOrderIds)->toContain($secondOrderId);

    Sanctum::actingAs($otherBuyer);
    $this->getJson('/api/orders?page=1&per_page=1')
        ->assertOk()
        ->assertJsonCount(0, 'orders')
        ->assertJsonPath('pagination.total', 0);

    $this->getJson('/api/orders?per_page=51')->assertUnprocessable();
});

test('seller transitions require pickup readiness before completing an order', function () {
    $buyer = makeOrderFlowUser('student', 'transition-buyer');
    $seller = makeOrderFlowUser('student', 'transition-seller');
    $product = makeOrderFlowProduct($seller);
    Sanctum::actingAs($buyer);

    $orderId = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');

    $this->putJson('/api/orders/'.$orderId.'/cancel', [])
        ->assertOk()
        ->assertJsonPath('order.status', 'cancelled');

    $this->putJson('/api/orders/'.$orderId.'/cancel', [])
        ->assertUnprocessable();

    Sanctum::actingAs($seller);
    $this->putJson('/api/seller/orders/'.$orderId, ['status' => 'confirmed'])
        ->assertUnprocessable();

    Sanctum::actingAs($buyer);
    $newOrderId = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');

    Sanctum::actingAs($seller);
    $this->putJson('/api/seller/orders/'.$newOrderId, ['status' => 'declined'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('seller_note');

    $this->putJson('/api/seller/orders/'.$newOrderId, [
        'status' => 'confirmed',
        'seller_note' => 'I am checking availability.',
    ])->assertOk()->assertJsonPath('order.status', 'confirmed');

    $this->putJson('/api/seller/orders/'.$newOrderId, ['status' => 'completed'])
        ->assertUnprocessable();

    $this->putJson('/api/seller/orders/'.$newOrderId, ['status' => 'ready_for_pickup'])
        ->assertOk()
        ->assertJsonPath('order.status', 'ready_for_pickup');

    $this->putJson('/api/seller/orders/'.$newOrderId, ['status' => 'ready_for_pickup'])
        ->assertUnprocessable();

    $this->putJson('/api/seller/orders/'.$newOrderId, ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('order.status', 'completed');

    $this->putJson('/api/seller/orders/'.$newOrderId, [
        'status' => 'declined',
        'seller_note' => 'No longer available.',
    ])->assertUnprocessable();
});

test('checkout replays the same keyed request and rejects reuse with different details', function () {
    $buyer = makeOrderFlowUser('student', 'idempotent-buyer');
    $seller = makeOrderFlowUser('student', 'idempotent-seller');
    $firstProduct = makeOrderFlowProduct($seller, ['name' => 'First item']);
    $secondProduct = makeOrderFlowProduct($seller, ['name' => 'Second item']);
    Sanctum::actingAs($buyer);

    $request = [
        'idempotency_key' => 'checkout-request-001',
        'items' => [['product_id' => $firstProduct->id, 'quantity' => 1]],
    ];

    $created = postOrderWithDefaultOptions($this, $request)->assertCreated();
    $orderId = $created->json('orders.0.id');

    $replayed = postOrderWithDefaultOptions($this, $request)
        ->assertOk()
        ->assertJsonPath('message', 'This order request was already processed.')
        ->assertJsonPath('orders.0.id', $orderId);

    expect($replayed->json('orders.0.status'))->toBe('pending');

    $this->assertDatabaseCount('orders', 1);
    $this->assertDatabaseCount('order_idempotency_keys', 1);

    postOrderWithDefaultOptions($this, [
        'idempotency_key' => 'checkout-request-001',
        'items' => [['product_id' => $secondProduct->id, 'quantity' => 1]],
    ])->assertStatus(409)
        ->assertJsonPath('message', 'This idempotency key was already used for different order details.');

    $this->assertDatabaseCount('orders', 1);
});

test('administrators can review orders and students cannot access admin order records', function () {
    $buyer = makeOrderFlowUser('student', 'admin-buyer');
    $seller = makeOrderFlowUser('student', 'admin-seller');
    $product = makeOrderFlowProduct($seller);
    Sanctum::actingAs($buyer);

    postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated();

    $this->getJson('/api/admin/orders')->assertForbidden();

    Sanctum::actingAs(makeOrderFlowUser('staff', 'order-support'));
    $this->getJson('/api/admin/orders')->assertForbidden();

    Sanctum::actingAs(makeOrderFlowUser('admin', 'order-review'));
    $today = now()->toDateString();
    $this->getJson('/api/admin/orders?status=pending&search='.urlencode($product->name).'&from_date='.$today.'&to_date='.$today)
        ->assertOk()
        ->assertJsonPath('summary.total_orders', 1)
        ->assertJsonPath('summary.pending', 1)
        ->assertJsonPath('summary.ready_for_pickup', 0)
        ->assertJsonPath('total', 1)
        ->assertJsonCount(1, 'orders');

    $this->getJson('/api/admin/orders?search=ORD-admin-buyer')
        ->assertOk()
        ->assertJsonCount(1, 'orders');

    $this->getJson('/api/admin/orders?from_date='.now()->addDay()->toDateString())
        ->assertOk()
        ->assertJsonPath('total', 0)
        ->assertJsonCount(0, 'orders');

    $this->getJson('/api/admin/orders?from_date='.$today.'&to_date='.now()->subDay()->toDateString())
        ->assertUnprocessable()
        ->assertJsonValidationErrors('to_date');

    $this->getJson('/api/admin/orders?status=completed')
        ->assertOk()
        ->assertJsonCount(0, 'orders');

    $this->getJson('/api/admin/orders?status=ready_for_pickup')
        ->assertOk()
        ->assertJsonCount(0, 'orders');
});

test('order request notifications are stored once for the seller and can be marked read only by their owner', function () {
    $buyer = makeOrderFlowUser('student', 'notification-buyer');
    $seller = makeOrderFlowUser('student', 'notification-seller');
    $product = makeOrderFlowProduct($seller);
    Sanctum::actingAs($buyer);

    $request = [
        'idempotency_key' => 'notification-checkout-001',
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ];

    $created = postOrderWithDefaultOptions($this, $request)->assertCreated();
    $notification = $seller->notifications()->firstOrFail();

    expect($seller->notifications()->count())->toBe(1)
        ->and($buyer->notifications()->count())->toBe(0)
        ->and($notification->data['event'])->toBe('order_placed')
        ->and($notification->data['order_id'])->toBe($created->json('orders.0.id'));

    postOrderWithDefaultOptions($this, $request)->assertOk();
    expect($seller->notifications()->count())->toBe(1);

    Sanctum::actingAs($seller);
    $this->getJson('/api/notifications')
        ->assertOk()
        ->assertJsonPath('unread_count', 1)
        ->assertJsonPath('notifications.0.event', 'order_placed')
        ->assertJsonPath('notifications.0.order_id', $created->json('orders.0.id'));

    $this->putJson('/api/notifications/'.$notification->id.'/read', [])
        ->assertOk()
        ->assertJsonPath('success', true);

    $readResponse = $this->getJson('/api/notifications')
        ->assertOk()
        ->assertJsonPath('unread_count', 0);
    expect($readResponse->json('notifications.0.read_at'))->not->toBeNull();

    Sanctum::actingAs($buyer);
    $this->putJson('/api/notifications/'.$notification->id.'/read', [])
        ->assertNotFound();

    Sanctum::actingAs(makeOrderFlowUser('admin', 'notifications-admin'));
    $this->getJson('/api/notifications')->assertForbidden();
});

test('inbox notifications paginate within the authenticated account and include enforcement details', function () {
    $student = makeOrderFlowUser('student', 'inbox-pagination-student');
    $otherStudent = makeOrderFlowUser('student', 'inbox-pagination-other');
    $student->notify(new AccountEnforcementNotification('warning', 'Listing policy reminder.'));
    $student->notify(new AccountEnforcementNotification(
        'suspension',
        'Repeated listing violations.',
        3,
        '2026-10-31T12:00:00+08:00',
    ));
    $otherStudent->notify(new AccountEnforcementNotification('warning', 'Private account notice.'));
    Sanctum::actingAs($student);

    $firstPage = $this->getJson('/api/notifications?page=1&per_page=1')
        ->assertOk()
        ->assertJsonPath('unread_count', 2)
        ->assertJsonPath('pagination.total', 2)
        ->assertJsonPath('pagination.per_page', 1)
        ->assertJsonCount(1, 'notifications');
    $secondPage = $this->getJson('/api/notifications?page=2&per_page=1')
        ->assertOk()
        ->assertJsonPath('pagination.current_page', 2)
        ->assertJsonPath('pagination.total', 2)
        ->assertJsonCount(1, 'notifications');

    $notifications = collect([
        ...$firstPage->json('notifications'),
        ...$secondPage->json('notifications'),
    ]);
    expect($notifications->pluck('id')->unique())->toHaveCount(2)
        ->and($notifications->pluck('message')->all())->not->toContain('Private account notice.');
    $suspension = $notifications->firstWhere('event', 'account_suspended');
    expect($suspension['duration_days'])->toBe(3)
        ->and($suspension['suspended_until'])->toBe('2026-10-31T12:00:00+08:00');

    $this->getJson('/api/notifications?per_page=51')->assertUnprocessable();
});

test('order lifecycle notifications go to the other order party after valid changes', function () {
    $buyer = makeOrderFlowUser('student', 'events-buyer');
    $seller = makeOrderFlowUser('student', 'events-seller');
    $firstProduct = makeOrderFlowProduct($seller, ['name' => 'Lifecycle item']);
    Sanctum::actingAs($buyer);

    $firstOrderId = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $firstProduct->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');

    Sanctum::actingAs($seller);
    $this->putJson('/api/seller/orders/'.$firstOrderId, [
        'status' => 'confirmed',
    ])->assertOk();
    expect($buyer->notifications()->count())->toBe(1);

    $this->putJson('/api/seller/orders/'.$firstOrderId, [
        'status' => 'confirmed',
    ])->assertUnprocessable();
    expect($buyer->notifications()->count())->toBe(1);

    $this->putJson('/api/seller/orders/'.$firstOrderId, [
        'status' => 'ready_for_pickup',
    ])->assertOk();
    $this->putJson('/api/seller/orders/'.$firstOrderId, [
        'status' => 'completed',
    ])->assertOk();

    $firstBuyerEvents = $buyer->notifications()
        ->get()
        ->map(fn ($notification) => $notification->data['event'])
        ->all();
    expect($firstBuyerEvents)->toHaveCount(3)
        ->and($firstBuyerEvents)->toContain(
            'order_accepted',
            'order_ready_for_pickup',
            'order_completed',
        );

    $declinedProduct = makeOrderFlowProduct($seller, ['name' => 'Declined item']);
    Sanctum::actingAs($buyer);
    $declinedOrderId = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $declinedProduct->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');
    Sanctum::actingAs($seller);
    $this->putJson('/api/seller/orders/'.$declinedOrderId, [
        'status' => 'declined',
        'seller_note' => 'The item is no longer available.',
    ])->assertOk();

    $cancelledProduct = makeOrderFlowProduct($seller, ['name' => 'Cancelled item']);
    Sanctum::actingAs($buyer);
    $cancelledOrderId = postOrderWithDefaultOptions($this, [
        'items' => [['product_id' => $cancelledProduct->id, 'quantity' => 1]],
    ])->assertCreated()->json('orders.0.id');
    $this->putJson('/api/orders/'.$cancelledOrderId.'/cancel', [])
        ->assertOk();

    $buyerEvents = $buyer->notifications()
        ->get()
        ->map(fn ($notification) => $notification->data['event'])
        ->all();
    $sellerEvents = $seller->notifications()
        ->get()
        ->map(fn ($notification) => $notification->data['event'])
        ->all();

    expect($buyerEvents)->toContain('order_declined')
        ->and($sellerEvents)->toContain('order_cancelled')
        ->and($seller->notifications()->where('data->event', 'order_placed')->count())->toBe(3);
});
