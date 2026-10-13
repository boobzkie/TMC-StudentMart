<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('category_id')
                ->nullable()
                ->after('category')
                ->constrained('categories')
                ->restrictOnDelete();
        });

        DB::table('products')
            ->whereNotNull('category')
            ->orderBy('id')
            ->chunkById(200, function ($products): void {
                $categoryNames = $products
                    ->pluck('category')
                    ->filter(fn ($name) => is_string($name) && trim($name) !== '')
                    ->map(fn ($name) => trim($name))
                    ->unique()
                    ->values();

                if ($categoryNames->isEmpty()) {
                    return;
                }

                $categoryIds = DB::table('categories')
                    ->whereIn('name', $categoryNames)
                    ->pluck('id', 'name');

                foreach ($products as $product) {
                    $name = is_string($product->category)
                        ? trim($product->category)
                        : '';

                    if (isset($categoryIds[$name])) {
                        DB::table('products')
                            ->where('id', $product->id)
                            ->whereNull('category_id')
                            ->update(['category_id' => $categoryIds[$name]]);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropColumn('category_id');
        });
    }
};