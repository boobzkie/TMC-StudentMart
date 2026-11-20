<?php

use App\Models\CommissionPolicySetting;
use App\Models\CommissionRate;
use App\Models\Order;
use App\Models\OrderCommission;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
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

function commissionTestOrder(
    User $buyer,
    User $seller,
    string $totalAmount = '200.00',
    string $status = 'ready_for_pickup',
): Order {
    $order = Order::create([
        'order_number' => 'COM-'.Str::upper(Str::random(12)),
        'buyer_id' => $buyer->id,
        'seller_id' => $seller->id,
        'buyer_name_snapshot' => $buyer->name,
        'seller_name_snapshot' => $seller->name,
        'status' => $status,
        'total_amount' => $totalAmount,
    ]);

    $order->items()->create([
        'product_name' => 'Commission test listing',
        'unit_price' => $totalAmount,
        'quantity' => 1,
        'line_total' => $totalAmount,
    ]);

    return $order;
}

function activateCommissionRate($test, User $admin, string $rate): int
{
    Sanctum::actingAs($admin);

    $currentRateId = CommissionPolicySetting::query()->value('current_rate_id');
    $response = $currentRateId
        ? $test->putJson('/api/admin/commission/rates/'.$currentRateId, [
            'rate_percent' => $rate,
        ])
        : $test->postJson('/api/admin/commission/rates', [
            'rate_percent' => $rate,
        ]);

    return $response->assertCreated()->json('rate.id');
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
        ->assertJsonPath('tax.status', 'inactive')
        ->assertJsonPath('tax.rate_percent', '5.0000')
        ->assertJsonPath('tax.is_active', false)
        ->assertJsonPath('records.0.status', 'uncollected');
});

test('commission uses saved product line totals before tax instead of the buyer total', function () {
    $admin = commissionTestUser('admin', 'pre-tax-rate-owner');
    activateCommissionRate($this, $admin, '10');
    $buyer = commissionTestUser('student', 'pre-tax-buyer');
    $seller = commissionTestUser('student', 'pre-tax-seller');
    $order = commissionTestOrder($buyer, $seller, '112.00');
    $order->items()->delete();
    $order->items()->create([
        'product_name' => 'Pre-tax product subtotal',
        'unit_price' => '40.00',
        'quantity' => 2,
        'line_total' => '80.00',
    ]);
    $order->items()->create([
        'product_name' => 'Second product subtotal',
        'unit_price' => '20.00',
        'quantity' => 1,
        'line_total' => '20.00',
    ]);

    completeCommissionOrder($this, $order, $seller);

    $commission = OrderCommission::query()->where('order_id', $order->id)->firstOrFail();
    expect($order->total_amount)->toBe('112.00')
        ->and($commission->sale_amount)->toBe('100.00')
        ->and($commission->commission_amount)->toBe('10.00')
        ->and($commission->status)->toBe('uncollected');

    Sanctum::actingAs($admin);
    $this->getJson('/api/admin/commission')
        ->assertOk()
        ->assertJsonPath('records.0.sale_amount', '100.00')
        ->assertJsonPath('records.0.commission_amount', '10.00')
        ->assertJsonPath('records.0.seller_earnings', '90.00');
});

