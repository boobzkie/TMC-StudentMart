<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('complaints', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->nullOnDelete();

            $table->string('subject', 150);

            $table->text('description');

            $table->enum('status', [
                'pending',
                'in_review',
                'resolved',
                'rejected',
            ])->default('pending');

            $table->text('admin_response')
                ->nullable();

            $table->timestamp('resolved_at')
                ->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index('user_id');
            $table->index('product_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('complaints');
    }
};