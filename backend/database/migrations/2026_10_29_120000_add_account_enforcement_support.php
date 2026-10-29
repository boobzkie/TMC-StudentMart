<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->timestamp('suspended_until')->nullable()->index();
        });

        Schema::create('account_enforcement_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 40);
            $table->text('reason');
            $table->unsignedTinyInteger('duration_days')->nullable();
            $table->timestamp('suspended_until')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_enforcement_events');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['suspended_until']);
            $table->dropColumn('suspended_until');
        });
    }
};
