<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $missingColumns = array_values(array_filter(
            ['tax_name', 'tax_enabled'],
            fn (string $column): bool => ! Schema::hasColumn('orders', $column),
        ));

        if ($missingColumns !== []) {
            Schema::table('orders', function (Blueprint $table) use ($missingColumns): void {
                if (in_array('tax_name', $missingColumns, true)) {
                    $table->string('tax_name')->nullable();
                }
                if (in_array('tax_enabled', $missingColumns, true)) {
                    $table->boolean('tax_enabled')->default(false);
                }
            });
        }

        DB::table('orders')->whereNull('tax_enabled')->update(['tax_enabled' => false]);

        DB::table('tax_configurations')
            ->where('id', 1)
            ->whereNull('rate_percent')
            ->update([
                'rate_percent' => '5.0000',
                'is_active' => false,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        throw new RuntimeException('Demo tax snapshots are historical order data and cannot be removed safely.');
    }
};
