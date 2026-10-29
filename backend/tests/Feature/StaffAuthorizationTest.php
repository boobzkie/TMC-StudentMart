<?php

use App\Models\StaffApplicationEvent;
use App\Models\StaffProfile;
use App\Models\User;
use App\Notifications\AccountEnforcementNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function makeStaffAuthorizationUser(string $role, array $overrides = []): User
{
    static $sequence = 0;
    $sequence++;
    $isStudent = $role === 'student';
    $user = User::create(array_merge([
        'name' => ucfirst($role).' Test '.(string) $sequence,
        'student_id' => $isStudent ? 'STU-'.(string) $sequence : null,
        'email' => $role.(string) $sequence.'@example.test',
        'contact_number' => '09170000000',
        'password' => 'password123',
        'role' => $role,
        'status' => 'active',
    ], $overrides));

    if ($role === 'staff') {
        $user->staffProfile()->create([
            'permissions' => ['manage_students'],
            'is_admin_created' => true,
            'reviewed_at' => now(),
        ]);
    }

    return $user;
}

function staffApplicationPayload(array $overrides = []): array
{
    return array_merge([
        'first_name' => 'Alex',
        'middle_name' => 'T',
        'last_name' => 'Instructor',
        'suffix' => '',
        'date_of_birth' => now()->subYears(30)->toDateString(),
        'contact_number' => '09171234567',
        'email' => 'alex.instructor@example.test',
        'employee_id' => 'EMP-1001',
        'department' => 'BSIT',
        'position' => 'Instructor',
        'employment_status' => 'Regular',
        'password' => 'staff-password-123',
        'password_confirmation' => 'staff-password-123',
        'terms_accepted' => '1',
        'age' => 99,
        'verification_document' => UploadedFile::fake()->create('institution-id.pdf', 120, 'application/pdf'),
    ], $overrides);
}

test('admin can create staff accounts without a student id and grants no extra permissions by default', function () {
    $admin = makeStaffAuthorizationUser('admin');
    Sanctum::actingAs($admin);

    $response = $this->postJson('/api/admin/staff', [
        'name' => 'Support Staff',
        'email' => 'support@example.test',
        'contact_number' => '09171234567',
        'password' => 'staff-password-123',
        'password_confirmation' => 'staff-password-123',
        'role' => 'admin',
        'status' => 'inactive',
    ]);

    $response->assertCreated()
        ->assertJsonPath('staff.role', 'staff')
        ->assertJsonPath('staff.status', 'active')
        ->assertJsonPath('staff.student_id', null)
        ->assertJsonPath('staff.staff_permissions', []);

    $this->assertDatabaseHas('users', [
        'email' => 'support@example.test', 'role' => 'staff', 'status' => 'active', 'student_id' => null,
    ]);
    $created = User::where('email', 'support@example.test')->firstOrFail();
    expect(Hash::check('staff-password-123', $created->password))->toBeTrue();
});

test('staff can list students and issue warnings or time-limited suspensions only when permitted', function () {
    $staff = makeStaffAuthorizationUser('staff');
    $student = makeStaffAuthorizationUser('student');
    $admin = makeStaffAuthorizationUser('admin');
    $otherStaff = makeStaffAuthorizationUser('staff');
    Sanctum::actingAs($staff->fresh());

    $this->getJson('/api/admin/users')->assertOk()->assertJsonCount(1, 'users')->assertJsonPath('users.0.id', $student->id);
    $this->getJson('/api/admin/users/'.$student->id)->assertOk()->assertJsonPath('user.role', 'student');
    $this->getJson('/api/admin/users/'.$admin->id)->assertNotFound();
    $this->getJson('/api/admin/users/'.$otherStaff->id)->assertNotFound();
    $this->putJson('/api/admin/users/'.$student->id.'/deactivate', [
        'action' => 'warning',
        'reason' => 'Repeated prohibited marketplace messages.',
    ])->assertOk()->assertJsonPath('user.status', 'active')->assertJsonPath('user.enforcement_history.0.event', 'warning_issued');
    $this->assertDatabaseHas('notifications', [
        'type' => AccountEnforcementNotification::class,
        'notifiable_type' => User::class,
        'notifiable_id' => $student->id,
    ]);

    $this->putJson('/api/admin/users/'.$student->id.'/deactivate', [
        'action' => 'suspension',
        'duration_days' => 2,
        'reason' => 'Repeated prohibited marketplace messages.',
    ])->assertOk()->assertJsonPath('user.status', 'suspended')->assertJsonPath('user.enforcement_history.0.duration_days', 2);

    $this->assertDatabaseHas('users', ['id' => $student->id, 'status' => 'suspended']);
    $this->assertDatabaseHas('account_enforcement_events', [
        'user_id' => $student->id,
        'actor_id' => $staff->id,
        'action' => 'warning_issued',
    ]);
    $this->assertDatabaseHas('account_enforcement_events', [
        'user_id' => $student->id,
        'actor_id' => $staff->id,
        'action' => 'suspended',
        'duration_days' => 2,
    ]);
});

