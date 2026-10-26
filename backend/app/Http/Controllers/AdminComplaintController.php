<?php

namespace App\Http\Controllers;

use App\Models\Complaint;
use App\Models\User;
use App\Services\ComplaintWorkflow;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminComplaintController extends Controller
{
    private const PERIODS = ['today', '7d', '30d', '90d', '6m', '12m'];

    private const STATUSES = ['pending', 'in_review', 'resolved', 'rejected'];

    /**
     * Get complaint records for administrators.
     */
    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => [
                'nullable',
                'string',
                'max:100',
            ],

            'status' => [
                'nullable',
                Rule::in([
                    'pending',
                    'in_review',
                    'resolved',
                    'rejected',
                ]),
            ],

            'period' => [
                'nullable',
                Rule::in(self::PERIODS),
            ],

            'related_product' => [
                'nullable',
                Rule::in(['linked', 'unlinked']),
            ],

            'sort_by' => [
                'nullable',
                Rule::in(['id', 'student', 'subject', 'status', 'created_at']),
            ],

            'sort_direction' => [
                'nullable',
                Rule::in(['asc', 'desc']),
            ],

            'per_page' => [
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],
        ]);

        $query = Complaint::with([
            'user:id,name,student_id,email',
            'product:id,name',
        ]);

        /*
        |--------------------------------------------------------------------------
        | SEARCH
        |--------------------------------------------------------------------------
        */

        if (! empty($validated['search'])) {
            $search = trim($validated['search']);

            $query->where(function ($q) use ($search) {
                $q->where(
                    'subject',
                    'like',
                    "%{$search}%"
                )
                    ->orWhere(
                        'description',
                        'like',
                        "%{$search}%"
                    )
                    ->orWhereHas(
                        'user',
                        function ($userQuery) use ($search) {
                            $userQuery
                                ->where(
                                    'name',
                                    'like',
                                    "%{$search}%"
                                )
                                ->orWhere(
                                    'student_id',
                                    'like',
                                    "%{$search}%"
                                )
                                ->orWhere(
                                    'email',
                                    'like',
                                    "%{$search}%"
                                );
                        }
                    )
                    ->orWhereHas(
                        'product',
                        function ($productQuery) use ($search) {
                            $productQuery->where(
                                'name',
                                'like',
                                "%{$search}%"
                            );
                        }
                    );
                if (ctype_digit($search)) {
                    $q->orWhere('id', (int) $search);
                }
            });
        }

        /*
        |--------------------------------------------------------------------------
        | STATUS FILTER
        |--------------------------------------------------------------------------
        */

        if (! empty($validated['status'])) {
            $query->where(
                'status',
                $validated['status']
            );
        }

        if (! empty($validated['period'])) {
            [$periodStart, $periodEnd] = $this->periodBounds($validated['period']);
            $query->whereBetween('created_at', [$periodStart, $periodEnd]);
        }

        if (($validated['related_product'] ?? null) === 'linked') {
            $query->whereNotNull('product_id');
        } elseif (($validated['related_product'] ?? null) === 'unlinked') {
            $query->whereNull('product_id');
        }

        /*
        |--------------------------------------------------------------------------
        | PAGINATION
        |--------------------------------------------------------------------------
        */

        $perPage = $validated['per_page'] ?? 15;

        $sortBy = $validated['sort_by'] ?? 'created_at';
        $sortDirection = $validated['sort_direction'] ?? 'desc';
        if ($sortBy === 'student') {
            $query->orderBy(
                User::query()->select('name')->whereColumn('users.id', 'complaints.user_id'),
                $sortDirection
            );
        } else {
            $query->orderBy($sortBy, $sortDirection);
        }
        $complaints = $query
            ->orderBy('id', $sortDirection)
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'message' => 'Complaints retrieved successfully.',
            'data' => $complaints,
        ]);
    }

    /**
     * Get complaint statistics.
     */
    public function stats(Request $request)
    {
        $validated = $request->validate([
            'period' => [
                'nullable',
                Rule::in(self::PERIODS),
            ],
        ]);
        $period = $validated['period'] ?? '30d';
        [$periodStart, $periodEnd, $previousStart, $previousEnd] = $this->periodBounds($period);
        $periodCounts = $this->countsForPeriod($periodStart, $periodEnd);
        $previousCounts = $this->countsForPeriod($previousStart, $previousEnd);

        return response()->json([
            'message' => 'Complaint statistics retrieved successfully.',
            'stats' => [
                'total' => Complaint::count(),

                'pending' => Complaint::where(
                    'status',
                    'pending'
                )->count(),

                'in_review' => Complaint::where(
                    'status',
                    'in_review'
                )->count(),

                'resolved' => Complaint::where(
                    'status',
                    'resolved'
                )->count(),

                'rejected' => Complaint::where(
                    'status',
                    'rejected'
                )->count(),
                'period' => [
                    'key' => $period,
                    'start' => $periodStart->toIso8601String(),
                    'end' => $periodEnd->toIso8601String(),
                    'counts' => $periodCounts,
                    'previous_counts' => $previousCounts,
                ],
                'over_time' => $this->complaintActivityOverTime($period, $periodStart, $periodEnd),
            ],
        ]);
    }

    /**
     * Return boundaries for the selected calendar period and the preceding one.
     *
     * @return array{Carbon, Carbon, Carbon, Carbon}
     */
    private function periodBounds(string $period): array
    {
        $now = Carbon::now();
        $periodStart = match ($period) {
            'today' => $now->copy()->startOfDay(),
            '7d' => $now->copy()->startOfDay()->subDays(6),
            '90d' => $now->copy()->startOfDay()->subDays(89),
            '6m' => $now->copy()->startOfMonth()->subMonths(5),
            '12m' => $now->copy()->startOfMonth()->subMonths(11),
            default => $now->copy()->startOfDay()->subDays(29),
        };
        $periodEnd = $now->copy();
        $previousEnd = $periodStart->copy()->subSecond();
        $previousStart = match ($period) {
            'today' => $periodStart->copy()->subDay(),
            '7d' => $periodStart->copy()->subDays(7),
            '90d' => $periodStart->copy()->subDays(90),
            '6m' => $periodStart->copy()->subMonths(6),
            '12m' => $periodStart->copy()->subMonths(12),
            default => $periodStart->copy()->subDays(30),
        };

        return [$periodStart, $periodEnd, $previousStart, $previousEnd];
    }

    /**
     * Count complaints by their actual current status for a submission period.
     */
    private function countsForPeriod(Carbon $start, Carbon $end): array
    {
        $counts = Complaint::query()
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $result = ['total' => 0];
        foreach (self::STATUSES as $status) {
            $result[$status] = (int) ($counts[$status] ?? 0);
            $result['total'] += $result[$status];
        }

        return $result;
    }

    /**
     * Aggregate actual complaint submissions into readable chart buckets.
     */
    private function complaintActivityOverTime(string $period, Carbon $start, Carbon $end): array
    {
        $granularity = match ($period) {
            '90d' => 'week',
            '6m', '12m' => 'month',
            default => 'day',
        };
        $dailyCounts = Complaint::query()
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('DATE(created_at) as activity_date, COUNT(*) as total')
            ->groupBy('activity_date')
            ->orderBy('activity_date')
            ->get()
            ->mapWithKeys(fn ($row): array => [(string) $row->activity_date => (int) $row->total]);

        $bucketCounts = [];
        foreach ($dailyCounts as $date => $count) {
            $day = Carbon::parse($date);
            $key = match ($granularity) {
                'week' => $day->copy()->startOfWeek()->format('Y-m-d'),
                'month' => $day->format('Y-m'),
                default => $day->format('Y-m-d'),
            };
            $bucketCounts[$key] = ($bucketCounts[$key] ?? 0) + $count;
        }

        $cursor = match ($granularity) {
            'week' => $start->copy()->startOfWeek(),
            'month' => $start->copy()->startOfMonth(),
            default => $start->copy()->startOfDay(),
        };
        $rows = [];
        while ($cursor <= $end) {
            $key = match ($granularity) {
                'week' => $cursor->format('Y-m-d'),
                'month' => $cursor->format('Y-m'),
                default => $cursor->format('Y-m-d'),
            };
            $rows[] = [
                'key' => $key,
                'label' => $granularity === 'month' ? $cursor->format('M Y') : $cursor->format('M j'),
                'count' => (int) ($bucketCounts[$key] ?? 0),
            ];
            $cursor = match ($granularity) {
                'week' => $cursor->copy()->addWeek(),
                'month' => $cursor->copy()->addMonth(),
                default => $cursor->copy()->addDay(),
            };
        }

        return $rows;
    }

    /**
     * Show one complaint.
     */
    public function show(Complaint $complaint)
    {
        $complaint->load([
            'user:id,name,student_id,email,contact_number',
            'product:id,name,price,category',
        ]);

        return response()->json([
            'message' => 'Complaint retrieved successfully.',
            'data' => $complaint,
        ]);
    }

    /**
     * Update complaint status and administrator response.
     */
    public function update(
        Request $request,
        Complaint $complaint,
        ComplaintWorkflow $workflow
    ) {
        $validated = $request->validate([
            'status' => [
                'required',
                Rule::in([
                    'pending',
                    'in_review',
                    'resolved',
                    'rejected',
                ]),
            ],

            'admin_response' => [
                Rule::requiredIf(fn () => $request->input('status') === 'rejected'),
                'nullable',
                'string',
                'min:5',
                'max:5000',
            ],
        ]);

        $attributes = [];
        if (array_key_exists('admin_response', $validated)) {
            $attributes['admin_response'] = filled($validated['admin_response'])
                ? trim($validated['admin_response'])
                : null;
        }

        $complaint = $workflow->update($complaint, $request->user(), $validated['status'], $attributes);

        $complaint->load([
            'user:id,name,student_id,email',
            'product:id,name',
        ]);

        return response()->json([
            'message' => 'Complaint updated successfully.',
            'data' => $complaint,
        ]);
    }

    /**
     * Delete a complaint.
     */
    public function destroy(Complaint $complaint)
    {
        $complaint->delete();

        return response()->json([
            'message' => 'Complaint deleted successfully.',
        ]);
    }
}
