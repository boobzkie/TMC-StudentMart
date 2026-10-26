<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $missingColumns = array_values(array_filter(
            ['email_notifications_enabled', 'in_app_notifications_enabled'],
            static fn (string $column): bool => ! Schema::hasColumn('users', $column),
        ));

        if ($missingColumns === []) {
            return;
        }

        Schema::table('users', function (Blueprint $table) use ($missingColumns): void {
            foreach ($missingColumns as $column) {
                $table->boolean($column)
                    ->default($column === 'in_app_notifications_enabled');
            }
        });
    }

    public function down(): void
    {
        $existingColumns = array_values(array_filter(
            ['email_notifications_enabled', 'in_app_notifications_enabled'],
            static fn (string $column): bool => Schema::hasColumn('users', $column),
        ));

        if ($existingColumns === []) {
            return;
        }

        Schema::table('users', function (Blueprint $table) use ($existingColumns): void {
            $table->dropColumn($existingColumns);
        });
    }
};