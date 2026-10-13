<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSellerController extends Controller
{
    /**
     * Display sellers with product statistics.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::query()
            ->where('role', 'student')
            ->withCount([
                'products as total_products',

                'products as active_products' => function ($q) {
                    $q->where('status', 'active');
                },

                'products as pending_products' => function ($q) {
                    $q->where('status', 'pending');
                },

                'products as rejected_products' => function ($q) {
                    $q->where('status', 'rejected');
                },

                'products as inactive_products' => function ($q) {
                    $q->where('status', 'inactive');
                },
            ])
            ->orderBy('name');

        /*
        |--------------------------------------------------------------------------
        | SEARCH
        |--------------------------------------------------------------------------
        */

        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('student_id', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        /*
        |--------------------------------------------------------------------------
        | ACCOUNT STATUS
        |--------------------------------------------------------------------------
        */

        if ($request->filled('status')) {
            $allowedStatuses = [
                'active',
                'suspended',
            ];

            if (in_array($request->status, $allowedStatuses, true)) {
                $query->where(
                    'status',
                    $request->status
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | ONLY USERS WHO HAVE PRODUCTS
        |--------------------------------------------------------------------------
        |
        | A seller is considered a student account that has
        | at least one marketplace product.
        |
        */

        $query->has('products');

        $sellers = $query->get([
            'id',
            'name',
            'student_id',
            'email',
            'contact_number',
            'role',
            'status',
            'profile_picture',
            'created_at',
        ]);

        return response()->json([
            'success' => true,
            'sellers' => $sellers,
            'total' => $sellers->count(),
        ]);
    }

    /**
     * Display one seller and their products.
     */
    public function show(User $user): JsonResponse
    {
        if ($user->role !== 'student') {
            return response()->json([
                'success' => false,
                'message' => 'The selected user is not a seller.',
            ], 404);
        }

        $user->loadCount([
            'products as total_products',

            'products as active_products' => function ($q) {
                $q->where('status', 'active');
            },

            'products as pending_products' => function ($q) {
                $q->where('status', 'pending');
            },

            'products as rejected_products' => function ($q) {
                $q->where('status', 'rejected');
            },

            'products as inactive_products' => function ($q) {
                $q->where('status', 'inactive');
            },
        ]);

        $user->load([
            'products' => function ($query) {
                $query->orderByDesc('created_at');
            },
        ]);

        return response()->json([
            'success' => true,
            'seller' => $user,
        ]);
    }
}