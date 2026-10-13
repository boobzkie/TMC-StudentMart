<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function makeStaffPresenceUser(string $role, string $status = 'active'): User
{
    static $sequence = 0;
    $sequence++;

    $user = User::create([
        'name' => ucfirst($role).' Presence '.(string) $sequence,
        'student_id' => $role === 'student' ? 'PRES-STU-'.(string) $sequence : null,
        'email' => $role.'.presence.'.(string) $sequence.'@example.test',
        'password' => 'password123',
        'role' => $role,
        'status' => $status,
    ]);

    if ($role === 'staff') {
        $user->staffProfile()->create([
            'permissions' => [],
            'is_admin_created' => true,
            'reviewed_at' => $status === 'pending' ? null : now(),
        ]);
    }

    return $user;
}

test('staff heartbeat requires an authenticated active staff account and records activity', function () {
    $this->postJson('/api/staff/presence')->assertUnauthorized();

    $student = makeStaffPresenceUser('student');
    Sanctum::actingAs($student);
    $this->postJson('/api/staff/presence')->assertForbidden();

    $staff = makeStaffPresenceUser('staff');
    $staff->staffProfile->forceFill(['last_seen_at' => now()->subMinutes(10)])->save();
    $token = $staff->createToken('presence-test')->plainTextToken;
    Sanctum::actingAs($staff);

    $this->postJson('/api/staff/presence')
        ->assertOk()
        ->assertJsonPath('presence', 'online')
        ->assertJsonStructure(['last_seen_at']);

    expect($staff->fresh()->staffProfile->last_seen_at->greaterThan(now()->subMinute()))->toBeTrue();
});

test('admin staff directory separates approval account and presence status', function () {
    $online = makeStaffPresenceUser('staff');
    $online->staffProfile->forceFill(['last_seen_at' => now()])->save();
    $online->createToken('presence-online');

    $suspended = makeStaffPresenceUser('staff', 'suspended');
    $suspended->staffProfile->forceFill(['last_seen_at' => now()])->save();
    $suspended->createToken('presence-suspended');

    $stale = makeStaffPresenceUser('staff');
    $stale->staffProfile->forceFill(['last_seen_at' => now()->subMinutes(6)])->save();
    $stale->createToken('presence-stale');

    $pending = makeStaffPresenceUser('staff', 'pending');
    $pending->staffProfile->forceFill(['last_seen_at' => now()])->save();

    Sanctum::actingAs(makeStaffPresenceUser('admin'));
    $response = $this->getJson('/api/admin/staff?per_page=50')->assertOk();
    $rows = collect($response->json('staff'))->keyBy('id');

    expect($rows[$online->id]['approval_status'])->toBe('approved')
        ->and($rows[$online->id]['account_status'])->toBe('active')
        ->and($rows[$online->id]['presence'])->toBe('online')
        ->and($rows[$suspended->id]['approval_status'])->toBe('approved')
        ->and($rows[$suspended->id]['account_status'])->toBe('suspended')
        ->and($rows[$suspended->id]['presence'])->toBe('offline')
        ->and($rows[$stale->id]['account_status'])->toBe('active')
        ->and($rows[$stale->id]['presence'])->toBe('offline')
        ->and($rows[$pending->id]['approval_status'])->toBe('pending')
        ->and($rows[$pending->id]['account_status'])->toBe('not_active')
        ->and($rows[$pending->id]['presence'])->toBe('offline');
});

test('staff logout stores last seen and immediately marks the staff offline', function () {
    $staff = makeStaffPresenceUser('staff');
    $staff->staffProfile->forceFill(['last_seen_at' => now()->subMinutes(8)])->save();
    $token = $staff->createToken('logout-presence')->plainTextToken;

    $this->withToken($token)->postJson('/api/logout')->assertOk();

    expect($staff->fresh()->tokens()->count())->toBe(0)
        ->and($staff->fresh()->staffProfile->last_seen_at->greaterThan(now()->subMinute()))->toBeTrue();

    Sanctum::actingAs(makeStaffPresenceUser('admin'));
    $response = $this->getJson('/api/admin/staff?per_page=50')->assertOk();
    $row = collect($response->json('staff'))->firstWhere('id', $staff->id);

    expect($row['presence'])->toBe('offline')
        ->and($row['account_status'])->toBe('active');
});