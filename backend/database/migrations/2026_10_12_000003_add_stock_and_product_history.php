<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->unsignedInteger('stock_quantity')->default(1)->after('status');
            $table->timestamp('sold_out_at')->nullable()->after('stock_quantity');
            $table->timestamp('archived_at')->nullable()->after('sold_out_at');
            $table->index(['status', 'sold_out_at']);
        });

        Schema::create('product_history_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('event', 40);
            $table->unsignedInteger('stock_before')->nullable();
            $table->unsignedInteger('stock_after')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['product_id', 'created_at']);
            $table->index(['order_id', 'event']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_history_events');

        Schema::table('products', function (Blueprint $table): void {
            $table->dropIndex(['status', 'sold_out_at']);
            $table->dropColumn(['stock_quantity', 'sold_out_at', 'archived_at']);
        });
    }
};
