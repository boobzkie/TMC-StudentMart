<?php

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function makePrivacyStudent(string $suffix, array $overrides = []): User
{
    return User::factory()->create(array_merge([
        'name' => 'Privacy Student '.$suffix,
        'student_id' => 'PRIV-'.$suffix,
        'email' => strtolower($suffix).'@example.test',
        'role' => 'student',
        'status' => 'active',
    ], $overrides));
}

function makePrivacyListing(User $owner): Product
{
    return Product::create([
        'user_id' => $owner->id,
        'name' => 'Privacy listing',
        'description' => 'A listing used to check seller contact visibility.',
        'price' => 100,
        'category' => 'Books',
        'status' => 'active',
    ]);
}

test('student can update their own contact profile and explicit sharing preference', function () {
    $student = makePrivacyStudent('PROFILE');
    Sanctum::actingAs($student);

    $this->putJson('/api/user/student-profile', [
        'name' => 'Updated Student Name',
        'contact_number' => '09171234567',
        'course' => 'BSIT',
        'facebook_url' => 'https://facebook.com/example',
        'instagram_url' => 'https://instagram.com/example',
        'tiktok_url' => 'https://tiktok.com/@example',
        'share_contact_info' => true,
    ])->assertOk()
        ->assertJsonPath('user.name', 'Updated Student Name')
        ->assertJsonPath('user.share_contact_info', true)
        ->assertJsonPath('user.facebook_url', 'https://facebook.com/example');

    $student->refresh();
    expect($student->contact_number)->toBe('09171234567')
        ->and($student->course)->toBe('BSIT')
        ->and($student->share_contact_info)->toBeTrue();
});

test('student can upload a profile photo through their existing profile endpoint', function () {
    Storage::fake('public');
    $student = makePrivacyStudent('PHOTO');
    Sanctum::actingAs($student);
    $png = base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZcAAAAASUVORK5CYII='
    );

    $response = $this->post('/api/user/student-profile', [
        '_method' => 'PUT',
        'profile_picture' => UploadedFile::fake()->createWithContent(
            'student-profile.png',
            $png
        ),
    ], ['Accept' => 'application/json']);

    $response->assertOk();
    $path = $response->json('user.profile_picture');
    expect(str_starts_with($path, 'profile-pictures/'))->toBeTrue()
        ->and(Storage::disk('public')->exists($path))->toBeTrue()
        ->and($student->fresh()->profile_picture)->toBe($path);
});

test('seller contact details appear on product data only after the seller opts in', function () {
    $seller = makePrivacyStudent('SELLER', [
        'contact_number' => '09175551234',
        'facebook_url' => 'https://facebook.com/seller',
        'instagram_url' => 'https://instagram.com/seller',
        'tiktok_url' => 'https://tiktok.com/@seller',
        'share_contact_info' => false,
    ]);
    $buyer = makePrivacyStudent('BUYER');
    $product = makePrivacyListing($seller);
    Sanctum::actingAs($buyer);

    $hidden = $this->getJson('/api/products/'.$product->id)->assertOk();
    $this->assertArrayNotHasKey('contact_number', $hidden->json('product.user'));
    $this->assertArrayNotHasKey('facebook_url', $hidden->json('product.user'));

    $seller->forceFill(['share_contact_info' => true])->save();
    $shared = $this->getJson('/api/products/'.$product->id)->assertOk();
    $shared->assertJsonPath('product.user.contact_number', '09175551234')
        ->assertJsonPath('product.user.facebook_url', 'https://facebook.com/seller')
        ->assertJsonPath('product.user.instagram_url', 'https://instagram.com/seller')
        ->assertJsonPath('product.user.tiktok_url', 'https://tiktok.com/@seller');
});

test('student profile sharing preference accepts only a boolean', function () {
    $student = makePrivacyStudent('INVALID');
    Sanctum::actingAs($student);

    $this->putJson('/api/user/student-profile', [
        'share_contact_info' => 'everyone',
    ])->assertUnprocessable()->assertJsonValidationErrors('share_contact_info');

    expect($student->fresh()->share_contact_info)->toBeFalse();
});
