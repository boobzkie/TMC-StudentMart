<?php

use App\Models\Complaint;
use App\Models\Product;
use App\Models\ProductModerationEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function makePhaseThreeUser(string $role, string $email, array $permissions = []): User
{
    $user = User::create([
        'name' => ucfirst($role).' '.str_replace('@example.test', '', $email),
        'student_id' => $role === 'student' ? strtoupper(str_replace('@example.test', '', $email)) : null,
        'email' => $email,
        'password' => 'password123',
        'role' => $role,
        'status' => 'active',
    ]);

    if ($role === 'staff') {
        $user->staffProfile()->create([
            'permissions' => $permissions,
            'is_admin_created' => true,
            'reviewed_at' => now(),
        ]);
    }

    return $user;
}

function makePhaseThreeComplaint(User $student, array $overrides = []): Complaint
{
    return Complaint::create(array_merge([
        'user_id' => $student->id,
        'subject' => 'Marketplace concern',
        'description' => 'The listing needs a review by Staff.',
        'status' => 'pending',
    ], $overrides));
}

test('Staff complaint permission grants filtered access and keeps private notes out of student responses', function () {
    $staff = makePhaseThreeUser('staff', 'complaint-staff@example.test', ['manage_complaints']);
    $student = makePhaseThreeUser('student', 'complaint-student@example.test');
    $complaint = makePhaseThreeComplaint($student, [
        'staff_note' => 'Internal follow-up note.',
        'handled_by' => $staff->id,
        'handled_at' => now(),
        'admin_response' => 'We are reviewing this issue.',
    ]);

    Sanctum::actingAs($staff);
    $this->getJson('/api/staff/complaints?status=pending')
        ->assertOk()
        ->assertJsonPath('data.data.0.id', $complaint->id)
        ->assertJsonPath('data.data.0.user.name', $student->name);
    $this->getJson('/api/staff/complaints/'.$complaint->id)
        ->assertOk()
        ->assertJsonPath('data.staff_note', 'Internal follow-up note.')
        ->assertJsonPath('data.handler.id', $staff->id);

    Sanctum::actingAs($student);
    $this->getJson('/api/complaints/'.$complaint->id)
        ->assertOk()
        ->assertJsonMissingPath('data.staff_note')
        ->assertJsonMissingPath('data.handled_by')
        ->assertJsonMissingPath('data.handled_at')
        ->assertJsonPath('data.admin_response', 'We are reviewing this issue.');
});

test('Staff can update complaint status and private notes while rejection requires a student-visible reason', function () {
    $staff = makePhaseThreeUser('staff', 'complaint-handler@example.test', ['manage_complaints']);
    $student = makePhaseThreeUser('student', 'complaint-owner@example.test');
    $complaint = makePhaseThreeComplaint($student);
    Sanctum::actingAs($staff);

    $this->putJson('/api/staff/complaints/'.$complaint->id, [
        'status' => 'in_review',
        'investigation_note' => 'Contact the seller and review the listing.',
    ])
        ->assertOk()
        ->assertJsonPath('data.status', 'in_review')
        ->assertJsonPath('data.staff_note', 'Contact the seller and review the listing.')
        ->assertJsonPath('data.handler.id', $staff->id);

    $this->putJson('/api/staff/complaints/'.$complaint->id, [
        'status' => 'rejected',
        'investigation_note' => 'Reviewed the evidence.',
    ])->assertUnprocessable();

    $this->putJson('/api/staff/complaints/'.$complaint->id, [
        'status' => 'rejected',
        'investigation_note' => 'Reviewed the evidence.',
        'response_to_complainant' => 'The report did not include enough evidence.',
    ])->assertOk()->assertJsonPath('data.admin_response', 'The report did not include enough evidence.');

    $this->putJson('/api/staff/complaints/'.$complaint->id, [
        'status' => 'pending',
        'investigation_note' => 'Attempt to reopen.',
    ])->assertStatus(409);

    $this->assertDatabaseHas('complaints', [
        'id' => $complaint->id,
        'status' => 'rejected',
        'staff_note' => 'Reviewed the evidence.',
        'admin_response' => 'The report did not include enough evidence.',
        'handled_by' => $staff->id,
    ]);
});

