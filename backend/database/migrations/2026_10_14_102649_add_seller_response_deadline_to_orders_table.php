<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('seller_response_deadline_at')->nullable()->after('status');
            $table->boolean('needs_attention')->default(false)->after('seller_response_deadline_at');
            $table->index(['status', 'seller_response_deadline_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['status', 'seller_response_deadline_at']);
            $table->dropColumn(['seller_response_deadline_at', 'needs_attention']);
        });
    }
};
