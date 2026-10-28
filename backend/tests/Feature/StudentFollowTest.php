<?php

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function makeFollowStudent(string $suffix, array $overrides = []): User
{
    return User::factory()->create(array_merge([
        'name' => 'Follow Student '.$suffix,
        'student_id' => 'FOLLOW-'.$suffix,
        'email' => strtolower($suffix).'@follow.test',
        'role' => 'student',
        'status' => 'active',
    ], $overrides));
}

test('active students can follow and unfollow another student without duplicate counts', function () {
    $viewer = makeFollowStudent('VIEWER');
    $target = makeFollowStudent('TARGET', ['course' => 'BSIT']);
    Sanctum::actingAs($viewer);

    $this->postJson('/api/students/'.$target->id.'/follow')
        ->assertOk()
        ->assertJsonPath('is_following', true)
        ->assertJsonPath('followers_count', 1)
        ->assertJsonPath('student.course', 'BSIT');

    $this->postJson('/api/students/'.$target->id.'/follow')
        ->assertOk()
        ->assertJsonPath('followers_count', 1);

    $this->getJson('/api/user/follow-stats')
        ->assertOk()
        ->assertJsonPath('following_count', 1)
        ->assertJsonPath('followers_count', 0);

    $this->getJson('/api/user/following')
        ->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('accounts.0.id', $target->id)
        ->assertJsonMissingPath('accounts.0.email');

    $this->deleteJson('/api/students/'.$target->id.'/follow')
        ->assertOk()
        ->assertJsonPath('is_following', false)
        ->assertJsonPath('followers_count', 0);

    $this->getJson('/api/user/follow-stats')
        ->assertOk()
        ->assertJsonPath('following_count', 0);
});

test('students cannot follow themselves, inactive accounts, or staff accounts', function () {
    $viewer = makeFollowStudent('SAFETY');
    $inactive = makeFollowStudent('INACTIVE', ['status' => 'inactive']);
    $staff = User::factory()->create([
        'name' => 'Follow Staff',
        'student_id' => null,
        'email' => 'staff-follow@example.test',
        'role' => 'staff',
        'status' => 'active',
    ]);
    Sanctum::actingAs($viewer);

    $this->postJson('/api/students/'.$viewer->id.'/follow')
        ->assertUnprocessable();
    $this->postJson('/api/students/'.$inactive->id.'/follow')
        ->assertNotFound();
    $this->postJson('/api/students/'.$staff->id.'/follow')
        ->assertNotFound();

    expect(DB::table('student_follows')->count())->toBe(0);
});

test('seller profile exposes safe profile data, paginated listings, and connection lists', function () {
    $viewer = makeFollowStudent('PUBLIC-VIEWER');
    $seller = makeFollowStudent('PUBLIC-SELLER', [
        'username' => 'seller.profile',
        'bio' => 'TMC student seller.',
        'course' => 'BSIT',
        'contact_number' => '09170000000',
    ]);
    $active = Product::create([
        'user_id' => $seller->id,
        'name' => 'Available book',
        'description' => 'Active listing',
        'price' => '120.00',
        'category' => 'Books',
        'status' => 'active',
        'stock_quantity' => 2,
    ]);
    Product::create([
        'user_id' => $seller->id,
        'name' => 'Sold book',
        'description' => 'Past listing',
        'price' => '80.00',
        'category' => 'Books',
        'status' => 'sold_out',
        'stock_quantity' => 0,
    ]);
    Product::create([
        'user_id' => $seller->id,
        'name' => 'Private archived listing',
        'description' => 'Not public',
        'price' => '50.00',
        'category' => 'Books',
        'status' => 'archived',
        'stock_quantity' => 0,
    ]);
    $viewer->following()->attach($seller->id);
    $seller->following()->attach($viewer->id);
    Sanctum::actingAs($viewer);

    $this->getJson('/api/students/'.$seller->id.'/profile')
        ->assertOk()
        ->assertJsonPath('student.username', 'seller.profile')
        ->assertJsonPath('student.bio', 'TMC student seller.')
        ->assertJsonPath('student.course', 'BSIT')
        ->assertJsonPath('followers_count', 1)
        ->assertJsonPath('following_count', 1)
        ->assertJsonPath('products_count', 2)
        ->assertJsonMissingPath('student.email')
        ->assertJsonMissingPath('student.student_id')
        ->assertJsonMissingPath('student.contact_number');

    $this->getJson('/api/students/'.$seller->id.'/products?page=1')
        ->assertOk()
        ->assertJsonPath('total', 2)
        ->assertJsonFragment(['id' => $active->id])
        ->assertJsonMissing(['name' => 'Private archived listing']);

    $this->getJson('/api/students/'.$seller->id.'/followers')
        ->assertOk()
        ->assertJsonPath('accounts.0.id', $viewer->id);

    $this->getJson('/api/students/'.$seller->id.'/following')
        ->assertOk()
        ->assertJsonPath('accounts.0.id', $viewer->id);
});
