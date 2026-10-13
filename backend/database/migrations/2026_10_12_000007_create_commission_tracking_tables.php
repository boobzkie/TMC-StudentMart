<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commission_rates', function (Blueprint $table): void {
            $table->id();
            $table->decimal('rate_percent', 7, 4);
            $table->timestamp('effective_at', 6)->index();
            $table->foreignId('configured_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->timestamp('completed_at')->nullable()->index();
        });

        Schema::create('order_commissions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders')->restrictOnDelete();
            $table->foreignId('commission_rate_id')->nullable()->constrained('commission_rates')->nullOnDelete();
            $table->decimal('sale_amount', 10, 2);
            $table->decimal('rate_percent', 7, 4)->nullable();
            $table->decimal('commission_amount', 10, 2)->nullable();
            $table->string('status', 24)->default('unconfigured')->index();
            $table->timestamp('earned_at')->nullable()->index();
            $table->timestamp('collected_at')->nullable();
            $table->foreignId('collected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('collection_reference', 120)->nullable();
            $table->text('collection_note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_commissions');

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn('completed_at');
        });

        Schema::dropIfExists('commission_rates');
    }
};
