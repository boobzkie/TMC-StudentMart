<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add public social profile links to student accounts.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('facebook_url', 2048)->nullable();
            $table->string('instagram_url', 2048)->nullable();
            $table->string('tiktok_url', 2048)->nullable();
        });
    }

    /**
     * Remove the social profile links.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'facebook_url',
                'instagram_url',
                'tiktok_url',
            ]);
        });
    }
};
