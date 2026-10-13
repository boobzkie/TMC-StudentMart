<?php

namespace App\Http\Controllers;

use App\Models\Complaint;
use App\Models\Product;
use App\Models\ProductModerationEvent;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class StaffInsightsController extends Controller
{
    public function reports(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->buildDataset($request),
        ]);
    }

    public function analytics(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->buildDataset($request),
        ]);
    }

    private function buildDataset(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $from = Carbon::parse($validated['from'] ?? now()->subDays(29)->toDateString())->startOfDay();
        $to = Carbon::parse($validated['to'] ?? now()->toDateString())->endOfDay();

        if ($from->gt($to)) {
            throw ValidationException::withMessages(['from' => 'The start date must be on or before the end date.']);
        }

        if ($from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) > 365) {
            throw ValidationException::withMessages(['from' => 'Choose a date range of 366 days or less.']);
        }

        $range = [$from, $to];
        $submissions = Product::query()->whereBetween('created_at', $range);
        $complaints = Complaint::query()->whereBetween('created_at', $range);
        $events = ProductModerationEvent::query()->whereBetween('created_at', $range);

        $resolutionRows = Complaint::query()
            ->whereNotNull('resolved_at')
            ->whereBetween('resolved_at', $range)
            ->get(['created_at', 'resolved_at']);

        $resolutionHours = $resolutionRows
            ->map(fn (Complaint $complaint) => $complaint->created_at->diffInSeconds($complaint->resolved_at) / 3600)
            ->avg();

        $submissionByDay = Product::query()
            ->whereBetween('created_at', $range)
            ->selectRaw('DATE(created_at) as day, COUNT(*) as total')
            ->groupByRaw('DATE(created_at)')
            ->pluck('total', 'day');

        $decisionByDay = ProductModerationEvent::query()
            ->whereBetween('created_at', $range)
            ->selectRaw('DATE(created_at) as day, to_status, COUNT(*) as total')
            ->groupByRaw('DATE(created_at), to_status')
            ->get()
            ->groupBy(fn ($row) => (string) $row->day);

        $complaintByDay = Complaint::query()
            ->whereBetween('created_at', $range)
            ->selectRaw('DATE(created_at) as day, COUNT(*) as total')
            ->groupByRaw('DATE(created_at)')
            ->pluck('total', 'day');

        $resolvedByDay = Complaint::query()
            ->whereNotNull('resolved_at')
            ->whereBetween('resolved_at', $range)
            ->selectRaw('DATE(resolved_at) as day, COUNT(*) as total')
            ->groupByRaw('DATE(resolved_at)')
            ->pluck('total', 'day');

        $dailyActivity = [];
        foreach (CarbonPeriod::create($from->copy()->startOfDay(), $to->copy()->startOfDay()) as $date) {
            $day = $date->toDateString();
            $decisions = $decisionByDay->get($day, collect());

            $dailyActivity[] = [
                'date' => $day,
                'product_submissions' => (int) ($submissionByDay[$day] ?? 0),
                'products_approved' => (int) $decisions->where('to_status', 'active')->sum('total'),
                'products_rejected' => (int) $decisions->where('to_status', 'rejected')->sum('total'),
                'complaints_submitted' => (int) ($complaintByDay[$day] ?? 0),
                'complaints_resolved' => (int) ($resolvedByDay[$day] ?? 0),
            ];
        }

        $complaintCounts = [];
        foreach (['pending', 'in_review', 'resolved', 'rejected'] as $status) {
            $complaintCounts[$status] = (clone $complaints)->where('status', $status)->count();
        }

        return [
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
            'summary' => [
                'products_submitted' => (clone $submissions)->count(),
                'products_pending' => (clone $submissions)->where('status', 'pending')->count(),
                'products_approved' => (clone $events)->where('to_status', 'active')->count(),
                'products_rejected' => (clone $events)->where('to_status', 'rejected')->count(),
                'complaints_submitted' => (clone $complaints)->count(),
                'complaints_pending' => $complaintCounts['pending'],
                'complaints_in_review' => $complaintCounts['in_review'],
                'complaints_resolved' => $complaintCounts['resolved'],
                'complaints_rejected' => $complaintCounts['rejected'],
                'average_resolution_hours' => $resolutionHours === null ? null : round($resolutionHours, 1),
            ],
            'daily_activity' => $dailyActivity,
        ];
    }
}