test('staff without student-management permission cannot access student information but retain staff dashboard access', function () {
    $staff = makeStaffAuthorizationUser('staff');
    $staff->staffProfile()->update(['permissions' => []]);
    Sanctum::actingAs($staff->fresh());

    $this->getJson('/api/admin/users')->assertForbidden();
    $this->getJson('/api/staff/stats')->assertOk();
});

test('staff cannot delete students or access administrator modules', function () {
    $staff = makeStaffAuthorizationUser('staff');
    $student = makeStaffAuthorizationUser('student');
    Sanctum::actingAs($staff->fresh());

    $this->deleteJson('/api/admin/users/'.$student->id)->assertForbidden();
    $this->getJson('/api/admin/stats')->assertForbidden();
    $this->getJson('/api/admin/staff')->assertForbidden();
    $this->postJson('/api/admin/staff', [])->assertForbidden();
});

test('administrators cannot delete student or staff accounts or archive staff accounts', function () {
    $admin = makeStaffAuthorizationUser('admin');
    $student = makeStaffAuthorizationUser('student');
    $staff = makeStaffAuthorizationUser('staff');
    Sanctum::actingAs($admin);

    $this->deleteJson('/api/admin/users/'.$student->id)->assertForbidden();
    $this->deleteJson('/api/admin/staff/'.$staff->id)->assertForbidden();
    $this->putJson('/api/admin/staff/'.$staff->id.'/archive')->assertForbidden();

    $this->assertDatabaseHas('users', ['id' => $student->id, 'role' => 'student', 'status' => 'active']);
    $this->assertDatabaseHas('users', ['id' => $staff->id, 'role' => 'staff', 'status' => 'active']);
});

test('student suspensions require a whole-number duration from one through seven days', function () {
    $admin = makeStaffAuthorizationUser('admin');
    $student = makeStaffAuthorizationUser('student');
    Sanctum::actingAs($admin);

    foreach ([0, 8, 1.5] as $duration) {
        $this->putJson('/api/admin/users/'.$student->id.'/deactivate', [
            'action' => 'suspension',
            'duration_days' => $duration,
            'reason' => 'Repeated prohibited marketplace messages.',
        ])->assertUnprocessable();
    }
    $this->putJson('/api/admin/users/'.$student->id.'/deactivate', [
        'action' => 'warning',
        'reason' => '     ',
    ])->assertUnprocessable();

    $this->assertDatabaseHas('users', ['id' => $student->id, 'status' => 'active']);
    $this->assertDatabaseCount('account_enforcement_events', 0);
});

test('expired timed suspensions restore access on the next successful login and record expiry', function () {
    $student = makeStaffAuthorizationUser('student', ['status' => 'suspended']);
    $student->suspended_until = now()->subMinute();
    $student->save();

    $this->postJson('/api/login', [
        'email' => $student->email,
        'password' => 'password123',
    ])->assertOk()->assertJsonPath('user.status', 'active');

    $this->assertDatabaseHas('users', ['id' => $student->id, 'status' => 'active', 'suspended_until' => null]);
    $this->assertDatabaseHas('account_enforcement_events', [
        'user_id' => $student->id,
        'action' => 'suspension_expired',
    ]);
});

test('students and inactive staff cannot access protected staff or admin user APIs', function () {
    $student = makeStaffAuthorizationUser('student');
    Sanctum::actingAs($student);
    $this->getJson('/api/staff/stats')->assertForbidden();
    $this->getJson('/api/admin/users')->assertForbidden();

    $inactive = makeStaffAuthorizationUser('staff', ['status' => 'inactive']);
    Sanctum::actingAs($inactive);
    $this->getJson('/api/staff/stats')->assertForbidden();
    $this->getJson('/api/admin/users')->assertForbidden();
});

test('public staff registration stores a pending application and issues no authentication token', function () {
    Storage::fake('local');
    $response = $this->postJson('/api/staff/register', staffApplicationPayload());

    $response->assertCreated()
        ->assertJsonPath('status', 'pending')
        ->assertJsonMissingPath('token')
        ->assertJsonStructure(['application_reference', 'email', 'message']);

    $user = User::where('email', 'alex.instructor@example.test')->firstOrFail();
    expect($user->role)->toBe('staff')->and($user->status)->toBe('pending')->and($user->name)->toBe('Alex T Instructor');
    $this->assertDatabaseCount('personal_access_tokens', 0);
    $profile = $user->staffProfile;
    expect($profile->date_of_birth->toDateString())->toBe(now()->subYears(30)->toDateString());
    expect($profile->permissions)->toBe([]);
    expect(Storage::disk('local')->exists($profile->verification_document_path))->toBeTrue();
    $this->assertDatabaseHas('staff_application_events', ['staff_profile_id' => $profile->id, 'event' => 'submitted']);

    $this->postJson('/api/staff/application-status', [
        'email' => $user->email,
        'application_reference' => $response->json('application_reference'),
    ])->assertOk()->assertJsonPath('status', 'pending');
});

