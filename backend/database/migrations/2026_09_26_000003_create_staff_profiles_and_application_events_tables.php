<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('first_name')->nullable();
            $table->string('middle_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('suffix', 30)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('employee_id')->nullable()->unique();
            $table->string('department', 10)->nullable()->index();
            $table->string('position')->nullable();
            $table->string('employment_status', 30)->nullable()->index();
            $table->date('employment_start_date')->nullable();
            $table->string('campus')->nullable();
            $table->text('verification_document_path')->nullable();
            $table->string('application_reference_hash', 64)->nullable()->unique();
            $table->json('permissions')->nullable();
            $table->boolean('is_admin_created')->default(false);
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('decision_reason')->nullable();
            $table->timestamp('archived_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('staff_application_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_profile_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event', 40);
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30)->nullable();
            $table->text('note')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['staff_profile_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_application_events');
        Schema::dropIfExists('staff_profiles');
    }
};