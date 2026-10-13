<?php

use App\Models\Product;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    Category::create([
        'name' => 'Books',
        'description' => 'Books and course materials',
        'status' => 'active',
    ]);
});

function makeStudentForProductImageTest(string $studentId): User
{
    return User::factory()->create([
        'name' => 'Product Image Student',
        'student_id' => $studentId,
        'email' => strtolower($studentId).'@example.test',
        'contact_number' => '09170000000',
        'password' => 'student-password-123',
        'role' => 'student',
        'status' => 'active',
        'course' => 'BSIT',
    ]);
}

function productImageTestUpload(string $name): UploadedFile
{
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZcAAAAASUVORK5CYII=');

    return UploadedFile::fake()->createWithContent($name, $png);
}
function productImagePayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Used textbook',
        'description' => 'Good condition and complete pages.',
        'price' => '250.00',
        'category' => 'Books',
    ], $overrides);
}

test('a product can still be created without photos', function () {
    $student = makeStudentForProductImageTest('IMAGE-STUDENT-000');
    Sanctum::actingAs($student);

    $response = $this->postJson('/api/products', productImagePayload());

    $response->assertCreated()
        ->assertJsonPath('product.image', null)
        ->assertJsonCount(0, 'product.images');
});

test('students receive only active categories from the category API', function () {
    Category::create([
        'name' => 'Archived',
        'status' => 'inactive',
    ]);
    Sanctum::actingAs(makeStudentForProductImageTest('CATEGORY-STUDENT-001'));

    $this->getJson('/api/categories')
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('total', 1)
        ->assertJsonPath('categories.0.name', 'Books')
        ->assertJsonMissing(['name' => 'Archived']);
});