test('pending applicants cannot sign in and administrators can approve with explicit permission', function () {
    Storage::fake('local');
    $application = $this->postJson('/api/staff/register', staffApplicationPayload())->assertCreated();
    $staff = User::where('email', 'alex.instructor@example.test')->firstOrFail();
    $this->postJson('/api/login', ['email' => $staff->email, 'password' => 'staff-password-123'])
        ->assertForbidden()->assertJsonPath('status', 'pending')->assertJsonMissingPath('token');

    $admin = makeStaffAuthorizationUser('admin');
    Sanctum::actingAs($admin);
    $this->putJson('/api/admin/staff/'.$staff->id.'/approve', ['permissions' => ['manage_students']])
        ->assertOk()->assertJsonPath('staff.status', 'active')->assertJsonPath('staff.staff_permissions.0', 'manage_students');
    $this->assertDatabaseHas('staff_application_events', ['staff_profile_id' => $staff->staffProfile->id, 'event' => 'approved', 'actor_id' => $admin->id]);

    $login = $this->postJson('/api/login', ['email' => $staff->email, 'password' => 'staff-password-123']);
    $login->assertOk()->assertJsonPath('user.staff_permissions.0', 'manage_students')->assertJsonStructure(['token']);
    expect($application->json('application_reference'))->not->toBeEmpty();
});

test('rejected applicants can check the decision note but cannot access protected features', function () {
    Storage::fake('local');
    $application = $this->postJson('/api/staff/register', staffApplicationPayload())->assertCreated();
    $staff = User::where('email', 'alex.instructor@example.test')->firstOrFail();
    $admin = makeStaffAuthorizationUser('admin');
    Sanctum::actingAs($admin);
    $this->putJson('/api/admin/staff/'.$staff->id.'/reject', ['reason' => 'Employee details need correction.'])->assertOk();

    $this->postJson('/api/staff/application-status', [
        'email' => $staff->email,
        'application_reference' => $application->json('application_reference'),
    ])->assertOk()->assertJsonPath('status', 'rejected')->assertJsonPath('decision_reason', 'Employee details need correction.');
    $this->postJson('/api/login', ['email' => $staff->email, 'password' => 'staff-password-123'])->assertForbidden()->assertJsonPath('status', 'rejected');
});

test('suspending approved staff revokes existing Sanctum tokens immediately', function () {
    $staff = makeStaffAuthorizationUser('staff');
    $token = $staff->createToken('existing')->plainTextToken;
    $admin = makeStaffAuthorizationUser('admin');
    Sanctum::actingAs($admin);
    $response = $this->putJson('/api/admin/staff/'.$staff->id.'/suspend', [
        'action' => 'suspension',
        'duration_days' => 3,
        'reason' => 'Repeated misuse of staff privileges.',
    ])->assertOk()->assertJsonPath('staff.status', 'suspended');
    expect($response->json('staff.suspended_until'))->not->toBeNull();
    $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $staff->id]);
    Sanctum::actingAs($staff->fresh());
    $this->getJson('/api/staff/stats')->assertForbidden();
    expect($token)->not->toBeEmpty();
});

test('administrators can warn Staff and suspend them for no more than seven whole days', function () {
    $admin = makeStaffAuthorizationUser('admin');
    $staff = makeStaffAuthorizationUser('staff');
    Sanctum::actingAs($admin);

    $this->putJson('/api/admin/staff/'.$staff->id.'/suspend', [
        'action' => 'warning',
        'reason' => 'Failure to follow the marketplace moderation procedure.',
    ])->assertOk()->assertJsonPath('staff.status', 'active');

    foreach ([0, 8, 1.5] as $duration) {
        $this->putJson('/api/admin/staff/'.$staff->id.'/suspend', [
            'action' => 'suspension',
            'duration_days' => $duration,
            'reason' => 'Repeated failure to follow the moderation procedure.',
        ])->assertUnprocessable();
    }
    $this->putJson('/api/admin/staff/'.$staff->id.'/suspend', [
        'action' => 'warning',
        'reason' => '     ',
    ])->assertUnprocessable();

    $this->putJson('/api/admin/staff/'.$staff->id.'/suspend', [
        'action' => 'warning_and_suspension',
        'duration_days' => 7,
        'reason' => 'Repeated failure to follow the moderation procedure.',
    ])->assertOk()->assertJsonPath('staff.status', 'suspended')->assertJsonPath('staff.history.0.event', 'suspended');

    $this->assertDatabaseHas('account_enforcement_events', [
        'user_id' => $staff->id,
        'actor_id' => $admin->id,
        'action' => 'warning_issued',
    ]);
    $this->assertDatabaseHas('account_enforcement_events', [
        'user_id' => $staff->id,
        'actor_id' => $admin->id,
        'action' => 'suspended',
        'duration_days' => 7,
    ]);
});

