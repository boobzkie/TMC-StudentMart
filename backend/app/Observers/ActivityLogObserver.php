<?php

namespace App\Observers;

use App\Models\AccountEnforcementEvent;
use App\Models\ActivityLog;
use App\Models\Complaint;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductHistoryEvent;
use App\Models\ProductModerationEvent;
use App\Models\StaffApplicationEvent;
use App\Models\StaffProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Throwable;

class ActivityLogObserver
{
    private const IGNORED_USER_FIELDS = [
        'updated_at',
        'last_seen_at',
        'remember_token',
    ];

    public function created(Model $model): void
    {
        if ($model instanceof User) {
            $this->record($model, 'account', 'Account registered', 'Account', $model->status, $model);
        } elseif ($model instanceof Product) {
            $this->record($model, 'product', 'Listing submitted', $model->name, $model->status, $model->user);
        } elseif ($model instanceof Order) {
            $this->record($model, 'order', 'Order placed', $model->order_number, $model->status, $model->buyer);
        } elseif ($model instanceof Complaint) {
            $this->record($model, 'complaint', 'Complaint submitted', 'Complaint', $model->status, $model->user);
        } elseif ($model instanceof ProductModerationEvent) {
            $action = match ($model->to_status) {
                'active' => 'Listing approved',
                'rejected' => 'Listing rejected',
                'suspended' => 'Listing suspended',
                'archived' => 'Listing archived',
                default => 'Listing moderation updated',
            };
            $this->record(
                $model,
                'moderation',
                $action,
                $this->productName($model->product_id),
                $model->to_status,
                $this->user($model->actor_id),
                ['status_change' => ['from' => $model->from_status, 'to' => $model->to_status]],
                'Product',
                $model->product_id,
            );
        } elseif ($model instanceof ProductHistoryEvent) {
            $this->record(
                $model,
                'product',
                'Stock '.Str::headline((string) $model->event),
                $this->productName($model->product_id),
                null,
                $this->user($model->actor_id),
                ['stock_before' => $model->stock_before, 'stock_after' => $model->stock_after],
                'Product',
                $model->product_id,
            );
        } elseif ($model instanceof AccountEnforcementEvent) {
            if (in_array($model->action, ['suspended', 'reinstated'], true)) {
                return;
            }

            $this->record(
                $model,
                'account',
                'Account '.Str::headline((string) $model->action),
                $this->userName($model->user_id) ?? 'Account',
                null,
                $this->user($model->actor_id),
                ['duration_days' => $model->duration_days, 'suspended_until' => $model->suspended_until?->toIso8601String()],
                'User',
                $model->user_id,
            );
        } elseif ($model instanceof StaffApplicationEvent) {
            $profile = StaffProfile::query()->with('user:id,name')->find($model->staff_profile_id);
            $this->record(
                $model,
                'account',
                'Staff application '.Str::headline((string) $model->event),
                $profile?->user?->name ?? 'Staff account',
                $model->to_status,
                $this->user($model->actor_id),
                ['status_change' => ['from' => $model->from_status, 'to' => $model->to_status]],
                'StaffProfile',
                $model->staff_profile_id,
            );
        }
    }

