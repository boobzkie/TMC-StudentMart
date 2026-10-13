<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;

uses(RefreshDatabase::class);

test('student registration and login issue student-only access', function () {
    $this->postJson('/api/register', [
        'name' => 'Student Account',
        'student_id' => 'STUDENT-AUTH-100',
        'email' => 'student-auth@example.test',
        'contact_number' => '09170000001',
        'password' => 'student-password-123',
        'password_confirmation' => 'student-password-123',
        'role' => 'admin',
        'status' => 'inactive',
    ])->assertCreated()
        ->assertJsonPath('user.role', 'student')
        ->assertJsonPath('user.status', 'active')
        ->assertJsonStructure(['token']);

    $login = $this->postJson('/api/login', [
        'email' => 'student-auth@example.test',
        'password' => 'student-password-123',
    ])->assertOk()
        ->assertJsonPath('user.role', 'student')
        ->assertJsonPath('user.status', 'active')
        ->assertJsonStructure(['token']);

    $token = $login->json('token');
    $this->withToken($token)->getJson('/api/categories')->assertOk();
    $this->withToken($token)->getJson('/api/admin/stats')->assertForbidden();
});

test('admin login grants admin APIs and rejects student APIs', function () {
    User::factory()->create([
        'name' => 'Portal Administrator',
        'email' => 'admin-auth@example.test',
        'password' => 'admin-password-123',
        'role' => 'admin',
        'status' => 'active',
    ]);

    $login = $this->postJson('/api/login', [
        'email' => 'admin-auth@example.test',
        'password' => 'admin-password-123',
    ])->assertOk()
        ->assertJsonPath('user.role', 'admin')
        ->assertJsonStructure(['token']);

    $token = $login->json('token');
    $this->withToken($token)->getJson('/api/admin/stats')->assertOk();
    $this->withToken($token)->getJson('/api/categories')->assertForbidden();
});

test('invalid credentials do not issue a Sanctum token', function () {
    User::factory()->create([
        'email' => 'invalid-login@example.test',
        'password' => 'correct-password-123',
        'role' => 'student',
        'status' => 'active',
    ]);

    $this->postJson('/api/login', [
        'email' => 'invalid-login@example.test',
        'password' => 'incorrect-password',
    ])->assertUnprocessable()
        ->assertJsonMissingPath('token');
});

test('inactive accounts cannot log in or receive a token', function () {
    User::factory()->create([
        'email' => 'inactive-student@example.test',
        'password' => 'student-password-123',
        'role' => 'student',
        'status' => 'inactive',
    ]);

    $this->postJson('/api/login', [
        'email' => 'inactive-student@example.test',
        'password' => 'student-password-123',
    ])->assertForbidden()
        ->assertJsonPath('status', 'inactive')
        ->assertJsonMissingPath('token');
});

test('logout revokes the presented token', function () {
    $student = User::factory()->create([
        'role' => 'student',
        'status' => 'active',
    ]);
    $token = $student->createToken('logout-test')->plainTextToken;

    $this->withToken($token)->postJson('/api/logout')->assertOk();
    Auth::forgetGuards();
    $this->assertDatabaseMissing('personal_access_tokens', [
        'tokenable_id' => $student->id,
    ]);
    $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
});

test('expired Sanctum tokens cannot access protected APIs', function () {
    config()->set('sanctum.expiration', 1);

    $student = User::factory()->create([
        'role' => 'student',
        'status' => 'active',
    ]);
    $token = $student->createToken('expired-test')->plainTextToken;
    $student->tokens()->firstOrFail()->forceFill([
        'created_at' => now()->subMinutes(2),
    ])->save();

    $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
});

test('protected APIs reject requests without a token', function () {
    $this->getJson('/api/user')->assertUnauthorized();
    $this->getJson('/api/categories')->assertUnauthorized();
    $this->getJson('/api/admin/stats')->assertUnauthorized();
});