test('student course filtering, editing, validation, and dashboard counts use only student accounts', function () {
    $admin = makeStaffAuthorizationUser('admin');
    $bsit = makeStaffAuthorizationUser('student', ['course' => 'BSIT']);
    $bsoa = makeStaffAuthorizationUser('student', ['course' => 'BSOA']);
    makeStaffAuthorizationUser('staff', ['course' => 'BSIT']);
    makeStaffAuthorizationUser('staff', ['status' => 'archived']);
    Sanctum::actingAs($admin);

    $this->getJson('/api/admin/users?course=BSIT')->assertOk()->assertJsonCount(1, 'users')->assertJsonPath('users.0.id', $bsit->id)->assertJsonPath('users.0.course', 'BSIT');
    $this->getJson('/api/admin/users?course=BOGUS')->assertUnprocessable();
    $this->putJson('/api/admin/users/'.$bsit->id, ['course' => 'BSED'])->assertOk()->assertJsonPath('user.course', 'BSED');
    $this->putJson('/api/admin/users/'.$bsit->id, ['course' => 'INVALID'])->assertUnprocessable();
    $this->getJson('/api/admin/stats')->assertOk()->assertJsonPath('stats.course_stats.BSED', 1)->assertJsonPath('stats.course_stats.BSOA', 1)->assertJsonPath('stats.course_stats.BSIT', 0)->assertJsonPath('stats.total_staff', 1);
    expect($bsoa->course)->toBe('BSOA');
});

test('staff applicants cannot approve themselves and pending accounts cannot use protected student endpoints', function () {
    Storage::fake('local');
    $this->postJson('/api/staff/register', staffApplicationPayload())->assertCreated();
    $applicant = User::where('email', 'alex.instructor@example.test')->firstOrFail();
    Sanctum::actingAs($applicant);

    $this->putJson('/api/admin/staff/'.$applicant->id.'/approve', ['permissions' => ['manage_students']])->assertForbidden();
    $this->getJson('/api/admin/users')->assertForbidden();
    $this->getJson('/api/staff/stats')->assertForbidden();
    $this->assertDatabaseHas('users', ['id' => $applicant->id, 'status' => 'pending']);
});

test('staff registration rejects invalid department and executable verification documents', function () {
    Storage::fake('local');
    $payload = staffApplicationPayload([
        'department' => 'OTHER',
        'verification_document' => UploadedFile::fake()->create('program.exe', 50, 'application/octet-stream'),
    ]);

    $this->postJson('/api/staff/register', $payload)->assertUnprocessable();
    $this->assertDatabaseMissing('users', ['email' => 'alex.instructor@example.test']);
});

test('only an administrator can retrieve a private verification document', function () {
    Storage::fake('local');
    $this->postJson('/api/staff/register', staffApplicationPayload())->assertCreated();
    $staff = User::where('email', 'alex.instructor@example.test')->firstOrFail();

    $this->getJson('/api/admin/staff/'.$staff->id.'/document')->assertUnauthorized();
    Sanctum::actingAs(makeStaffAuthorizationUser('staff'));
    $this->getJson('/api/admin/staff/'.$staff->id.'/document')->assertForbidden();
    Sanctum::actingAs(makeStaffAuthorizationUser('admin'));
    $this->get('/api/admin/staff/'.$staff->id.'/document')->assertOk()->assertHeader('Content-Disposition');
});
test('public student registration still creates only a student and accepts a supported course', function () {
    $this->postJson('/api/register', [
        'name' => 'New Student', 'student_id' => 'STUDENT-COURSE-1', 'email' => 'newstudent@example.test',
        'contact_number' => '09179999999', 'course' => 'BSCRIM', 'password' => 'student-password-123',
        'password_confirmation' => 'student-password-123', 'role' => 'admin', 'status' => 'inactive',
    ])->assertCreated()->assertJsonPath('user.role', 'student')->assertJsonPath('user.status', 'active')->assertJsonPath('user.course', 'BSCRIM');

    $this->postJson('/api/register', [
        'name' => 'Another Student', 'student_id' => 'STUDENT-COURSE-2', 'email' => 'another@example.test',
        'contact_number' => '09179999998', 'course' => 'UNKNOWN', 'password' => 'student-password-123',
        'password_confirmation' => 'student-password-123',
    ])->assertUnprocessable();
});
