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
            ['product_subtotal', 'tax_rate_percent', 'tax_amount'],
            fn (string $column): bool => ! Schema::hasColumn('orders', $column),
        ));

        if ($missingColumns !== []) {
            Schema::table('orders', function (Blueprint $table) use ($missingColumns): void {
                if (in_array('product_subtotal', $missingColumns, true)) {
                    $table->decimal('product_subtotal', 10, 2)->nullable();
                }
                if (in_array('tax_rate_percent', $missingColumns, true)) {
                    $table->decimal('tax_rate_percent', 7, 4)->nullable();
                }
                if (in_array('tax_amount', $missingColumns, true)) {
                    $table->decimal('tax_amount', 10, 2)->default(0);
                }
            });
        }

        DB::table('orders')->whereNull('product_subtotal')->update([
            'product_subtotal' => DB::raw('total_amount'),
        ]);
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['product_subtotal', 'tax_rate_percent', 'tax_amount']);
        });
    }
};
