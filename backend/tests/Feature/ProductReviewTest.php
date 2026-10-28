<?php

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function makeVerifiedReviewStudent(string $key, string $role = 'student'): User
{
    return User::create([
        'name' => 'Review '.$key,
        'student_id' => $role === 'student' ? 'REVIEW-'.$key : null,
        'email' => strtolower('review-'.$key).'@example.test',
        'password' => 'password123',
        'role' => $role,
        'status' => 'active',
    ]);
}

function makeVerifiedReviewProduct(User $seller, string $name = 'Review book'): Product
{
    return Product::create([
        'user_id' => $seller->id,
        'name' => $name,
        'description' => 'A book that may be reviewed.',
        'price' => '120.00',
        'category' => 'Books',
        'status' => 'active',
        'stock_quantity' => 1,
    ]);
}

function makeReviewOrder(User $buyer, User $seller, Product $product, string $status, bool $completedAt = true): Order
{
    $completed = $status === 'completed' && $completedAt;
    $order = Order::query()->create([
        'order_number' => 'RVW'.strtoupper(bin2hex(random_bytes(5))),
        'buyer_id' => $buyer->id,
        'seller_id' => $seller->id,
        'buyer_name_snapshot' => $buyer->name,
        'seller_name_snapshot' => $seller->name,
        'status' => $status,
        'total_amount' => '120.00',
        'completed_at' => $completed ? now() : null,
    ]);
    $order->items()->create([
        'product_id' => $product->id,
        'product_name' => $product->name,
        'unit_price' => '120.00',
        'quantity' => 1,
        'line_total' => '120.00',
    ]);

    return $order;
}

test('only a completed order with a completion timestamp allows a product review', function () {
    $buyer = makeVerifiedReviewStudent('ELIGIBILITY-BUYER');
    $seller = makeVerifiedReviewStudent('ELIGIBILITY-SELLER');
    $product = makeVerifiedReviewProduct($seller);

    foreach (['pending', 'confirmed', 'ready_for_pickup', 'cancelled', 'completed'] as $index => $status) {
        makeReviewOrder($buyer, $seller, $product, $status, $index !== 4);
    }

    Sanctum::actingAs($buyer);
    $this->postJson('/api/products/'.$product->id.'/reviews', [
        'rating' => 5,
        'comment' => 'Very helpful item.',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('eligibility');

    $this->getJson('/api/products/'.$product->id.'/reviews')
        ->assertOk()
        ->assertJsonPath('can_review', false)
        ->assertJsonPath('already_reviewed', false)
        ->assertJsonPath('total', 0);

    $this->assertDatabaseCount('product_reviews', 0);
});

test('verified buyers can submit one review per product and ratings aggregate correctly', function () {
    $seller = makeVerifiedReviewStudent('VERIFIED-SELLER');
    $firstBuyer = makeVerifiedReviewStudent('VERIFIED-BUYER-ONE');
    $secondBuyer = makeVerifiedReviewStudent('VERIFIED-BUYER-TWO');
    $product = makeVerifiedReviewProduct($seller);
    makeReviewOrder($firstBuyer, $seller, $product, 'completed');
    makeReviewOrder($secondBuyer, $seller, $product, 'completed');

    Sanctum::actingAs($firstBuyer);
    $this->postJson('/api/products/'.$product->id.'/reviews', [
        'rating' => 4,
        'title' => 'Good condition',
        'comment' => '<b>Works well and arrived as expected.</b>',
    ])
        ->assertCreated()
        ->assertJsonPath('review.rating', 4)
        ->assertJsonPath('review.title', 'Good condition')
        ->assertJsonPath('review.comment', 'Works well and arrived as expected.')
        ->assertJsonPath('review.reviewer.name', $firstBuyer->name);

    $this->postJson('/api/products/'.$product->id.'/reviews', [
        'rating' => 5,
        'comment' => 'A second review should not be accepted.',
    ])->assertStatus(409);

    $this->getJson('/api/products/'.$product->id.'/reviews')
        ->assertOk()
        ->assertJsonPath('average_rating', 4)
        ->assertJsonPath('total', 1)
        ->assertJsonPath('already_reviewed', true)
        ->assertJsonPath('can_review', false)
        ->assertJsonPath('reviews.0.reviewer.name', $firstBuyer->name);

    Sanctum::actingAs($secondBuyer);
    $this->postJson('/api/products/'.$product->id.'/reviews', [
        'rating' => 5,
        'comment' => 'Verified purchase, excellent quality.',
    ])->assertCreated();

    $this->getJson('/api/products/'.$product->id.'/reviews')
        ->assertOk()
        ->assertJsonPath('average_rating', 4.5)
        ->assertJsonPath('total', 2);

    $this->assertDatabaseCount('product_reviews', 2);
});

test('review requests require a student, a valid rating and a verified completed order', function () {
    $seller = makeVerifiedReviewStudent('VALIDATION-SELLER');
    $student = makeVerifiedReviewStudent('VALIDATION-BUYER');
    $admin = makeVerifiedReviewStudent('VALIDATION-ADMIN', 'admin');
    $product = makeVerifiedReviewProduct($seller);
    makeReviewOrder($student, $seller, $product, 'completed');

    $this->postJson('/api/products/'.$product->id.'/reviews', [
        'rating' => 5,
        'comment' => 'Must sign in.',
    ])->assertUnauthorized();

    Sanctum::actingAs($admin);
    $this->postJson('/api/products/'.$product->id.'/reviews', [
        'rating' => 5,
        'comment' => 'Admins cannot review as buyers.',
    ])->assertForbidden();

    Sanctum::actingAs($student);
    $this->postJson('/api/products/'.$product->id.'/reviews', [
        'rating' => 6,
        'comment' => 'Invalid rating.',
    ])->assertUnprocessable()->assertJsonValidationErrors(['rating']);

    $this->postJson('/api/products/'.$product->id.'/reviews', [
        'rating' => 5,
        'comment' => '<p></p>',
    ])->assertUnprocessable()->assertJsonValidationErrors(['comment']);

    $this->assertDatabaseCount('product_reviews', 0);
});

test('seller profile shows product-wide verified review totals and safely lists reviews', function () {
    $seller = makeVerifiedReviewStudent('PUBLIC-REVIEW-SELLER', 'student');
    $buyer = makeVerifiedReviewStudent('PUBLIC-REVIEW-BUYER');
    $product = makeVerifiedReviewProduct($seller, 'Public review book');
    makeReviewOrder($buyer, $seller, $product, 'completed');
    Sanctum::actingAs($buyer);

    $this->postJson('/api/products/'.$product->id.'/reviews', [
        'rating' => 5,
        'comment' => 'Helpful and in good shape.',
    ])->assertCreated();

    $this->getJson('/api/students/'.$seller->id.'/profile')
        ->assertOk()
        ->assertJsonPath('reviews_count', 1)
        ->assertJsonPath('average_rating', 5);

    $this->getJson('/api/students/'.$seller->id.'/reviews')
        ->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('reviews.0.product.name', 'Public review book')
        ->assertJsonPath('reviews.0.reviewer.name', $buyer->name);

    expect(ProductReview::query()->firstOrFail()->order_id)->not->toBeNull();
});
