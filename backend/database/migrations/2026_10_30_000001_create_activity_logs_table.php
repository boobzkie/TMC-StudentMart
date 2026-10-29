<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('activity_logs')) {
            Schema::create('activity_logs', function (Blueprint $table): void {
                $table->id();
                $table->string('event_type', 40);
                $table->string('action', 120);
                $table->unsignedBigInteger('actor_id')->nullable();
                $table->string('actor_name')->nullable();
                $table->string('actor_role', 30)->nullable();
                $table->string('subject_type', 60)->nullable();
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->string('target')->nullable();
                $table->string('status', 50)->nullable();
                $table->json('details')->nullable();
                $table->string('source_type', 60)->nullable();
                $table->unsignedBigInteger('source_id')->nullable();
                $table->timestamp('occurred_at');
                $table->timestamps();

                $table->index(['event_type', 'occurred_at']);
                $table->index(['actor_id', 'occurred_at']);
                $table->index(['subject_type', 'subject_id']);
                $table->index(['source_type', 'source_id']);
            });
        }

        $this->backfill(
            DB::table('users')->selectRaw("'account' as event_type")
                ->selectRaw("'Account registered' as action")
                ->addSelect('users.id as actor_id', 'users.name as actor_name', 'users.role as actor_role')
                ->selectRaw("'User' as subject_type")
                ->addSelect('users.id as subject_id')
                ->selectRaw("'Account' as target")
                ->addSelect('users.status')
                ->selectRaw("'users' as source_type")
                ->addSelect('users.id as source_id', 'users.created_at as occurred_at'),
            'users.id',
        );

        $this->backfill(
            DB::table('products')
                ->leftJoin('users as actors', 'actors.id', '=', 'products.user_id')
                ->selectRaw("'product' as event_type")
                ->selectRaw("'Listing submitted' as action")
                ->addSelect('products.user_id as actor_id', 'actors.name as actor_name', 'actors.role as actor_role')
                ->selectRaw("'Product' as subject_type")
                ->addSelect('products.id as subject_id', 'products.name as target', 'products.status')
                ->selectRaw("'products' as source_type")
                ->addSelect('products.id as source_id', 'products.created_at as occurred_at'),
            'products.id',
        );

        $this->backfill(
            DB::table('orders')
                ->leftJoin('users as actors', 'actors.id', '=', 'orders.buyer_id')
                ->selectRaw("'order' as event_type")
                ->selectRaw("'Order placed' as action")
                ->addSelect('orders.buyer_id as actor_id')
                ->selectRaw('COALESCE(actors.name, orders.buyer_name_snapshot) as actor_name')
                ->selectRaw("COALESCE(actors.role, 'student') as actor_role")
                ->selectRaw("'Order' as subject_type")
                ->addSelect('orders.id as subject_id', 'orders.order_number as target', 'orders.status')
                ->selectRaw("'orders' as source_type")
                ->addSelect('orders.id as source_id', 'orders.created_at as occurred_at'),
            'orders.id',
        );

        $this->backfill(
            DB::table('complaints')
                ->leftJoin('users as actors', 'actors.id', '=', 'complaints.user_id')
                ->selectRaw("'complaint' as event_type")
                ->selectRaw("'Complaint submitted' as action")
                ->addSelect('complaints.user_id as actor_id', 'actors.name as actor_name', 'actors.role as actor_role')
                ->selectRaw("'Complaint' as subject_type")
                ->addSelect('complaints.id as subject_id')
                ->selectRaw("'Complaint' as target")
                ->addSelect('complaints.status')
                ->selectRaw("'complaints' as source_type")
                ->addSelect('complaints.id as source_id', 'complaints.created_at as occurred_at'),
            'complaints.id',
        );

        $this->backfill(
            DB::table('product_moderation_events')
                ->leftJoin('users as actors', 'actors.id', '=', 'product_moderation_events.actor_id')
                ->leftJoin('products', 'products.id', '=', 'product_moderation_events.product_id')
                ->selectRaw("'moderation' as event_type")
                ->selectRaw("CASE product_moderation_events.to_status WHEN 'active' THEN 'Listing approved' WHEN 'rejected' THEN 'Listing rejected' WHEN 'suspended' THEN 'Listing suspended' WHEN 'archived' THEN 'Listing archived' ELSE 'Listing moderation updated' END as action")
                ->addSelect('product_moderation_events.actor_id', 'actors.name as actor_name', 'actors.role as actor_role')
                ->selectRaw("'Product' as subject_type")
                ->addSelect('product_moderation_events.product_id as subject_id')
                ->selectRaw("COALESCE(products.name, 'Removed listing') as target")
                ->addSelect('product_moderation_events.to_status as status')
                ->selectRaw("'product_moderation_events' as source_type")
                ->addSelect('product_moderation_events.id as source_id', 'product_moderation_events.created_at as occurred_at', 'product_moderation_events.from_status', 'product_moderation_events.to_status'),
            'product_moderation_events.id',
            fn (object $event): array => [
                'details' => ['status_change' => ['from' => $event->from_status, 'to' => $event->to_status]],
            ],
        );

        $this->backfill(
            DB::table('product_history_events')
                ->leftJoin('users as actors', 'actors.id', '=', 'product_history_events.actor_id')
                ->leftJoin('products', 'products.id', '=', 'product_history_events.product_id')
                ->selectRaw("'product' as event_type")
                ->addSelect('product_history_events.event as event_name')
                ->addSelect('product_history_events.actor_id', 'actors.name as actor_name', 'actors.role as actor_role')
                ->selectRaw("'Product' as subject_type")
                ->addSelect('product_history_events.product_id as subject_id')
                ->selectRaw("COALESCE(products.name, 'Removed listing') as target")
                ->selectRaw("'product_history_events' as source_type")
                ->addSelect('product_history_events.id as source_id', 'product_history_events.created_at as occurred_at', 'product_history_events.stock_before', 'product_history_events.stock_after'),
            'product_history_events.id',
            fn (object $event): array => [
                'action' => 'Stock '.Str::headline((string) $event->event_name),
                'details' => ['stock_before' => $event->stock_before, 'stock_after' => $event->stock_after],
            ],
        );

        $this->backfill(
            DB::table('account_enforcement_events')
                ->leftJoin('users as actors', 'actors.id', '=', 'account_enforcement_events.actor_id')
                ->leftJoin('users as subjects', 'subjects.id', '=', 'account_enforcement_events.user_id')
                ->selectRaw("'account' as event_type")
                ->addSelect('account_enforcement_events.action as event_name')
                ->addSelect('account_enforcement_events.actor_id', 'actors.name as actor_name', 'actors.role as actor_role')
                ->selectRaw("'User' as subject_type")
                ->addSelect('account_enforcement_events.user_id as subject_id')
                ->selectRaw("COALESCE(subjects.name, 'Account') as target")
                ->selectRaw("'account_enforcement_events' as source_type")
                ->addSelect('account_enforcement_events.id as source_id', 'account_enforcement_events.created_at as occurred_at', 'account_enforcement_events.duration_days', 'account_enforcement_events.suspended_until'),
            'account_enforcement_events.id',
            fn (object $event): array => [
                'action' => 'Account '.Str::headline((string) $event->event_name),
                'details' => ['duration_days' => $event->duration_days, 'suspended_until' => $event->suspended_until],
            ],
        );

        $this->backfill(
            DB::table('staff_application_events')
                ->leftJoin('users as actors', 'actors.id', '=', 'staff_application_events.actor_id')
                ->leftJoin('staff_profiles', 'staff_profiles.id', '=', 'staff_application_events.staff_profile_id')
                ->leftJoin('users as subjects', 'subjects.id', '=', 'staff_profiles.user_id')
                ->selectRaw("'account' as event_type")
                ->addSelect('staff_application_events.event as event_name')
                ->addSelect('staff_application_events.actor_id', 'actors.name as actor_name', 'actors.role as actor_role')
                ->selectRaw("'StaffProfile' as subject_type")
                ->addSelect('staff_application_events.staff_profile_id as subject_id')
                ->selectRaw("COALESCE(subjects.name, 'Staff account') as target")
                ->addSelect('staff_application_events.to_status as status')
                ->selectRaw("'staff_application_events' as source_type")
                ->addSelect('staff_application_events.id as source_id', 'staff_application_events.created_at as occurred_at', 'staff_application_events.from_status', 'staff_application_events.to_status'),
            'staff_application_events.id',
            fn (object $event): array => [
                'action' => 'Staff application '.Str::headline((string) $event->event_name),
                'details' => ['status_change' => ['from' => $event->from_status, 'to' => $event->to_status]],
            ],
        );
    }

    private function backfill(Builder $query, string $chunkColumn, ?callable $transform = null): void
    {
        $query->chunkById(500, function ($events) use ($transform): void {
            $createdAt = now();
            $rows = $events->map(function (object $event) use ($transform, $createdAt): array {
                $row = [
                    'event_type' => $event->event_type,
                    'action' => $event->action ?? Str::headline((string) ($event->event_name ?? 'Activity recorded')),
                    'actor_id' => $event->actor_id,
                    'actor_name' => $event->actor_name,
                    'actor_role' => $event->actor_role,
                    'subject_type' => $event->subject_type,
                    'subject_id' => $event->subject_id,
                    'target' => $event->target,
                    'status' => $event->status ?? null,
                    'details' => null,
                    'source_type' => $event->source_type,
                    'source_id' => $event->source_id,
                    'occurred_at' => $event->occurred_at ?? $createdAt,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ];

                $row = array_replace($row, $transform ? $transform($event) : []);
                if (is_array($row['details'])) {
                    $row['details'] = json_encode($row['details'], JSON_THROW_ON_ERROR);
                }

                return $row;
            })->all();

            if ($rows !== []) {
                $existingKeys = DB::table('activity_logs')
                    ->whereIn('source_type', array_unique(array_column($rows, 'source_type')))
                    ->whereIn('source_id', array_unique(array_column($rows, 'source_id')))
                    ->whereIn('action', array_unique(array_column($rows, 'action')))
                    ->whereIn('occurred_at', array_unique(array_column($rows, 'occurred_at')))
                    ->get(['source_type', 'source_id', 'action', 'occurred_at'])
                    ->mapWithKeys(fn (object $event): array => [$this->sourceKey((array) $event) => true])
                    ->all();

                $rows = array_values(array_filter(
                    $rows,
                    fn (array $row): bool => ! isset($existingKeys[$this->sourceKey($row)]),
                ));
            }

            if ($rows !== []) {
                DB::table('activity_logs')->insert($rows);
            }
        }, $chunkColumn, 'source_id');
    }

    private function sourceKey(array $row): string
    {
        $occurredAt = $row['occurred_at'];
        if ($occurredAt instanceof DateTimeInterface) {
            $occurredAt = $occurredAt->format('Y-m-d H:i:s');
        }

        return implode("\0", [
            (string) $row['source_type'],
            (string) $row['source_id'],
            (string) $row['action'],
            substr((string) $occurredAt, 0, 19),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
