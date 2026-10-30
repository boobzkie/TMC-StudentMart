<?php

use App\Models\Category;
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

test('marketplace search matches product, seller, and active category information', function () {
    $seller = makeProductVisibilityStudent('SEARCH-OWNER');
    $seller->update([
        'name' => 'Searchable Seller',
        'username' => 'searchseller',
    ]);
    $viewer = makeProductVisibilityStudent('SEARCH-VIEWER');
    $category = Category::create([
        'name' => 'Course Materials',
        'description' => 'Books and supplies for class.',
        'status' => 'active',
    ]);
    $product = makeVisibilityTestProduct($seller, 'active');
    $product->update([
        'name' => 'Study Notebook',
        'description' => 'Ruled pages for lecture notes.',
        'category_id' => $category->id,
    ]);
    Sanctum::actingAs($viewer);

    foreach (['Notebook', 'Searchable Seller', 'searchseller', 'Course Materials'] as $term) {
        $this->getJson('/api/products?search='.urlencode($term))
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('products.0.id', $product->id);
    }

    $this->getJson('/api/products?search='.str_repeat('a', 121))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('search');
});

test('marketplace pagination is opt-in and returns stable filtered pages', function () {
    $seller = makeProductVisibilityStudent('PAGINATION-OWNER');
    $category = Category::create([
        'name' => 'Books',
        'description' => 'Course books and notebooks.',
        'status' => 'active',
    ]);

    $products = [
        ['name' => 'Notebook 100', 'price' => 100, 'category_id' => $category->id, 'attributes' => ['condition' => 'New'], 'stock_quantity' => 2],
        ['name' => 'Notebook 120', 'price' => 120, 'category_id' => $category->id, 'attributes' => ['condition' => 'New'], 'stock_quantity' => 1],
        ['name' => 'Notebook 90 legacy', 'price' => 90, 'category_id' => null, 'attributes' => ['condition' => 'New'], 'stock_quantity' => 3],
        ['name' => 'Used notebook', 'price' => 80, 'category_id' => $category->id, 'attributes' => ['condition' => 'Used'], 'stock_quantity' => 2],
        ['name' => 'Out of stock notebook', 'price' => 85, 'category_id' => $category->id, 'attributes' => ['condition' => 'New'], 'stock_quantity' => 0],
    ];

    foreach ($products as $attributes) {
        $product = makeVisibilityTestProduct($seller, 'active');
        $product->update($attributes + ['category' => 'Books']);
    }
    Sanctum::actingAs($seller);

    $query = http_build_query([
        'category_id' => $category->id,
        'min_price' => 80,
        'max_price' => 120,
        'condition' => 'new',
        'in_stock' => 1,
        'sort' => 'price_asc',
        'per_page' => 2,
    ]);

    $this->getJson('/api/products?'.$query.'&page=1')
        ->assertOk()
        ->assertJsonPath('total', 3)
        ->assertJsonPath('pagination.current_page', 1)
        ->assertJsonPath('pagination.last_page', 2)
        ->assertJsonPath('products.0.name', 'Notebook 90 legacy')
        ->assertJsonPath('products.1.name', 'Notebook 100');

    $this->getJson('/api/products?'.$query.'&page=2')
        ->assertOk()
        ->assertJsonPath('pagination.current_page', 2)
        ->assertJsonPath('products.0.name', 'Notebook 120');

    $this->getJson('/api/products')
        ->assertOk()
        ->assertJsonMissingPath('pagination');
});

test('marketplace rejects invalid pagination and price ranges', function () {
    Sanctum::actingAs(makeProductVisibilityStudent('PAGINATION-VALIDATION'));

    $this->getJson('/api/products?page=0')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('page');

    $this->getJson('/api/products?sort=unknown')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('sort');

    $this->getJson('/api/products?min_price=200&max_price=100')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('min_price');
});
