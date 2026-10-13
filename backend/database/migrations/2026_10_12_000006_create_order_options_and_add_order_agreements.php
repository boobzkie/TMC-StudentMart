<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_payment_methods', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 100)->unique();
            $table->text('instructions')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('pickup_locations', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 120);
            $table->string('building_room', 120)->nullable();
            $table->string('campus_area', 120)->nullable();
            $table->text('instructions')->nullable();
            $table->string('operating_hours', 120)->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->foreignId('payment_method_id')->nullable()->constrained('order_payment_methods')->nullOnDelete();
            $table->string('payment_method_name_snapshot', 100)->nullable();
            $table->text('payment_method_instructions_snapshot')->nullable();
            $table->foreignId('pickup_location_id')->nullable()->constrained('pickup_locations')->nullOnDelete();
            $table->string('pickup_location_name_snapshot', 120)->nullable();
            $table->string('pickup_location_area_snapshot', 240)->nullable();
            $table->text('pickup_location_details_snapshot')->nullable();
            $table->text('pickup_location_instructions_snapshot')->nullable();
            $table->string('pickup_location_hours_snapshot', 120)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropForeign(['payment_method_id']);
            $table->dropForeign(['pickup_location_id']);
            $table->dropColumn([
                'payment_method_id',
                'payment_method_name_snapshot',
                'payment_method_instructions_snapshot',
                'pickup_location_id',
                'pickup_location_name_snapshot',
                'pickup_location_area_snapshot',
                'pickup_location_details_snapshot',
                'pickup_location_instructions_snapshot',
                'pickup_location_hours_snapshot',
            ]);
        });

        Schema::dropIfExists('pickup_locations');
        Schema::dropIfExists('order_payment_methods');
    }
};
