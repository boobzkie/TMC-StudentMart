<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        /*
        |--------------------------------------------------------------------------
        | ADMIN ACCOUNT
        |--------------------------------------------------------------------------
        */

        $this->call([
            AdminUserSeeder::class,
        ]);
    }
}
