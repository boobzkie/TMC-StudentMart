<?php

namespace App\Services;

use App\Models\AccountEnforcementEvent;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AccountEnforcementService
{
    public function apply(
        User $target,
        User $actor,
        string $action,
        string $reason,
        ?int $durationDays = null,
    ): User {
        return DB::transaction(function () use ($target, $actor, $action, $reason, $durationDays): User {
            $locked = User::query()->whereKey($target->id)->lockForUpdate()->firstOrFail();

            abort_unless(in_array($locked->role, ['student', 'staff'], true), 422, 'Only student and Staff accounts can receive enforcement actions.');
            abort_unless($locked->status === 'active', 422, 'Only active accounts can receive a warning or suspension.');
            abort_if($locked->is($actor), 422, 'You cannot apply enforcement to your own account.');

            if (in_array($action, ['warning', 'warning_and_suspension'], true)) {
                AccountEnforcementEvent::create([
                    'user_id' => $locked->id,
                    'actor_id' => $actor->id,
                    'action' => 'warning_issued',
                    'reason' => $reason,
                ]);
            }

            if (in_array($action, ['suspension', 'warning_and_suspension'], true)) {
                abort_unless($durationDays !== null && $durationDays >= 1 && $durationDays <= 7, 422, 'Suspension duration must be between 1 and 7 days.');

                $suspendedUntil = now()->addDays($durationDays);
                $locked->status = 'suspended';
                $locked->suspended_until = $suspendedUntil;
                $locked->save();
                $locked->tokens()->delete();

                AccountEnforcementEvent::create([
                    'user_id' => $locked->id,
                    'actor_id' => $actor->id,
                    'action' => 'suspended',
                    'reason' => $reason,
                    'duration_days' => $durationDays,
                    'suspended_until' => $suspendedUntil,
                ]);
            }

            return $locked->fresh();
        });
    }

    public function reinstate(User $target, User $actor): User
    {
        return DB::transaction(function () use ($target, $actor): User {
            $locked = User::query()->whereKey($target->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($locked->role, ['student', 'staff'], true), 422, 'Only student and Staff accounts can be reactivated here.');
            abort_unless(in_array($locked->status, ['suspended', 'inactive'], true), 422, 'Only suspended or legacy inactive accounts can be reactivated.');

            $locked->status = 'active';
            $locked->suspended_until = null;
            $locked->save();

            AccountEnforcementEvent::create([
                'user_id' => $locked->id,
                'actor_id' => $actor->id,
                'action' => 'reinstated',
                'reason' => 'Access restored by an authorized account manager.',
            ]);

            return $locked->fresh();
        });
    }

    public function expireIfDue(User $user): void
    {
        if ($user->status !== 'suspended' || $user->suspended_until === null || $user->suspended_until->isFuture()) {
            return;
        }

        DB::transaction(function () use ($user): void {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->first();
            if (! $locked || $locked->status !== 'suspended' || $locked->suspended_until === null || $locked->suspended_until->isFuture()) {
                return;
            }

            $expiredAt = $locked->suspended_until;
            $durationDays = $locked->enforcementEvents()
                ->where('action', 'suspended')
                ->where('suspended_until', $expiredAt)
                ->latest('id')
                ->value('duration_days');

            $locked->status = 'active';
            $locked->suspended_until = null;
            $locked->save();

            AccountEnforcementEvent::create([
                'user_id' => $locked->id,
                'actor_id' => null,
                'action' => 'suspension_expired',
                'reason' => 'The scheduled suspension period ended.',
                'duration_days' => $durationDays,
                'suspended_until' => $expiredAt,
            ]);
        });

        $user->refresh();
    }
}
