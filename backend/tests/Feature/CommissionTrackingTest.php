<?php

use App\Models\CommissionRate;
use App\Models\Order;
use App\Models\OrderCommission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function commissionTestUser(string $role, string $suffix): User
{
    return User::create([
        'name' => ucfirst($role).' '.$suffix,
        'student_id' => $role === 'student' ? 'COM-'.$suffix : null,
        'email' => strtolower($role.'-'.$suffix).'@example.test',
        'password' => 'password123',
        'role' => $role,
        'status' => 'active',
    ]);
}

function commissionTestOrder(User $buyer, User $seller, string $totalAmount = '200.00'): Order
{
    return Order::create([
        'order_number' => 'COM-'.Str::upper(Str::random(12)),
        'buyer_id' => $buyer->id,
        'seller_id' => $seller->id,
        'buyer_name_snapshot' => $buyer->name,
        'seller_name_snapshot' => $seller->name,
        'status' => 'ready_for_pickup',
        'total_amount' => $totalAmount,
    ]);
}

function activateCommissionRate($test, User $admin, string $rate): int
{
    Sanctum::actingAs($admin);

    return $test->postJson('/api/admin/commission/rates', [
        'rate_percent' => $rate,
    ])->assertCreated()->json('rate.id');
}

function completeCommissionOrder($test, Order $order, User $seller): void
{
    Sanctum::actingAs($seller);

    $test->putJson('/api/seller/orders/'.$order->id, [
        'status' => 'completed',
    ])->assertOk()->assertJsonPath('order.status', 'completed');
}

test('completed orders snapshot the active commission rate and sale total once', function () {
    $admin = commissionTestUser('admin', 'rate-owner');
    $rateId = activateCommissionRate($this, $admin, '5.25');
    $buyer = commissionTestUser('student', 'rate-buyer');
    $seller = commissionTestUser('student', 'rate-seller');
    $order = commissionTestOrder($buyer, $seller, '200.00');

    completeCommissionOrder($this, $order, $seller);

    $commission = OrderCommission::query()->where('order_id', $order->id)->firstOrFail();

    expect((int) $commission->commission_rate_id)->toBe($rateId)
        ->and($commission->sale_amount)->toBe('200.00')
        ->and($commission->rate_percent)->toBe('5.2500')
        ->and($commission->commission_amount)->toBe('10.50')
        ->and($commission->status)->toBe('uncollected')
        ->and($commission->earned_at)->not->toBeNull();

    $this->assertDatabaseCount('order_commissions', 1);
    Sanctum::actingAs($admin);
    $this->getJson('/api/admin/commission')
        ->assertOk()
        ->assertJsonPath('summary.total_earned', '10.50')
        ->assertJsonPath('summary.total_uncollected', '10.50')
        ->assertJsonPath('tax.status', 'unconfigured')
        ->assertJsonPath('records.0.status', 'uncollected');
});

test('completion without an applicable rate is recorded without estimating commission', function () {
    $buyer = commissionTestUser('student', 'no-rate-buyer');
    $seller = commissionTestUser('student', 'no-rate-seller');
    $order = commissionTestOrder($buyer, $seller, '450.00');

    completeCommissionOrder($this, $order, $seller);

    $commission = OrderCommission::query()->where('order_id', $order->id)->firstOrFail();
    expect($commission->status)->toBe('unconfigured')
        ->and($commission->sale_amount)->toBe('450.00')
        ->and($commission->rate_percent)->toBeNull()
        ->and($commission->commission_amount)->toBeNull()
        ->and($commission->earned_at)->toBeNull();

    $admin = commissionTestUser('admin', 'no-rate-viewer');
    Sanctum::actingAs($admin);
    $this->getJson('/api/admin/commission')
        ->assertOk()
        ->assertJsonPath('summary.total_earned', '0.00')
        ->assertJsonPath('summary.unconfigured_orders', 1)
        ->assertJsonPath('records.0.commission_amount', null);
});

