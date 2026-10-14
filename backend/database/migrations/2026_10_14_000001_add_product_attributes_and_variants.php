<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->json('attributes')->nullable();
        });

        Schema::create('product_variants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('label', 120);
            $table->json('attributes')->nullable();
            $table->unsignedInteger('stock_quantity')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->index(['product_id', 'label']);
            $table->index(['product_id', 'is_active', 'stock_quantity']);
        });

        Schema::table('product_history_events', function (Blueprint $table): void {
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->string('variant_label_snapshot', 120)->nullable();
            $table->json('variant_attributes_snapshot')->nullable();
        });

        Schema::table('order_items', function (Blueprint $table): void {
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->string('variant_label_snapshot', 120)->nullable();
            $table->json('variant_attributes_snapshot')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table): void {
            $table->dropForeign(['product_variant_id']);
            $table->dropColumn([
                'product_variant_id',
                'variant_label_snapshot',
                'variant_attributes_snapshot',
            ]);
        });

        Schema::table('product_history_events', function (Blueprint $table): void {
            $table->dropForeign(['product_variant_id']);
            $table->dropColumn([
                'product_variant_id',
                'variant_label_snapshot',
                'variant_attributes_snapshot',
            ]);
        });

        Schema::dropIfExists('product_variants');

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn('attributes');
        });
    }
};
