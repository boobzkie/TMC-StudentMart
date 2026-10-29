<?php

use App\Models\ActivityLog;
use App\Models\Complaint;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('admin activity history supports server-side filters and pagination', function () {
    $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
    ActivityLog::query()->create([
        'event_type' => 'order',
        'action' => 'Order placed',
        'actor_name' => 'Student A',
        'actor_role' => 'student',
        'subject_type' => 'Order',
        'subject_id' => 10,
        'target' => 'TMC-TEST-10',
        'status' => 'pending',
        'source_type' => 'orders',
        'source_id' => 10,
        'occurred_at' => now()->subMinute(),
    ]);
    ActivityLog::query()->create([
        'event_type' => 'order',
        'action' => 'Order placed',
        'actor_name' => 'Student B',
        'actor_role' => 'student',
        'subject_type' => 'Order',
        'subject_id' => 11,
        'target' => 'TMC-TEST-11',
        'status' => 'confirmed',
        'source_type' => 'orders',
        'source_id' => 11,
        'occurred_at' => now(),
    ]);
    Sanctum::actingAs($admin);

    $this->getJson('/api/admin/activity-logs?period=all&category=order&per_page=1&page=2')
        ->assertOk()
        ->assertJsonPath('pagination.total', 2)
        ->assertJsonPath('pagination.current_page', 2)
        ->assertJsonPath('summary.by_category.order', 2)
        ->assertJsonPath('events.0.target', 'TMC-TEST-10');
});

test('a persisted complaint activity event excludes private complaint text', function () {
    $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
    $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
    $complaint = Complaint::query()->create([
        'user_id' => $student->id,
        'subject' => 'Sensitive subject text',
        'description' => 'Private complaint description',
        'status' => 'pending',
    ]);

    $event = ActivityLog::query()
        ->where('source_type', 'complaints')
        ->where('source_id', $complaint->id)
        ->firstOrFail();

    expect($event->event_type)->toBe('complaint')
        ->and($event->actor_name)->toBe($student->name)
        ->and($event->target)->toBe('Complaint')
        ->and($event->details)->toBeNull()
        ->and(json_encode($event->toArray()))
        ->not->toContain('Private complaint description')
        ->not->toContain('Sensitive subject text');

    Sanctum::actingAs($admin);
    $this->getJson('/api/admin/activity-logs?period=all&search=Private')
        ->assertOk()
        ->assertJsonPath('pagination.total', 0);
});

test('staff cannot access the admin-only activity history endpoint', function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'staff', 'status' => 'active']));

    $this->getJson('/api/admin/activity-logs')->assertForbidden();
});
