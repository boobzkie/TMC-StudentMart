<?php

namespace App\Http\Controllers;

use App\Models\Complaint;
use App\Services\ComplaintWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffComplaintController extends Controller
{
    private const STATUSES = ['pending', 'in_review', 'resolved', 'rejected'];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = Complaint::query()->with([
            'user:id,name,student_id',
            'product:id,name,user_id',
            'product.user:id,name',
            'handler:id,name',
        ]);

        $this->applyFilters($query, $validated);

        $complaints = $query->latest()->paginate($validated['per_page'] ?? 15)->withQueryString();

        return response()->json([
            'success' => true,
            'message' => 'Complaints retrieved successfully.',
            'data' => $complaints,
        ]);
    }

    public function stats(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $query = Complaint::query();
        $this->applyDateFilter($query, $validated);

        $stats = ['total' => (clone $query)->count()];
        foreach (self::STATUSES as $status) {
            $stats[$status] = (clone $query)->where('status', $status)->count();
        }

        return response()->json([
            'success' => true,
            'stats' => $stats,
        ]);
    }

    public function show(Complaint $complaint): JsonResponse
    {
        $complaint->load([
            'user:id,name,student_id',
            'product:id,name,user_id',
            'product.user:id,name',
            'handler:id,name',
        ]);

        return response()->json([
            'success' => true,
            'data' => $complaint,
        ]);
    }

    public function update(Request $request, Complaint $complaint, ComplaintWorkflow $workflow): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'investigation_note' => ['nullable', 'string', 'max:5000'],
            'response_to_complainant' => [
                Rule::requiredIf(fn () => $request->input('status') === 'rejected'),
                'nullable',
                'string',
                'min:5',
                'max:5000',
            ],
        ]);

        $attributes = [];
        if (array_key_exists('investigation_note', $validated)) {
            $attributes['staff_note'] = filled($validated['investigation_note'])
                ? trim($validated['investigation_note'])
                : null;
        }
        if (array_key_exists('response_to_complainant', $validated)) {
            $attributes['admin_response'] = filled($validated['response_to_complainant'])
                ? trim($validated['response_to_complainant'])
                : null;
        }

        $complaint = $workflow->update($complaint, $request->user(), $validated['status'], $attributes);

        $complaint->load([
            'user:id,name,student_id',
            'product:id,name,user_id',
            'product.user:id,name',
            'handler:id,name',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Complaint updated successfully.',
            'data' => $complaint,
        ]);
    }

    private function applyFilters($query, array $filters): void
    {
        $this->applyDateFilter($query, $filters);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['search'])) {
            $search = trim($filters['search']);
            $query->where(function ($builder) use ($search) {
                $builder->where('subject', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('student_id', 'like', "%{$search}%");
                    })
                    ->orWhereHas('product', fn ($productQuery) => $productQuery->where('name', 'like', "%{$search}%"));
            });
        }
    }

    private function applyDateFilter($query, array $filters): void
    {
        if (!empty($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }

        if (!empty($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }
    }
}
