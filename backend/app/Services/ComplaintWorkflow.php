<?php

namespace App\Services;

use App\Models\Complaint;
use App\Models\User;
use App\Notifications\ComplaintStatusNotification;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ComplaintWorkflow
{
    public function update(Complaint $complaint, User $actor, string $status, array $attributes = []): Complaint
    {
        [$updated, $statusChanged] = DB::transaction(function () use ($complaint, $actor, $status, $attributes): array {
            $locked = Complaint::query()->whereKey($complaint->id)->lockForUpdate()->firstOrFail();
            $allowed = match ($locked->status) {
                'pending' => ['in_review'],
                'in_review' => ['resolved', 'rejected'],
                default => [],
            };

            if ($status !== $locked->status && ! in_array($status, $allowed, true)) {
                throw new HttpException(409, 'This complaint cannot move from '.$locked->status.' to '.$status.'.');
            }

            $statusChanged = $locked->status !== $status;
            $locked->status = $status;
            foreach (['admin_response', 'staff_note'] as $field) {
                if (array_key_exists($field, $attributes)) {
                    $locked->{$field} = $attributes[$field];
                }
            }
            $locked->handled_by = $actor->id;
            $locked->handled_at = now();
            $locked->resolved_at = $status === 'resolved'
                ? ($locked->resolved_at ?? now())
                : null;
            $locked->save();

            return [$locked->fresh(), $statusChanged];
        });

        if ($statusChanged && $updated->user) {
            $updated->user->notify(new ComplaintStatusNotification($updated));
        }

        return $updated;
    }
}
