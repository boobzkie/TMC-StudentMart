<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;
use RuntimeException;

class AdminUserSeeder extends Seeder
{
    /**
     * Create the initial administrator only when explicitly configured.
     *
     * Existing accounts are never reactivated or assigned a new password by
     * rerunning the seeder.
     */
    public function run(): void
    {
        $seedConfig = config('portal.admin_seed', []);
        $email = strtolower(trim((string) ($seedConfig['email'] ?? '')));
        $password = (string) ($seedConfig['password'] ?? '');

        if ($email === '' || $password === '') {
            $this->command?->warn(
                'AdminUserSeeder skipped: configure ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in the local backend environment to create the initial administrator.'
            );

            return;
        }

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('ADMIN_SEED_EMAIL must be a valid email address.');
        }

        if (strlen($password) < 12) {
            throw new InvalidArgumentException('ADMIN_SEED_PASSWORD must be at least 12 characters long.');
        }

        $existingUser = User::query()->where('email', $email)->first();

        if ($existingUser !== null) {
            if (! $existingUser->isAdmin()) {
                throw new RuntimeException(
                    'The configured administrator email already belongs to a non-administrator account.'
                );
            }

            $this->command?->info(
                'An administrator with the configured email already exists; its account status and password were left unchanged.'
            );

            return;
        }

        User::create([
            'name' => (string) ($seedConfig['name'] ?? 'TMC System Administrator'),
            'student_id' => null,
            'email' => $email,
            'contact_number' => null,
            'password' => Hash::make($password),
            'role' => 'admin',
            'status' => 'active',
            'profile_picture' => null,
        ]);

        $this->command?->info('Created the initial administrator account.');
    }
}