    public function updated(Model $model): void
    {
        $changes = array_diff(array_keys($model->getChanges()), ['updated_at']);

        if ($model instanceof User) {
            $changes = array_values(array_diff($changes, self::IGNORED_USER_FIELDS));
            if ($changes === []) {
                return;
            }

            $action = in_array('status', $changes, true)
                ? 'Account status changed'
                : (in_array('password', $changes, true) ? 'Account password changed' : 'Account profile updated');
            $details = ['changed_fields' => $changes];
            if (in_array('status', $changes, true)) {
                $details['status_change'] = [
                    'from' => $model->getOriginal('status'),
                    'to' => $model->status,
                ];
            }

            $this->record($model, 'account', $action, 'Account', $model->status, null, $details);
            return;
        }

        if ($model instanceof Product) {
            $changes = array_values(array_diff($changes, ['sold_out_at', 'archived_at', 'status']));
            if ($changes === []) {
                return;
            }

            $details = ['changed_fields' => $changes];
            $this->record($model, 'product', 'Listing updated', $model->name, $model->status, null, $details);
            return;
        }

        if ($model instanceof Order) {
            $details = [];
            if ($model->wasChanged('status')) {
                $details['status_change'] = [
                    'from' => $model->getOriginal('status'),
                    'to' => $model->status,
                ];
            }
            if ($model->wasChanged('payment_status')) {
                $details['payment_status_change'] = [
                    'from' => $model->getOriginal('payment_status'),
                    'to' => $model->payment_status,
                ];
            }
            if ($details === []) {
                return;
            }

            $action = isset($details['status_change'], $details['payment_status_change'])
                ? 'Order and payment status changed'
                : (isset($details['status_change']) ? 'Order status changed' : 'Payment status changed');
            $this->record($model, 'order', $action, $model->order_number, $model->status, null, $details);
            return;
        }

        if ($model instanceof Complaint) {
            if (! $model->wasChanged(['status', 'handled_by'])) {
                return;
            }

            $details = ['changed_fields' => array_values(array_intersect($changes, ['status', 'handled_by']))];
            if ($model->wasChanged('status')) {
                $details['status_change'] = [
                    'from' => $model->getOriginal('status'),
                    'to' => $model->status,
                ];
            }
            $this->record($model, 'complaint', 'Complaint updated', 'Complaint', $model->status, null, $details);
        }
    }

    public function deleted(Model $model): void
    {
        if ($model instanceof User) {
            $this->record($model, 'account', 'Account deleted', 'Account', 'deleted');
        } elseif ($model instanceof Product) {
            $this->record($model, 'product', 'Listing deleted', $model->name, 'deleted');
        } elseif ($model instanceof Order) {
            $this->record($model, 'order', 'Order deleted', $model->order_number, 'deleted');
        } elseif ($model instanceof Complaint) {
            $this->record($model, 'complaint', 'Complaint deleted', 'Complaint', 'deleted');
        }
    }

    private function record(
        Model $source,
        string $eventType,
        string $action,
        ?string $target,
        ?string $status,
        ?User $actor = null,
        ?array $details = null,
        ?string $subjectType = null,
        ?int $subjectId = null,
    ): void {
        $authenticated = Auth::user();
        if ($source instanceof User || $source instanceof Product || $source instanceof Order || $source instanceof Complaint) {
            $actor = $authenticated instanceof User ? $authenticated : $actor;
        }

        $actor ??= $authenticated instanceof User ? $authenticated : null;
        if (! $actor && $source instanceof User && $source->wasRecentlyCreated) {
            $actor = $source;
        }

        try {
            ActivityLog::query()->create([
                'event_type' => $eventType,
                'action' => $action,
                'actor_id' => $actor?->id,
                'actor_name' => $actor?->name,
                'actor_role' => $actor?->role,
                'subject_type' => $subjectType ?? class_basename($source),
                'subject_id' => $subjectId ?? $source->getKey(),
                'target' => $target,
                'status' => $status,
                'details' => $details,
                'source_type' => $source->getTable(),
                'source_id' => $source->getKey(),
                'occurred_at' => $source->wasRecentlyCreated
                    ? ($source->getAttribute('created_at') ?? now())
                    : now(),
            ]);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function user(?int $userId): ?User
    {
        if (! $userId) {
            return null;
        }

        $authenticated = Auth::user();
        if ($authenticated instanceof User && (int) $authenticated->id === $userId) {
            return $authenticated;
        }

        return User::query()->select(['id', 'name', 'role'])->find($userId);
    }

    private function userName(?int $userId): ?string
    {
        return $this->user($userId)?->name;
    }

    private function productName(?int $productId): ?string
    {
        return $productId ? Product::query()->whereKey($productId)->value('name') : null;
    }
}