test('a product cannot be submitted under an inactive or unknown category', function () {
    Category::create([
        'name' => 'Archived',
        'status' => 'inactive',
    ]);
    Sanctum::actingAs(makeStudentForProductImageTest('CATEGORY-STUDENT-002'));

    $this->postJson('/api/products', productImagePayload(['category' => 'Archived']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('category');

    $this->postJson('/api/products', productImagePayload(['category' => 'Made up']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('category');

    $this->assertDatabaseMissing('products', ['name' => 'Used textbook']);
});

test('an admin cannot delete a category that is referenced by products', function () {
    $student = makeStudentForProductImageTest('CATEGORY-STUDENT-003');
    $admin = User::factory()->create([
        'name' => 'Category Test Admin',
        'student_id' => 'CATEGORY-ADMIN-001',
        'email' => 'category-admin@example.test',
        'role' => 'admin',
        'status' => 'active',
    ]);
    $product = Product::create([
        'user_id' => $student->id,
        'name' => 'Existing textbook',
        'description' => 'A product in the Books category.',
        'price' => 250,
        'category' => 'Books',
        'status' => 'active',
    ]);
    $category = Category::where('name', 'Books')->firstOrFail();
    Sanctum::actingAs($admin);

    $this->deleteJson('/api/admin/categories/'.$category->id)
        ->assertUnprocessable()
        ->assertJsonPath('success', false)
        ->assertJsonPath('product_count', 1);

    $this->assertDatabaseHas('categories', ['id' => $category->id]);
    $this->assertDatabaseHas('products', ['id' => $product->id]);
});
test('a student can create a pending product with multiple photos and one cover', function () {
    Storage::fake('public');
    $student = makeStudentForProductImageTest('IMAGE-STUDENT-001');
    Sanctum::actingAs($student);

    $response = $this->post('/api/products', productImagePayload([
        'images' => [
            productImageTestUpload('front.png'),
            productImageTestUpload('back.png'),
        ],
        'primary_image_index' => '1',
    ]), ['Accept' => 'application/json']);

    $response->assertCreated()
        ->assertJsonPath('product.status', 'pending')
        ->assertJsonCount(2, 'product.images')
        ->assertJsonPath('product.images.0.is_primary', false)
        ->assertJsonPath('product.images.1.is_primary', true);

    $product = Product::with('images')->findOrFail($response->json('product.id'));
    expect($product->image)->toBe($product->images[1]->path);
    $this->assertDatabaseCount('product_images', 2);
    Storage::disk('public')->assertExists($product->images[0]->path);
    Storage::disk('public')->assertExists($product->images[1]->path);
});

test('older single-image clients replace the existing cover instead of duplicating it', function () {
    Storage::fake('public');
    $student = makeStudentForProductImageTest('IMAGE-STUDENT-LEGACY');
    Sanctum::actingAs($student);

    $created = $this->post('/api/products', productImagePayload([
        'images' => [productImageTestUpload('old-cover.png')],
    ]), ['Accept' => 'application/json']);
    $created->assertCreated();
    $oldPath = $created->json('product.image');

    $updated = $this->post('/api/products/'.$created->json('product.id'), productImagePayload([
        '_method' => 'PUT',
        'image' => productImageTestUpload('new-cover.png'),
    ]), ['Accept' => 'application/json']);

    $updated->assertOk()->assertJsonCount(1, 'product.images');
    expect($updated->json('product.image'))->not->toBe($oldPath);
    Storage::disk('public')->assertMissing($oldPath);
});
test('a student can remove a product photo, add another, and retain the cover contract', function () {
    Storage::fake('public');
    $student = makeStudentForProductImageTest('IMAGE-STUDENT-002');
    Sanctum::actingAs($student);

    $created = $this->post('/api/products', productImagePayload([
        'images' => [
            productImageTestUpload('front.png'),
            productImageTestUpload('back.png'),
        ],
    ]), ['Accept' => 'application/json']);
    $created->assertCreated();
    $productId = $created->json('product.id');
    $oldCoverId = $created->json('product.images.0.id');
    $removedId = $created->json('product.images.1.id');
    $removedPath = $created->json('product.images.1.path');

    $updated = $this->post('/api/products/'.$productId, productImagePayload([
        '_method' => 'PUT',
        'remove_image_ids' => [$removedId],
        'images' => [productImageTestUpload('detail.png')],
        'primary_image_id' => $oldCoverId,
    ]), ['Accept' => 'application/json']);

    $updated->assertOk()
        ->assertJsonCount(2, 'product.images')
        ->assertJsonPath('product.image', $updated->json('product.images.0.path'));
    Storage::disk('public')->assertMissing($removedPath);
    expect($updated->json('product.status'))->toBe('pending');
});

test('a seller may correct a suspended listing but editing only resubmits it for review', function () {
    $student = makeStudentForProductImageTest('SUSPENDED-EDIT-001');
    $product = Product::create([
        'user_id' => $student->id,
        'name' => 'Listing under suspension',
        'description' => 'The seller needs to correct this listing.',
        'price' => 250,
        'category' => 'Books',
        'status' => 'suspended',
    ]);
    Sanctum::actingAs($student);

    $this->post('/api/products/'.$product->id, productImagePayload([
        '_method' => 'PUT',
        'name' => 'Corrected listing title',
    ]), ['Accept' => 'application/json'])
        ->assertOk()
        ->assertJsonPath('product.name', 'Corrected listing title')
        ->assertJsonPath('product.status', 'pending');

    $this->assertDatabaseHas('products', [
        'id' => $product->id,
        'status' => 'pending',
        'name' => 'Corrected listing title',
    ]);
});

test('a student cannot modify another student product photos', function () {
    Storage::fake('public');
    $owner = makeStudentForProductImageTest('IMAGE-STUDENT-003');
    $otherStudent = makeStudentForProductImageTest('IMAGE-STUDENT-004');
    Sanctum::actingAs($owner);
    $created = $this->post('/api/products', productImagePayload([
        'images' => [productImageTestUpload('cover.png')],
    ]), ['Accept' => 'application/json']);
    $created->assertCreated();

    Sanctum::actingAs($otherStudent);
    $this->putJson('/api/products/'.$created->json('product.id'), productImagePayload())
        ->assertForbidden();
});
