<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->string('idempotency_key', 128);
            $table->char('request_hash', 64);
            $table->json('order_ids');
            $table->timestamps();

            $table->unique(['buyer_id', 'idempotency_key'], 'order_idempotency_buyer_key_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_idempotency_keys');
    }
};
