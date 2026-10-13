<?php

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function makeProductVisibilityStudent(string $suffix): User
{
    return User::factory()->create([
        'name' => 'Product Visibility '.$suffix,
        'student_id' => 'VIS-'.$suffix,
        'email' => strtolower($suffix).'@example.test',
        'role' => 'student',
        'status' => 'active',
    ]);
}

function makeVisibilityTestProduct(User $owner, string $status): Product
{
    return Product::create([
        'user_id' => $owner->id,
        'name' => 'Listing '.$status,
        'description' => 'Visibility test product.',
        'price' => 100,
        'category' => 'Books',
        'status' => $status,
    ]);
}

test('students cannot read another seller product unless it is active', function () {
    $owner = makeProductVisibilityStudent('OWNER-1');
    $viewer = makeProductVisibilityStudent('VIEWER-1');

    foreach (['pending', 'rejected', 'inactive'] as $status) {
        $product = makeVisibilityTestProduct($owner, $status);
        Sanctum::actingAs($viewer);

        $this->getJson('/api/products/'.$product->id)->assertNotFound();
    }
});

test('a seller can still read their own non-active product', function () {
    $owner = makeProductVisibilityStudent('OWNER-2');
    $product = makeVisibilityTestProduct($owner, 'pending');
    Sanctum::actingAs($owner);

    $this->getJson('/api/products/'.$product->id)
        ->assertOk()
        ->assertJsonPath('product.id', $product->id)
        ->assertJsonPath('product.status', 'pending');
});

test('students can read another seller active marketplace product', function () {
    $owner = makeProductVisibilityStudent('OWNER-3');
    $viewer = makeProductVisibilityStudent('VIEWER-3');
    $product = makeVisibilityTestProduct($owner, 'active');
    Sanctum::actingAs($viewer);

    $this->getJson('/api/products/'.$product->id)
        ->assertOk()
        ->assertJsonPath('product.id', $product->id)
        ->assertJsonPath('product.status', 'active');
});
