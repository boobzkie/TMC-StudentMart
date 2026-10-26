<?php

use App\Models\Complaint;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('admin complaint statistics return selected and previous period counts with real dated buckets', function () {
    $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
    $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
    $now = now();
    $createComplaint = static function (string $subject, string $status, $createdAt) use ($student): Complaint {
        $complaint = Complaint::create([
            'user_id' => $student->id,
            'subject' => $subject,
            'description' => 'Complaint description',
            'status' => $status,
        ]);
        $complaint->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();

        return $complaint;
    };

    $createComplaint('Current pending', 'pending', $now->copy()->subDays(2));
    $createComplaint('Current resolved', 'resolved', $now);
    $createComplaint('Previous rejected', 'rejected', $now->copy()->subDays(8));
    $createComplaint('Older rejected', 'rejected', $now->copy()->subDays(40));

    Sanctum::actingAs($admin);

    $this->getJson('/api/admin/complaints/stats?period=7d')
        ->assertOk()
        ->assertJsonPath('stats.total', 4)
        ->assertJsonPath('stats.period.key', '7d')
        ->assertJsonPath('stats.period.counts.total', 2)
        ->assertJsonPath('stats.period.counts.pending', 1)
        ->assertJsonPath('stats.period.counts.resolved', 1)
        ->assertJsonPath('stats.period.previous_counts.total', 1)
        ->assertJsonCount(7, 'stats.over_time');
});

test('admin complaint list supports period, exact ID search, and safe server sorting', function () {
    $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
    $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
    $now = now();
    $createComplaint = static function (string $subject, string $status, $createdAt) use ($student): Complaint {
        $complaint = Complaint::create([
            'user_id' => $student->id,
            'subject' => $subject,
            'description' => 'Complaint description',
            'status' => $status,
        ]);
        $complaint->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();

        return $complaint;
    };

    $zComplaint = $createComplaint('Z item issue', 'pending', $now->copy()->subDays(2));
    $aComplaint = $createComplaint('A seller issue', 'in_review', $now);
    $createComplaint('Outside selected range', 'rejected', $now->copy()->subDays(40));

    Sanctum::actingAs($admin);

    $response = $this->getJson('/api/admin/complaints?period=7d&per_page=10&sort_by=subject&sort_direction=asc')
        ->assertOk()
        ->assertJsonPath('data.total', 2);
    expect($response->json('data.data.0.id'))->toBe($aComplaint->id)
        ->and($response->json('data.data.1.id'))->toBe($zComplaint->id);

    $this->getJson('/api/admin/complaints?search='.$aComplaint->id)
        ->assertOk()
        ->assertJsonPath('data.total', 1)
        ->assertJsonPath('data.data.0.id', $aComplaint->id);

    $this->getJson('/api/admin/complaints?sort_by=priority')
        ->assertUnprocessable();
});
