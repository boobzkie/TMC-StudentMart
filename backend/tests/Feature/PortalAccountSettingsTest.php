<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function makePortalSettingsUser(string $role): User
{
    static $sequence = 0;
    $sequence++;
    $student = $role === 'student';
    $user = User::create([
        'name' => $role === 'staff' ? 'Staff A Member' : ucfirst($role).' Settings User '.$sequence,
        'student_id' => $student ? 'SET-'.$sequence : null,
        'email' => $role.'-settings-'.$sequence.'@example.test',
        'contact_number' => '09170000000',
        'password' => 'current-password',
        'role' => $role,
        'status' => 'active',
    ]);

    if ($role === 'staff') {
        $user->staffProfile()->create([
            'first_name' => 'Staff',
            'middle_name' => 'A',
            'last_name' => 'Member',
            'date_of_birth' => now()->subYears(30)->toDateString(),
            'employee_id' => 'EMP-'.$sequence,
            'department' => 'BSIT',
            'position' => 'Instructor',
            'employment_status' => 'Regular',
            'employment_start_date' => now()->subYears(2)->toDateString(),
            'campus' => 'Main',
            'permissions' => ['manage_students'],
        ]);
    }

    return $user;
}

test('profile and password endpoints require authentication', function () {
    $this->postJson('/api/user/profile', ['name' => 'Changed Name'])->assertUnauthorized();
    $this->putJson('/api/user/password', [])->assertUnauthorized();
});

test('admin can update own profile but cannot change email role or status', function () {
    $admin = makePortalSettingsUser('admin');
    Sanctum::actingAs($admin);

    $this->postJson('/api/user/profile', [
        'name' => 'Updated Administrator',
        'contact_number' => '09175550000',
    ])->assertOk()
        ->assertJsonPath('user.name', 'Updated Administrator')
        ->assertJsonPath('user.contact_number', '09175550000');

    $this->postJson('/api/user/profile', [
        'name' => 'Forbidden Change',
        'role' => 'staff',
        'status' => 'inactive',
        'email' => 'changed@example.test',
    ])->assertUnprocessable();

    $admin->refresh();
    expect($admin->name)->toBe('Updated Administrator')
        ->and($admin->role)->toBe('admin')
        ->and($admin->status)->toBe('active')
        ->and($admin->email)->toContain('admin-settings-');
});

test('staff can update personal fields while employment details and permissions stay unchanged', function () {
    $staff = makePortalSettingsUser('staff');
    $employeeId = $staff->staffProfile->employee_id;
    Sanctum::actingAs($staff);

    $this->postJson('/api/user/profile', [
        'first_name' => 'Taylor',
        'middle_name' => 'Q',
        'last_name' => 'Person',
        'suffix' => 'Jr.',
        'date_of_birth' => now()->subYears(31)->toDateString(),
        'contact_number' => '09176660000',
    ])->assertOk()
        ->assertJsonPath('user.name', 'Taylor Q Person Jr.')
        ->assertJsonPath('user.staff_profile.department', 'BSIT')
        ->assertJsonPath('user.staff_profile.employee_id', $employeeId);

    $staff->refresh()->load('staffProfile');
    expect($staff->contact_number)->toBe('09176660000')
        ->and($staff->role)->toBe('staff')
        ->and($staff->status)->toBe('active')
        ->and($staff->staffProfile->first_name)->toBe('Taylor')
        ->and($staff->staffProfile->department)->toBe('BSIT')
        ->and($staff->staffProfile->position)->toBe('Instructor')
        ->and($staff->staffProfile->employment_status)->toBe('Regular')
        ->and($staff->staffProfile->permissions)->toBe(['manage_students']);
});

test('staff cannot submit employment metadata role status permissions or email changes', function () {
    $staff = makePortalSettingsUser('staff');
    $employeeId = $staff->staffProfile->employee_id;
    Sanctum::actingAs($staff);

    $this->postJson('/api/user/profile', [
        'first_name' => 'Changed',
        'last_name' => 'Name',
        'department' => 'CAS',
        'employee_id' => 'OTHER',
        'permissions' => [],
        'role' => 'admin',
        'status' => 'inactive',
        'email' => 'changed@example.test',
    ])->assertUnprocessable();

    $staff->refresh()->load('staffProfile');
    expect($staff->name)->toBe('Staff A Member')
        ->and($staff->role)->toBe('staff')
        ->and($staff->status)->toBe('active')
        ->and($staff->staffProfile->department)->toBe('BSIT')
        ->and($staff->staffProfile->employee_id)->toBe($employeeId)
        ->and($staff->staffProfile->permissions)->toBe(['manage_students']);
});

test('students cannot use the portal account settings endpoints', function () {
    $student = makePortalSettingsUser('student');
    Sanctum::actingAs($student);

    $this->postJson('/api/user/profile', ['name' => 'Changed Student'])->assertForbidden();
    $this->putJson('/api/user/password', [
        'current_password' => 'current-password',
        'password' => 'updated-password',
        'password_confirmation' => 'updated-password',
    ])->assertForbidden();
});

test('password update checks the current password and confirms the new password', function () {
    $admin = makePortalSettingsUser('admin');
    Sanctum::actingAs($admin);

    $this->putJson('/api/user/password', [
        'current_password' => 'wrong-password',
        'password' => 'updated-password',
        'password_confirmation' => 'updated-password',
    ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

    $this->putJson('/api/user/password', [
        'current_password' => 'current-password',
        'password' => 'updated-password',
        'password_confirmation' => 'updated-password',
    ])->assertOk();

    expect(Hash::check('updated-password', $admin->fresh()->password))->toBeTrue();
});

test('admin and staff can store only their own valid profile photo', function () {
    Storage::fake('public');
    $staff = makePortalSettingsUser('staff');
    Sanctum::actingAs($staff);

    $response = $this->post('/api/user/profile', [
        'first_name' => 'Staff',
        'last_name' => 'Member',
        'contact_number' => '09170000000',
        'profile_picture' => UploadedFile::fake()->create('profile.png', 1, 'image/png'),
    ], ['Accept' => 'application/json']);

    $response->assertOk();
    $path = $response->json('user.profile_picture');
    expect(str_starts_with($path, 'profile-pictures/'))->toBeTrue()
        ->and(Storage::disk('public')->exists($path))->toBeTrue();
});

test('staff can update their own password without changing access grants', function () {
    $staff = makePortalSettingsUser('staff');
    Sanctum::actingAs($staff);

    $this->putJson('/api/user/password', [
        'current_password' => 'current-password',
        'password' => 'staff-updated-password',
        'password_confirmation' => 'staff-updated-password',
    ])->assertOk();

    $staff->refresh()->load('staffProfile');
    expect(Hash::check('staff-updated-password', $staff->password))->toBeTrue()
        ->and($staff->role)->toBe('staff')
        ->and($staff->status)->toBe('active')
        ->and($staff->staffProfile->permissions)->toBe(['manage_students']);
});