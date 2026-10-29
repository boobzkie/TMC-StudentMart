<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminActivityLogController extends Controller
{
    private const EVENT_TYPES = ['account', 'product', 'order', 'moderation', 'complaint'];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => ['sometimes', 'string', 'in:7d,30d,90d,all'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'category' => ['sometimes', 'nullable', 'string', 'in:account,product,order,moderation,complaint'],
            'status' => ['sometimes', 'nullable', 'string', 'max:50'],
            'actor' => ['sometimes', 'nullable', 'string', 'max:191'],
            'action' => ['sometimes', 'nullable', 'string', 'max:120'],
            'sort_by' => ['sometimes', 'string', 'in:occurred_at,actor_name,event_type,action'],
            'sort_direction' => ['sometimes', 'string', 'in:asc,desc'],
        ]);

        $period = $validated['period'] ?? '30d';
        $range = ActivityLog::query();
        if ($period !== 'all') {
            $days = (int) rtrim($period, 'd');
            $range->where('occurred_at', '>=', CarbonImmutable::now()->subDays($days));
        }

        $summaryRows = (clone $range)
            ->select('event_type')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('event_type')
            ->get();
        $byCategory = array_fill_keys(self::EVENT_TYPES, 0);
        foreach ($summaryRows as $row) {
            if (array_key_exists($row->event_type, $byCategory)) {
                $byCategory[$row->event_type] = (int) $row->total;
            }
        }

        $trendRows = (clone $range)
            ->selectRaw('DATE(occurred_at) as activity_date, event_type, COUNT(*) as total')
            ->groupByRaw('DATE(occurred_at), event_type')
            ->orderBy('activity_date')
            ->get();
        $trend = $trendRows->groupBy('activity_date')->map(function ($rows, $date): array {
            $counts = array_fill_keys(self::EVENT_TYPES, 0);
            foreach ($rows as $row) {
                if (array_key_exists($row->event_type, $counts)) {
                    $counts[$row->event_type] = (int) $row->total;
                }
            }

            return ['date' => (string) $date, 'counts' => $counts];
        })->values();

        $filterOptions = [
            'statuses' => (clone $range)->selectRaw("COALESCE(status, 'unknown') as status_option")->distinct()->orderBy('status_option')->limit(200)->pluck('status_option')->values(),
            'actors' => (clone $range)->selectRaw("COALESCE(actor_name, 'System') as actor_option")->distinct()->orderBy('actor_option')->limit(1000)->pluck('actor_option')->values(),
            'actions' => (clone $range)->whereNotNull('action')->distinct()->orderBy('action')->limit(500)->pluck('action')->values(),
        ];

        $query = clone $range;
        $search = trim((string) ($validated['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $pattern = '%'.$search.'%';
                $builder->where('actor_name', 'like', $pattern)
                    ->orWhere('actor_role', 'like', $pattern)
                    ->orWhere('action', 'like', $pattern)
                    ->orWhere('target', 'like', $pattern)
                    ->orWhere('status', 'like', $pattern);
            });
        }
        foreach (['event_type' => 'category', 'action' => 'action'] as $column => $input) {
            if (filled($validated[$input] ?? null)) {
                $query->where($column, $validated[$input]);
            }
        }
        if (filled($validated['status'] ?? null)) {
            $validated['status'] === 'unknown'
                ? $query->whereNull('status')
                : $query->where('status', $validated['status']);
        }
        if (filled($validated['actor'] ?? null)) {
            $validated['actor'] === 'System'
                ? $query->whereNull('actor_name')
                : $query->where('actor_name', $validated['actor']);
        }

        $sortColumn = match ($validated['sort_by'] ?? 'occurred_at') {
            'actor_name' => 'actor_name',
            'event_type' => 'event_type',
            'action' => 'action',
            default => 'occurred_at',
        };
        $direction = $validated['sort_direction'] ?? 'desc';
        $pageSize = (int) ($validated['per_page'] ?? 25);
        $paginator = $query
            ->orderBy($sortColumn, $direction)
            ->orderBy('id', $direction)
            ->paginate($pageSize, ['*'], 'page', (int) ($validated['page'] ?? 1));

        return response()->json([
            'success' => true,
            'events' => $paginator->getCollection()->map(fn (ActivityLog $event): array => [
                'id' => $event->id,
                'user' => $event->actor_name,
                'role' => $event->actor_role,
                'action' => $event->action,
                'target' => $event->target,
                'date_time' => $event->occurred_at?->toIso8601String(),
                'status' => $event->status,
                'type' => $event->event_type,
                'details' => $event->details ?? [],
            ])->values(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'summary' => [
                'total' => array_sum($byCategory),
                'by_category' => $byCategory,
            ],
            'trend' => $trend,
            'filter_options' => $filterOptions,
        ]);
    }
}
