<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {

            if (! Schema::hasColumn('users', 'role')) {
                $table->string('role')
                    ->default('student')
                    ->after('password');
            }

            if (! Schema::hasColumn('users', 'status')) {
                $table->string('status')
                    ->default('active')
                    ->after('role');
            }

            if (! Schema::hasColumn('users', 'profile_picture')) {
                $table->string('profile_picture')
                    ->nullable()
                    ->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {

            if (Schema::hasColumn('users', 'profile_picture')) {
                $table->dropColumn('profile_picture');
            }

            if (Schema::hasColumn('users', 'status')) {
                $table->dropColumn('status');
            }

            if (Schema::hasColumn('users', 'role')) {
                $table->dropColumn('role');
            }
        });
    }
};
