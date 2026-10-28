<?php

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
