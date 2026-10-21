<?php

use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function makeInactiveAdminForStatusTest(): User
{
    return User::factory()->create([
        'role' => 'admin',
        'status' => 'inactive',
    ]);
}

test('inactive administrators cannot access admin-only API routes', function () {
    Sanctum::actingAs(makeInactiveAdminForStatusTest());

    $this->getJson('/api/admin/stats')->assertForbidden();
    $this->getJson('/api/admin/staff')->assertForbidden();
});

test('inactive administrators cannot use staff-shared student management routes', function () {
    Sanctum::actingAs(makeInactiveAdminForStatusTest());

    $this->getJson('/api/admin/users')->assertForbidden();
});

test('inactive administrators cannot update portal profile or password', function () {
    Sanctum::actingAs(makeInactiveAdminForStatusTest());

    $this->getJson('/api/user')->assertForbidden();
    $this->postJson('/api/user/profile', ['name' => 'Changed Name'])->assertForbidden();
    $this->putJson('/api/user/password', [
        'current_password' => 'old-password',
        'password' => 'new-password-123',
        'password_confirmation' => 'new-password-123',
    ])->assertForbidden();
});

test('active administrators retain admin API access', function () {
    $admin = User::factory()->create([
        'role' => 'admin',
        'status' => 'active',
    ]);
    Sanctum::actingAs($admin);

    $this->getJson('/api/admin/stats')->assertOk();
    $this->getJson('/api/admin/users')->assertOk();
});

test('admin dashboard stats include pending staff applications and all status fields', function () {
    $admin = User::factory()->create([
        'role' => 'admin',
        'status' => 'active',
    ]);
    User::factory()->create(['role' => 'staff', 'status' => 'pending']);
    User::factory()->create(['role' => 'staff', 'status' => 'active']);
    User::factory()->create(['role' => 'staff', 'status' => 'archived']);
    User::factory()->create(['role' => 'student', 'status' => 'pending']);
    Sanctum::actingAs($admin);

    $this->getJson('/api/admin/stats')
        ->assertOk()
        ->assertJsonPath('stats.pending_staff_applications', 1)
        ->assertJsonPath('stats.suspended_products', 0)
        ->assertJsonPath('stats.declined_orders', 0);
});
test('the admin seeder does not reset or reactivate an existing administrator', function () {
    $admin = User::factory()->create([
        'role' => 'admin',
        'status' => 'inactive',
        'email' => 'existing-admin@example.test',
        'password' => Hash::make('original-admin-password'),
    ]);
    config()->set('portal.admin_seed', [
        'email' => 'existing-admin@example.test',
        'password' => 'a-different-strong-password',
        'name' => 'TMC System Administrator',
    ]);

    $this->seed(AdminUserSeeder::class);

    $admin->refresh();
    expect(Hash::check('original-admin-password', $admin->password))->toBeTrue()
        ->and($admin->status)->toBe('inactive');
});

test('the admin seeder does not create an administrator without explicit credentials', function () {
    config()->set('portal.admin_seed', [
        'email' => '',
        'password' => '',
        'name' => 'TMC System Administrator',
    ]);

    $this->seed(AdminUserSeeder::class);

    $this->assertDatabaseCount('users', 0);
});
