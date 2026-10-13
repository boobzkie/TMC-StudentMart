<?php

namespace App\Http\Controllers;

use App\Models\Complaint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ComplaintController extends Controller
{
    private const PRIVATE_FIELDS = ['staff_note', 'handled_by', 'handled_at'];

    public function index()
    {
        $complaints = Complaint::with(['product:id,name'])
            ->where('user_id', Auth::id())
            ->latest()
            ->get();

        $complaints->each(fn (Complaint $complaint) => $complaint->makeHidden(self::PRIVATE_FIELDS));

        return response()->json([
            'message' => 'Complaints retrieved successfully.',
            'data' => $complaints,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'subject' => ['required', 'string', 'max:150'],
            'description' => ['required', 'string', 'min:10', 'max:5000'],
        ]);

        $complaint = Complaint::create([
            'user_id' => Auth::id(),
            'product_id' => $validated['product_id'] ?? null,
            'subject' => trim($validated['subject']),
            'description' => trim($validated['description']),
            'status' => 'pending',
        ]);

        $complaint->load(['product:id,name'])->makeHidden(self::PRIVATE_FIELDS);

        return response()->json([
            'message' => 'Complaint submitted successfully.',
            'data' => $complaint,
        ], 201);
    }

    public function show(Complaint $complaint)
    {
        if ((int) $complaint->user_id !== (int) Auth::id()) {
            return response()->json([
                'message' => 'You are not authorized to view this complaint.',
            ], 403);
        }

        $complaint->load(['product:id,name'])->makeHidden(self::PRIVATE_FIELDS);

        return response()->json([
            'message' => 'Complaint retrieved successfully.',
            'data' => $complaint,
        ]);
    }
}
