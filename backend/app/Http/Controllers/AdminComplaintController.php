<?php

namespace App\Http\Controllers;

use App\Models\Complaint;
use App\Services\ComplaintWorkflow;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminComplaintController extends Controller
{
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

        if (!empty($validated['search'])) {
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
            });
        }

        /*
        |--------------------------------------------------------------------------
        | STATUS FILTER
        |--------------------------------------------------------------------------
        */

        if (!empty($validated['status'])) {
            $query->where(
                'status',
                $validated['status']
            );
        }

        /*
        |--------------------------------------------------------------------------
        | PAGINATION
        |--------------------------------------------------------------------------
        */

        $perPage = $validated['per_page'] ?? 15;

        $complaints = $query
            ->latest()
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
    public function stats()
    {
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
            ],
        ]);
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
