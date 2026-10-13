<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('student_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        if (DB::table('users')->whereNull('student_id')->exists()) {
            throw new RuntimeException(
                'Cannot make student_id required while staff accounts have a null student_id. Assign student IDs or remove those staff accounts first.'
            );
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('student_id')->nullable(false)->change();
        });
    }
};