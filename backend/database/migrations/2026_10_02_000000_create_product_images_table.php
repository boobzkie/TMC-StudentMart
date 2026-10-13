<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
            $table->index(['product_id', 'sort_order']);
        });

        DB::table('products')
            ->whereNotNull('image')
            ->where('image', '!=', '')
            ->orderBy('id')
            ->chunkById(100, function ($products): void {
                $timestamp = now();
                $images = $products->map(fn ($product) => [
                    'product_id' => $product->id,
                    'path' => $product->image,
                    'sort_order' => 0,
                    'is_primary' => true,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ])->all();

                if ($images !== []) {
                    DB::table('product_images')->insert($images);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_images');
    }
};