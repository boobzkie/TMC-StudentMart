<?php

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function marketplaceFlowStudent(string $suffix): User
{
    return User::factory()->create([
        'name' => 'Marketplace Student '.$suffix,
        'student_id' => 'MARKET-'.$suffix,
        'email' => strtolower($suffix).'@marketplace.test',
        'role' => 'student',
        'status' => 'active',
    ]);
}

function marketplaceFlowImage(string $name): UploadedFile
{
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZcAAAAASUVORK5CYII=');

    return UploadedFile::fake()->createWithContent($name, $png);
}

function marketplaceFlowProductPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'TMC Biology Textbook',
        'description' => 'Good condition, lightly used.',
        'price' => '350.00',
    ], $overrides);
}

test('category ID, gallery, seller, moderation, and marketplace form one working flow', function () {
    Storage::fake('public');

    $category = Category::create([
        'name' => 'Books',
        'description' => 'Books and course materials.',
        'status' => 'active',
    ]);
    Category::create([
        'name' => 'Archived',
        'status' => 'inactive',
    ]);

    $student = marketplaceFlowStudent('FLOW-1');
    Sanctum::actingAs($student);

    $this->getJson('/api/categories')
        ->assertOk()
        ->assertJsonPath('categories.0.id', $category->id)
        ->assertJsonPath('categories.0.name', 'Books')
        ->assertJsonMissing(['name' => 'Archived']);

    $created = $this->post('/api/products', marketplaceFlowProductPayload([
        'category_id' => (string) $category->id,
        'images' => [
            marketplaceFlowImage('front.png'),
            marketplaceFlowImage('back.png'),
        ],
        'primary_image_index' => '1',
    ]), ['Accept' => 'application/json']);

    $created->assertCreated()
        ->assertJsonPath('product.category_id', $category->id)
        ->assertJsonPath('product.category', 'Books')
        ->assertJsonPath('product.category_record.id', $category->id)
        ->assertJsonPath('product.category_record.name', 'Books')
        ->assertJsonPath('product.status', 'pending')
        ->assertJsonPath('product.user.name', $student->name)
        ->assertJsonCount(2, 'product.images')
        ->assertJsonPath('product.images.0.is_primary', false)
        ->assertJsonPath('product.images.1.is_primary', true);

    $productId = $created->json('product.id');
    $product = Product::with('images')->findOrFail($productId);
    expect($product->category_id)->toBe($category->id)
        ->and($product->categoryRecord->name)->toBe('Books')
        ->and($product->image)->toBe($product->images[1]->path);

    Storage::disk('public')->assertExists($product->images[0]->path);
    Storage::disk('public')->assertExists($product->images[1]->path);
    $this->assertDatabaseCount('product_images', 2);

    $admin = User::factory()->create([
        'name' => 'Marketplace Admin',
        'email' => 'marketplace-admin@example.test',
        'role' => 'admin',
        'status' => 'active',
    ]);
    Sanctum::actingAs($admin);

    $this->getJson('/api/admin/categories')
        ->assertOk()
        ->assertJsonPath('categories.1.products_count', 1);

    $this->getJson('/api/admin/products?status=pending')
        ->assertOk()
        ->assertJsonPath('products.0.category_record.name', 'Books')
        ->assertJsonPath('products.0.user.email', $student->email)
        ->assertJsonPath('products.0.images.1.is_primary', true);

    $this->putJson('/api/admin/products/'.$productId.'/approve')
        ->assertOk()
        ->assertJsonPath('product.status', 'active')
        ->assertJsonPath('product.category_id', $category->id)
        ->assertJsonPath('product.category_record.name', 'Books');

    $viewer = marketplaceFlowStudent('FLOW-2');
    Sanctum::actingAs($viewer);
    $this->getJson('/api/products')
        ->assertOk()
        ->assertJsonCount(1, 'products')
        ->assertJsonPath('products.0.id', $productId)
        ->assertJsonPath('products.0.category_id', $category->id)
        ->assertJsonPath('products.0.category_record.name', 'Books')
        ->assertJsonPath('products.0.user.name', $student->name)
        ->assertJsonCount(2, 'products.0.images');
});

test('legacy category-name submissions resolve to a category ID and mismatched IDs are rejected', function () {
    $category = Category::create([
        'name' => 'Supplies',
        'status' => 'active',
    ]);
    Sanctum::actingAs(marketplaceFlowStudent('LEGACY-1'));

    $this->postJson('/api/products', marketplaceFlowProductPayload([
        'category' => 'Supplies',
    ]))
        ->assertCreated()
        ->assertJsonPath('product.category_id', $category->id)
        ->assertJsonPath('product.category', 'Supplies');

    $otherCategory = Category::create([
        'name' => 'Uniforms',
        'status' => 'active',
    ]);
    $this->postJson('/api/products', marketplaceFlowProductPayload([
        'category_id' => $category->id,
        'category' => $otherCategory->name,
    ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('category_id');

    $inactiveCategory = Category::create([
        'name' => 'Closed',
        'status' => 'inactive',
    ]);
    $this->postJson('/api/products', marketplaceFlowProductPayload([
        'category_id' => $inactiveCategory->id,
    ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('category_id');
});

test('category rename preserves product relationship and category deletion protects legacy products', function () {
    $category = Category::create([
        'name' => 'Course Books',
        'status' => 'active',
    ]);
    $student = marketplaceFlowStudent('RENAME-1');
    $product = Product::create([
        'user_id' => $student->id,
        'category_id' => $category->id,
        'category' => $category->name,
        'name' => 'Course reader',
        'description' => 'Course material.',
        'price' => 80,
        'status' => 'pending',
    ]);
    $legacyProduct = Product::create([
        'user_id' => $student->id,
        'category' => $category->name,
        'name' => 'Older listing',
        'description' => 'Legacy category text with no category ID.',
        'price' => 45,
        'status' => 'pending',
    ]);

    $admin = User::factory()->create([
        'name' => 'Category Admin',
        'email' => 'category-flow-admin@example.test',
        'role' => 'admin',
        'status' => 'active',
    ]);
    Sanctum::actingAs($admin);

    $this->putJson('/api/admin/categories/'.$category->id, [
        'name' => 'Learning Materials',
        'description' => 'Books and course resources.',
        'status' => 'active',
    ])
        ->assertOk()
        ->assertJsonPath('category.products_count', 2);

    expect($product->fresh()->category_id)->toBe($category->id)
        ->and($product->fresh()->category)->toBe('Learning Materials')
        ->and($product->fresh()->categoryRecord->name)->toBe('Learning Materials')
        ->and($legacyProduct->fresh()->category)->toBe('Learning Materials');

    $this->deleteJson('/api/admin/categories/'.$category->id)
        ->assertUnprocessable()
        ->assertJsonPath('product_count', 2);

    $this->assertDatabaseHas('products', ['id' => $product->id]);
    $this->assertDatabaseHas('products', ['id' => $legacyProduct->id]);
});