test('admin can record actual collection once and the API records who and when', function () {
    $admin = commissionTestUser('admin', 'collector');
    activateCommissionRate($this, $admin, '10');
    $buyer = commissionTestUser('student', 'collection-buyer');
    $seller = commissionTestUser('student', 'collection-seller');
    $order = commissionTestOrder($buyer, $seller, '125.00');
    completeCommissionOrder($this, $order, $seller);
    $commission = OrderCommission::query()->where('order_id', $order->id)->firstOrFail();

    $staff = commissionTestUser('staff', 'unauthorized-collector');
    Sanctum::actingAs($staff);
    $this->putJson('/api/admin/order-commissions/'.$commission->id.'/collect', [
        'confirmed' => true,
    ])->assertForbidden();

    Sanctum::actingAs($admin);
    $this->putJson('/api/admin/order-commissions/'.$commission->id.'/collect', [
        'confirmed' => true,
        'collection_reference' => 'RCPT-2026-001',
        'collection_note' => 'Received in person.',
    ])->assertOk()->assertJsonPath('commission.status', 'collected');

    $commission->refresh();
    expect($commission->status)->toBe('collected')
        ->and((int) $commission->collected_by)->toBe($admin->id)
        ->and($commission->collection_reference)->toBe('RCPT-2026-001')
        ->and($commission->collected_at)->not->toBeNull();

    $this->putJson('/api/admin/order-commissions/'.$commission->id.'/collect', [
        'confirmed' => true,
    ])->assertUnprocessable();

    $this->getJson('/api/admin/commission')
        ->assertOk()
        ->assertJsonPath('summary.total_earned', '12.50')
        ->assertJsonPath('summary.total_collected', '12.50')
        ->assertJsonPath('summary.total_uncollected', '0.00');
});

test('rate changes preserve the rate snapshots already applied to completed orders', function () {
    $this->travelTo(now()->startOfMinute());
    $admin = commissionTestUser('admin', 'rate-history-admin');
    activateCommissionRate($this, $admin, '5');
    $buyer = commissionTestUser('student', 'history-buyer');
    $seller = commissionTestUser('student', 'history-seller');
    $firstOrder = commissionTestOrder($buyer, $seller, '100.00');
    completeCommissionOrder($this, $firstOrder, $seller);

    $this->travel(1)->minutes();
    activateCommissionRate($this, $admin, '7.5');
    $secondOrder = commissionTestOrder($buyer, $seller, '100.00');
    completeCommissionOrder($this, $secondOrder, $seller);

    expect(OrderCommission::query()->where('order_id', $firstOrder->id)->value('rate_percent'))->toBe('5.0000')
        ->and(OrderCommission::query()->where('order_id', $firstOrder->id)->value('commission_amount'))->toBe('5.00')
        ->and(OrderCommission::query()->where('order_id', $secondOrder->id)->value('rate_percent'))->toBe('7.5000')
        ->and(OrderCommission::query()->where('order_id', $secondOrder->id)->value('commission_amount'))->toBe('7.50');

    $this->assertDatabaseCount('commission_rates', 2);
    $this->assertDatabaseCount('order_commissions', 2);
});

test('updating the active rate appends a version and preserves order snapshots', function () {
    $this->travelTo(now()->startOfMinute());
    $admin = commissionTestUser('admin', 'rate-editor');
    $firstRateId = activateCommissionRate($this, $admin, '5');
    $buyer = commissionTestUser('student', 'rate-edit-buyer');
    $seller = commissionTestUser('student', 'rate-edit-seller');
    $firstOrder = commissionTestOrder($buyer, $seller, '100.00');

    completeCommissionOrder($this, $firstOrder, $seller);
    $this->travel(1)->minutes();

    Sanctum::actingAs($admin);
    $response = $this->putJson('/api/admin/commission/rates/'.$firstRateId, [
        'rate_percent' => '7.5',
    ])->assertCreated();
    $secondRateId = $response->json('rate.id');

    $secondOrder = commissionTestOrder($buyer, $seller, '100.00');
    completeCommissionOrder($this, $secondOrder, $seller);

    expect(OrderCommission::query()->where('order_id', $firstOrder->id)->value('rate_percent'))->toBe('5.0000')
        ->and(OrderCommission::query()->where('order_id', $secondOrder->id)->value('rate_percent'))->toBe('7.5000')
        ->and(OrderCommission::query()->where('order_id', $secondOrder->id)->value('commission_amount'))->toBe('7.50');

    $this->assertDatabaseCount('commission_rates', 2);
    $this->assertDatabaseHas('commission_rates', [
        'id' => $firstRateId,
        'rate_percent' => '5.0000',
        'is_deactivation' => false,
    ]);
    $this->assertDatabaseHas('commission_rates', [
        'id' => $secondRateId,
        'rate_percent' => '7.5000',
        'is_deactivation' => false,
    ]);
});

