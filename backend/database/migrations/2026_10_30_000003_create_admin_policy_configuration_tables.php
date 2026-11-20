<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('commission_rates', 'configured_by_name')) {
            Schema::table('commission_rates', function (Blueprint $table): void {
                $table->string('configured_by_name')->nullable();
            });
        }

        $this->backfillCommissionActorNames();

        if (! Schema::hasTable('commission_policy_settings')) {
            Schema::create('commission_policy_settings', function (Blueprint $table): void {
                $table->unsignedTinyInteger('id')->primary();
                $table->foreignId('current_rate_id')->nullable()->unique()
                    ->constrained('commission_rates')->nullOnDelete();
                $table->timestamps();
            });
        }
        $this->assertExpectedColumns('commission_policy_settings', [
            'id',
            'current_rate_id',
            'created_at',
            'updated_at',
        ]);
        $this->ensureForeignKey(
            'commission_policy_settings',
            'current_rate_id',
            'commission_rates',
            'id',
        );

        if (! DB::table('commission_policy_settings')->where('id', 1)->exists()) {
            $latestRate = DB::table('commission_rates')
                ->where('effective_at', '<=', now())
                ->orderByDesc('effective_at')
                ->orderByDesc('id')
                ->first();
            $currentRateId = $latestRate && ! (bool) $latestRate->is_deactivation
                ? $latestRate->id
                : null;

            DB::table('commission_policy_settings')->insert([
                'id' => 1,
                'current_rate_id' => $currentRateId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (! Schema::hasTable('tax_configurations')) {
            Schema::create('tax_configurations', function (Blueprint $table): void {
                $table->unsignedTinyInteger('id')->primary();
                $table->decimal('rate_percent', 7, 4)->nullable();
                $table->boolean('is_active')->default(false);
                $table->foreignId('configured_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('configured_by_name')->nullable();
                $table->timestamps();
            });
        }
        $this->assertExpectedColumns('tax_configurations', [
            'id',
            'rate_percent',
            'is_active',
            'configured_by',
            'configured_by_name',
            'created_at',
            'updated_at',
        ]);
        $this->ensureForeignKey('tax_configurations', 'configured_by', 'users', 'id');

        if (! DB::table('tax_configurations')->where('id', 1)->exists()) {
            DB::table('tax_configurations')->insert([
                'id' => 1,
                'rate_percent' => null,
                'is_active' => false,
                'configured_by' => null,
                'configured_by_name' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (! Schema::hasTable('tax_configuration_history')) {
            Schema::create('tax_configuration_history', function (Blueprint $table): void {
                $table->id();
                $table->decimal('previous_rate_percent', 7, 4)->nullable();
                $table->decimal('rate_percent', 7, 4)->nullable();
                $table->boolean('previous_is_active')->nullable();
                $table->boolean('is_active')->default(false);
                $table->string('action', 24);
                $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('changed_by_name')->nullable();
                $table->timestamps();

                $table->index('created_at');
            });
        }
        $this->assertExpectedColumns('tax_configuration_history', [
            'id',
            'previous_rate_percent',
            'rate_percent',
            'previous_is_active',
            'is_active',
            'action',
            'changed_by',
            'changed_by_name',
            'created_at',
            'updated_at',
        ]);
        $this->ensureForeignKey('tax_configuration_history', 'changed_by', 'users', 'id');
    }

    private function ensureForeignKey(
        string $table,
        string $column,
        string $referencedTable,
        string $referencedColumn,
    ): void {
        $foreignKeys = collect(Schema::getForeignKeys($table));
        $existingForeignKey = $foreignKeys->first(
            fn (array $foreignKey): bool => $foreignKey['columns'] === [$column],
        );

        if ($existingForeignKey !== null) {
            $matchesExpected = $existingForeignKey['foreign_table'] === $referencedTable
                && $existingForeignKey['foreign_columns'] === [$referencedColumn]
                && strtolower((string) ($existingForeignKey['on_delete'] ?? '')) === 'set null';

            if (! $matchesExpected) {
                throw new RuntimeException(
                    'Cannot resume the admin policy migration: '.$table.'.'.$column.' has an unexpected foreign key.'
                );
            }

            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($column, $referencedTable, $referencedColumn): void {
            $blueprint->foreign($column)
                ->references($referencedColumn)
                ->on($referencedTable)
                ->nullOnDelete();
        });
    }

    private function assertExpectedColumns(string $table, array $expectedColumns): void
    {
        $missingColumns = array_values(array_diff($expectedColumns, Schema::getColumnListing($table)));
        if ($missingColumns !== []) {
            throw new RuntimeException(
                'Cannot resume the admin policy migration: '.$table.' is missing expected columns: '.implode(', ', $missingColumns).'.'
            );
        }
    }

    private function backfillCommissionActorNames(): void
    {
        DB::table('commission_rates')
            ->leftJoin('users', 'users.id', '=', 'commission_rates.configured_by')
            ->select([
                'commission_rates.id',
                'commission_rates.effective_at',
                'users.name as configured_by_name',
            ])
            ->whereNull('commission_rates.configured_by_name')
            ->orderBy('commission_rates.id')
            ->chunkById(200, function ($rates): void {
                foreach ($rates as $rate) {
                    DB::table('commission_rates')
                        ->where('id', $rate->id)
                        ->update([
                            'configured_by_name' => $rate->configured_by_name,
                            // MySQL's legacy column has ON UPDATE CURRENT_TIMESTAMP.
                            'effective_at' => $rate->effective_at,
                        ]);
                }
            }, 'commission_rates.id', 'id');
    }

    public function down(): void
    {
        Schema::dropIfExists('tax_configuration_history');
        Schema::dropIfExists('tax_configurations');
        Schema::dropIfExists('commission_policy_settings');

        Schema::table('commission_rates', function (Blueprint $table): void {
            $table->dropColumn('configured_by_name');
        });
    }
};