test('confirmed orders keep the commission rate snapshot when the policy changes before completion', function () {
    $this->travelTo(now()->startOfMinute());
    $admin = commissionTestUser('admin', 'confirmed-rate-owner');
    $firstRateId = activateCommissionRate($this, $admin, '5');
    $buyer = commissionTestUser('student', 'confirmed-rate-buyer');
    $seller = commissionTestUser('student', 'confirmed-rate-seller');
    $order = commissionTestOrder($buyer, $seller, '200.00', 'pending');

    Sanctum::actingAs($seller);
    $this->putJson('/api/seller/orders/'.$order->id, [
        'status' => 'confirmed',
    ])->assertOk()
        ->assertJsonPath('order.status', 'confirmed')
        ->assertJsonPath('order.total_amount', '200.00')
        ->assertJsonPath('order.seller_earnings', '190.00');

    $snapshot = OrderCommission::query()->where('order_id', $order->id)->firstOrFail();
    expect((int) $snapshot->commission_rate_id)->toBe($firstRateId)
        ->and($snapshot->sale_amount)->toBe('200.00')
        ->and($snapshot->rate_percent)->toBe('5.0000')
        ->and($snapshot->commission_amount)->toBe('10.00')
        ->and($snapshot->status)->toBe('pending')
        ->and($snapshot->earned_at)->toBeNull();

    $this->travel(1)->minutes();
    activateCommissionRate($this, $admin, '7.5');

    Sanctum::actingAs($seller);
    $this->putJson('/api/seller/orders/'.$order->id, [
        'status' => 'ready_for_pickup',
    ])->assertOk();
    $this->putJson('/api/seller/orders/'.$order->id, [
        'status' => 'completed',
    ])->assertOk()->assertJsonPath('order.status', 'completed');

    $snapshot->refresh();
    expect((int) $snapshot->commission_rate_id)->toBe($firstRateId)
        ->and($snapshot->rate_percent)->toBe('5.0000')
        ->and($snapshot->commission_amount)->toBe('10.00')
        ->and($snapshot->status)->toBe('uncollected')
        ->and($snapshot->earned_at)->not->toBeNull();
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

test('only one commission rate can be active and administrators update its version', function () {
    $admin = commissionTestUser('admin', 'single-active-rate');
    $firstRateId = activateCommissionRate($this, $admin, '4.5');

    Sanctum::actingAs($admin);
    $this->postJson('/api/admin/commission/rates', [
        'rate_percent' => '6',
    ])->assertUnprocessable()->assertJsonValidationErrors('rate');

    $secondRateId = $this->putJson('/api/admin/commission/rates/'.$firstRateId, [
        'rate_percent' => '6',
    ])->assertCreated()->json('rate.id');

    expect(CommissionPolicySetting::query()->value('current_rate_id'))->toBe($secondRateId)
        ->and(CommissionRate::query()->where('is_deactivation', false)->count())->toBe(2);

    $this->assertDatabaseHas('commission_rates', [
        'id' => $firstRateId,
        'rate_percent' => '4.5000',
    ]);
    $this->assertDatabaseHas('commission_rates', [
        'id' => $secondRateId,
        'rate_percent' => '6.0000',
        'configured_by_name' => $admin->name,
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
    $this->putJson('/api/admin/commission/tax', ['rate_percent' => '8'])->assertForbidden();

    Sanctum::actingAs($admin);
    $this->postJson('/api/admin/commission/rates', ['rate_percent' => 101])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('rate_percent');
});

test('admin can manage demo tax activation and rate changes are recorded in history', function () {
    $admin = commissionTestUser('admin', 'tax-policy-owner');
    Sanctum::actingAs($admin);

    $this->getJson('/api/admin/commission')
        ->assertOk()
        ->assertJsonPath('tax.name', 'StudentMart Demo Tax')
        ->assertJsonPath('tax.status', 'inactive')
        ->assertJsonPath('tax.is_active', false)
        ->assertJsonPath('tax.rate_percent', '5.0000');

    $this->putJson('/api/admin/commission/tax', [
        'rate_percent' => '12.5',
    ])->assertOk()
        ->assertJsonPath('tax.status', 'inactive')
        ->assertJsonPath('tax.rate_percent', '12.5000')
        ->assertJsonPath('tax.is_active', false);

    $this->putJson('/api/admin/commission/tax', [
        'is_active' => true,
    ])->assertOk()
        ->assertJsonPath('tax.status', 'active')
        ->assertJsonPath('tax.rate_percent', '12.5000');

    $this->putJson('/api/admin/commission/tax', [
        'rate_percent' => '12.75',
    ])->assertOk();

    $this->getJson('/api/admin/commission')
        ->assertOk()
        ->assertJsonPath('tax.status', 'active')
        ->assertJsonPath('tax.rate_percent', '12.7500')
        ->assertJsonPath('tax_history.0.action', 'updated')
        ->assertJsonPath('tax_history.0.changed_by', $admin->name)
        ->assertJsonPath('tax_history.1.action', 'activated')
        ->assertJsonPath('tax_history.1.is_active', true)
        ->assertJsonPath('tax_history.2.action', 'updated')
        ->assertJsonPath('tax_history.2.changed_by', $admin->name);

    $this->putJson('/api/admin/commission/tax', ['is_active' => false])
        ->assertOk()
        ->assertJsonPath('tax.status', 'inactive')
        ->assertJsonPath('tax.is_active', false);

    $this->assertDatabaseCount('tax_configuration_history', 4);
    $this->assertDatabaseHas('tax_configurations', [
        'id' => 1,
        'rate_percent' => '12.7500',
        'is_active' => false,
        'configured_by_name' => $admin->name,
    ]);
    $this->assertDatabaseHas('tax_configuration_history', [
        'action' => 'deactivated',
        'previous_is_active' => true,
        'is_active' => false,
        'changed_by' => $admin->id,
    ]);
});

test('tax rates reject invalid precision and values outside the percentage range', function () {
    Sanctum::actingAs(commissionTestUser('admin', 'tax-validation'));

    $this->putJson('/api/admin/commission/tax', ['rate_percent' => '4.12345'])
        ->assertUnprocessable()->assertJsonValidationErrors('rate_percent');
    $this->putJson('/api/admin/commission/tax', ['rate_percent' => 100.01])
        ->assertUnprocessable()->assertJsonValidationErrors('rate_percent');
});

test('admin demo tax dashboard reports paid tax snapshots and recent order details', function () {
    $admin = commissionTestUser('admin', 'demo-tax-dashboard');
    Sanctum::actingAs($admin);

    $order = Order::query()->create([
        'order_number' => 'DEMO-TAX-PAID-1',
        'buyer_name_snapshot' => 'Demo Buyer',
        'seller_name_snapshot' => 'Demo Seller',
        'status' => 'pending',
        'payment_status' => 'paid',
        'product_subtotal' => '1000.00',
        'tax_name' => 'StudentMart Demo Tax',
        'tax_enabled' => true,
        'tax_rate_percent' => '5.0000',
        'tax_amount' => '50.00',
        'total_amount' => '1050.00',
    ]);

    $this->getJson('/api/admin/commission')
        ->assertOk()
        ->assertJsonPath('tax_summary.total_demo_tax_collected', '50.00')
        ->assertJsonPath('tax_summary.collected_order_count', 1)
        ->assertJsonPath('tax_summary.recent_orders.0.id', $order->id)
        ->assertJsonPath('tax_summary.recent_orders.0.tax_name', 'StudentMart Demo Tax')
        ->assertJsonPath('tax_summary.recent_orders.0.tax_enabled', true)
        ->assertJsonPath('tax_summary.recent_orders.0.tax_amount', '50.00')
        ->assertJsonPath('tax_summary.by_date.0.tax_amount', '50.00');
});

test('financial schema migrations can resume partial DDL without duplicate columns, tables, keys, or seed rows', function () {
    Schema::table('orders', function (Blueprint $table): void {
        $table->dropColumn('product_subtotal');
        $table->dropColumn(['tax_name', 'tax_enabled']);
    });
    Schema::table('commission_rates', function (Blueprint $table): void {
        $table->dropColumn('configured_by_name');
    });
    Schema::dropIfExists('tax_configuration_history');
    Schema::dropIfExists('tax_configurations');
    Schema::dropIfExists('commission_policy_settings');

    // Recreate the partial state left by a DDL failure after the table was
    // created but before its foreign key could be added.
    Schema::create('commission_policy_settings', function (Blueprint $table): void {
        $table->unsignedTinyInteger('id')->primary();
        $table->unsignedBigInteger('current_rate_id')->nullable()->unique();
        $table->timestamps();
    });

    $taxSnapshotMigration = require database_path('migrations/2026_10_30_000002_add_tax_snapshots_to_orders.php');
    $policyMigration = require database_path('migrations/2026_10_30_000003_create_admin_policy_configuration_tables.php');
    $demoTaxMigration = require database_path('migrations/2026_10_30_000004_enable_demo_tax_snapshots.php');
    $taxSnapshotMigration->up();
    $policyMigration->up();
    $demoTaxMigration->up();
    $taxSnapshotMigration->up();
    $policyMigration->up();
    $demoTaxMigration->up();

    expect(Schema::hasColumns('orders', ['product_subtotal', 'tax_rate_percent', 'tax_amount', 'tax_name', 'tax_enabled']))->toBeTrue()
        ->and(Schema::hasColumn('commission_rates', 'configured_by_name'))->toBeTrue()
        ->and(Schema::hasTable('commission_policy_settings'))->toBeTrue()
        ->and(Schema::hasTable('tax_configurations'))->toBeTrue()
        ->and(Schema::hasTable('tax_configuration_history'))->toBeTrue();

    $settingsIndexes = collect(Schema::getIndexes('commission_policy_settings'));
    expect($settingsIndexes->contains(fn (array $index): bool => $index['unique'] && $index['columns'] === ['current_rate_id']
    ))->toBeTrue();

    $settingsForeignKeys = collect(Schema::getForeignKeys('commission_policy_settings'));
    $taxForeignKeys = collect(Schema::getForeignKeys('tax_configurations'));
    $historyForeignKeys = collect(Schema::getForeignKeys('tax_configuration_history'));
    expect($settingsForeignKeys->contains(fn (array $foreignKey): bool => $foreignKey['columns'] === ['current_rate_id']
        && $foreignKey['foreign_table'] === 'commission_rates'
        && $foreignKey['foreign_columns'] === ['id']
    ))->toBeTrue()
        ->and($taxForeignKeys->contains(fn (array $foreignKey): bool => $foreignKey['columns'] === ['configured_by']
            && $foreignKey['foreign_table'] === 'users'
        ))->toBeTrue()
        ->and($historyForeignKeys->contains(fn (array $foreignKey): bool => $foreignKey['columns'] === ['changed_by']
            && $foreignKey['foreign_table'] === 'users'
        ))->toBeTrue();

    $historyIndexes = collect(Schema::getIndexes('tax_configuration_history'));
    expect($historyIndexes->contains(fn (array $index): bool => $index['columns'] === ['created_at']))->toBeTrue();

    $this->assertDatabaseCount('commission_policy_settings', 1);
    $this->assertDatabaseCount('tax_configurations', 1);
    $this->assertDatabaseCount('tax_configuration_history', 0);
});