test('deactivating the current rate preserves history and applies no commission going forward', function () {
    $this->travelTo(now()->startOfMinute());
    $admin = commissionTestUser('admin', 'rate-deactivator');
    $rateId = activateCommissionRate($this, $admin, '5');
    $buyer = commissionTestUser('student', 'rate-delete-buyer');
    $seller = commissionTestUser('student', 'rate-delete-seller');
    $firstOrder = commissionTestOrder($buyer, $seller, '100.00');

    completeCommissionOrder($this, $firstOrder, $seller);
    $this->travel(1)->minutes();

    Sanctum::actingAs($admin);
    $response = $this->deleteJson('/api/admin/commission/rates/'.$rateId)->assertCreated();
    $deactivationId = $response->json('rate.id');

    $secondOrder = commissionTestOrder($buyer, $seller, '100.00');
    completeCommissionOrder($this, $secondOrder, $seller);
    $firstCommission = OrderCommission::query()->where('order_id', $firstOrder->id)->firstOrFail();
    $secondCommission = OrderCommission::query()->where('order_id', $secondOrder->id)->firstOrFail();

    expect($firstCommission->rate_percent)->toBe('5.0000')
        ->and($firstCommission->commission_amount)->toBe('5.00')
        ->and($secondCommission->commission_rate_id)->toBe($deactivationId)
        ->and($secondCommission->rate_percent)->toBe('0.0000')
        ->and($secondCommission->commission_amount)->toBe('0.00')
        ->and($secondCommission->status)->toBe('not_due');

    $this->assertDatabaseCount('commission_rates', 2);
    $this->assertDatabaseHas('commission_rates', [
        'id' => $rateId,
        'rate_percent' => '5.0000',
        'is_deactivation' => false,
    ]);
    $this->assertDatabaseHas('commission_rates', [
        'id' => $deactivationId,
        'rate_percent' => '0.0000',
        'is_deactivation' => true,
    ]);

    Sanctum::actingAs($admin);
    $this->getJson('/api/admin/commission')
        ->assertOk()
        ->assertJsonPath('current_rate', null)
        ->assertJsonPath('rates.0.is_deactivation', true);
});

test('historical rates cannot be updated or deactivated', function () {
    $this->travelTo(now()->startOfMinute());
    $admin = commissionTestUser('admin', 'rate-history-protection');
    $historicalRateId = activateCommissionRate($this, $admin, '5');
    $this->travel(1)->minutes();
    activateCommissionRate($this, $admin, '7');

    Sanctum::actingAs($admin);
    $this->putJson('/api/admin/commission/rates/'.$historicalRateId, [
        'rate_percent' => '9',
    ])->assertUnprocessable()->assertJsonValidationErrors('rate');
    $this->deleteJson('/api/admin/commission/rates/'.$historicalRateId)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('rate');

    $this->assertDatabaseCount('commission_rates', 2);
});

test('legacy completed orders remain unrated instead of receiving an invented historical commission', function () {
    $buyer = commissionTestUser('student', 'legacy-buyer');
    $seller = commissionTestUser('student', 'legacy-seller');
    $legacyOrder = commissionTestOrder($buyer, $seller, '99.00');
    $legacyOrder->forceFill(['status' => 'completed'])->save();
    CommissionRate::query()->create([
        'rate_percent' => '15.0000',
        'effective_at' => now(),
        'configured_by' => commissionTestUser('admin', 'legacy-admin')->id,
    ]);

    $admin = commissionTestUser('admin', 'legacy-viewer');
    Sanctum::actingAs($admin);
    $this->getJson('/api/admin/commission')
        ->assertOk()
        ->assertJsonPath('summary.total_earned', '0.00')
        ->assertJsonPath('summary.unconfigured_orders', 1)
        ->assertJsonPath('records.0.status', 'historical_unrated')
        ->assertJsonPath('records.0.commission_amount', null)
        ->assertJsonPath('records.0.completed_at', null);

    $this->assertDatabaseMissing('order_commissions', ['order_id' => $legacyOrder->id]);
});

test('staff cannot read or change commission policy and invalid rates are rejected', function () {
    $admin = commissionTestUser('admin', 'commission-policy-owner');
    $rateId = activateCommissionRate($this, $admin, '5');
    $staff = commissionTestUser('staff', 'finance-staff');
    Sanctum::actingAs($staff);
    $this->getJson('/api/admin/commission')->assertForbidden();
    $this->postJson('/api/admin/commission/rates', ['rate_percent' => 101])->assertForbidden();
    $this->putJson('/api/admin/commission/rates/'.$rateId, ['rate_percent' => 8])->assertForbidden();
    $this->deleteJson('/api/admin/commission/rates/'.$rateId)->assertForbidden();

    Sanctum::actingAs($admin);
    $this->postJson('/api/admin/commission/rates', ['rate_percent' => 101])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('rate_percent');
});