test('Staff reports and analytics use real moderation and complaint records with separate permissions', function () {
    $staff = makePhaseThreeUser('staff', 'insights-staff@example.test', ['view_reports', 'view_analytics']);
    $student = makePhaseThreeUser('student', 'insights-student@example.test');
    $pending = Product::create([
        'user_id' => $student->id,
        'name' => 'Pending textbook',
        'description' => 'Awaiting moderation.',
        'price' => 150,
        'category' => 'Books',
        'status' => 'pending',
    ]);
    $approved = Product::create([
        'user_id' => $student->id,
        'name' => 'Approved textbook',
        'description' => 'Approved listing.',
        'price' => 180,
        'category' => 'Books',
        'status' => 'active',
    ]);
    ProductModerationEvent::create([
        'product_id' => $approved->id,
        'actor_id' => $staff->id,
        'from_status' => 'pending',
        'to_status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    makePhaseThreeComplaint($student);
    makePhaseThreeComplaint($student, ['subject' => 'Second concern', 'status' => 'in_review']);

    Sanctum::actingAs($staff);
    $this->getJson('/api/staff/reports?from='.now()->toDateString().'&to='.now()->toDateString())
        ->assertOk()
        ->assertJsonPath('data.summary.products_submitted', 2)
        ->assertJsonPath('data.summary.products_pending', 1)
        ->assertJsonPath('data.summary.products_approved', 1)
        ->assertJsonPath('data.summary.complaints_submitted', 2)
        ->assertJsonPath('data.summary.complaints_pending', 1)
        ->assertJsonPath('data.summary.complaints_in_review', 1);
    $this->getJson('/api/staff/analytics?from='.now()->toDateString().'&to='.now()->toDateString())
        ->assertOk()
        ->assertJsonPath('data.daily_activity.0.product_submissions', 2);

    $admin = makePhaseThreeUser('admin', 'insights-admin@example.test');
    Sanctum::actingAs($admin);
    $this->getJson('/api/admin/complaints')->assertOk();
    $this->getJson('/api/admin/stats')->assertOk();
});

test('Staff, students, and inactive accounts cannot use Staff complaint or insight APIs without explicit permissions', function () {
    $noPermissions = makePhaseThreeUser('staff', 'no-phase-three-permissions@example.test');
    $complaintOnly = makePhaseThreeUser('staff', 'complaint-only@example.test', ['manage_complaints']);
    $reportOnly = makePhaseThreeUser('staff', 'report-only@example.test', ['view_reports']);
    $inactive = makePhaseThreeUser('staff', 'inactive-phase-three@example.test', ['manage_complaints', 'view_reports', 'view_analytics']);
    $inactive->update(['status' => 'inactive']);
    $student = makePhaseThreeUser('student', 'no-staff-api@example.test');

    foreach ([$noPermissions, $student, $inactive] as $user) {
        Sanctum::actingAs($user);
        $this->getJson('/api/staff/complaints')->assertForbidden();
        $this->getJson('/api/staff/reports')->assertForbidden();
        $this->getJson('/api/staff/analytics')->assertForbidden();
    }

    Sanctum::actingAs($complaintOnly);
    $this->getJson('/api/staff/complaints')->assertOk();
    $this->getJson('/api/staff/reports')->assertForbidden();
    $this->getJson('/api/staff/analytics')->assertForbidden();

    Sanctum::actingAs($reportOnly);
    $this->getJson('/api/staff/reports')->assertOk();
    $this->getJson('/api/staff/analytics')->assertForbidden();
});

test('administrator can grant and revoke the Phase 3 Staff permissions', function () {
    $admin = makePhaseThreeUser('admin', 'phase-three-admin@example.test');
    Sanctum::actingAs($admin);
    $permissions = ['manage_complaints', 'view_reports', 'view_analytics'];

    $created = $this->postJson('/api/admin/staff', [
        'name' => 'Support and Insights',
        'email' => 'support-insights@example.test',
        'password' => 'secure-password-123',
        'password_confirmation' => 'secure-password-123',
        'permissions' => $permissions,
    ])->assertCreated()->assertJsonPath('staff.staff_permissions', $permissions);

    $staffId = $created->json('staff.id');
    $this->putJson('/api/admin/staff/'.$staffId, ['permissions' => ['manage_complaints']])
        ->assertOk()
        ->assertJsonPath('staff.staff_permissions', ['manage_complaints']);
});

test('complaints must enter review before a terminal decision and notify only the complainant of public status changes', function () {
    $staff = makePhaseThreeUser('staff', 'workflow-staff@example.test', ['manage_complaints']);
    $student = makePhaseThreeUser('student', 'workflow-student@example.test');
    $complaint = makePhaseThreeComplaint($student);
    Sanctum::actingAs($staff);

    $this->putJson('/api/staff/complaints/'.$complaint->id, [
        'status' => 'resolved',
        'response_to_complainant' => 'We reviewed the report and corrected the issue.',
    ])->assertStatus(409);

    $this->putJson('/api/staff/complaints/'.$complaint->id, [
        'status' => 'in_review',
        'investigation_note' => 'Private note: verify the reported listing.',
    ])->assertOk()->assertJsonPath('data.status', 'in_review');
    $this->assertDatabaseHas('notifications', [
        'notifiable_id' => $student->id,
        'type' => \App\Notifications\ComplaintStatusNotification::class,
    ]);

    $this->putJson('/api/staff/complaints/'.$complaint->id, [
        'status' => 'resolved',
        'investigation_note' => 'Private note remains private.',
        'response_to_complainant' => 'We reviewed the report and corrected the issue.',
    ])->assertOk()->assertJsonPath('data.status', 'resolved');
    $this->putJson('/api/staff/complaints/'.$complaint->id, [
        'status' => 'in_review',
    ])->assertStatus(409);

    $notice = $student->notifications()->where('data->status', 'resolved')->first();
    expect($notice->data['status'])->toBe('resolved')
        ->and($notice->data)->not->toHaveKey('staff_note');
});
