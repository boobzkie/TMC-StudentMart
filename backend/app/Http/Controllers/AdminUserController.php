<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminUserController extends Controller
{
    private const COURSES = ['BSIT', 'BSOA', 'BSCRIM', 'BSED', 'CAS'];

    public function index(Request $request): JsonResponse
    {        $request->validate([
            'course' => ['nullable', 'string', 'in:BSIT,BSOA,BSCRIM,BSED,CAS'],
        ]);
        $actor = $request->user();
        $query = User::query()->select([
            'id', 'name', 'student_id', 'email', 'contact_number', 'course',
            'role', 'status', 'profile_picture', 'created_at', 'updated_at',
        ])->orderByDesc('created_at');

        if ($actor->role === 'staff') {
            $query->where('role', 'student');
            if ($request->filled('role') && $request->input('role') !== 'student') {
                $query->whereRaw('1 = 0');
            }
        } else {
            $query->whereIn('role', ['admin', 'student']);
            if ($request->filled('role') && in_array($request->input('role'), ['admin', 'student'], true)) {
                $query->where('role', $request->input('role'));
            }
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search) {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('student_id', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status') && in_array($request->input('status'), ['active', 'inactive', 'pending', 'suspended'], true)) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('course') && in_array($request->input('course'), self::COURSES, true)) {
            $query->where('role', 'student')->where('course', $request->input('course'));
        }

        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
        $users = $query->paginate($perPage)->withQueryString();

        return response()->json([
            'success' => true,
            'users' => $users->items(),
            'total' => $users->total(),
            'pagination' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        if ($request->user()->role === 'staff' && $user->role !== 'student') {
            return response()->json(['success' => false, 'message' => 'Student account not found.'], 404);
        }

        return response()->json(['success' => true, 'user' => $this->safeUser($user)]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        if ($user->role !== 'student') {
            return response()->json(['success' => false, 'message' => 'Only student accounts can be edited here.'], 422);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'student_id' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('users', 'student_id')->ignore($user->id)],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'contact_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'course' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', self::COURSES)],
        ]);

        $user->fill($validated);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Student account updated successfully.',
            'user' => $this->safeUser($user),
        ]);
    }

    public function activate(Request $request, User $user): JsonResponse
    {
        if ($user->role !== 'student') {
            return response()->json(['success' => false, 'message' => 'Only student accounts can be managed here.'], 422);
        }

        $user->status = 'active';
        $user->save();

        return response()->json(['success' => true, 'message' => 'Student account activated successfully.', 'user' => $this->safeUser($user)]);
    }

    public function deactivate(Request $request, User $user): JsonResponse
    {
        if ($user->role !== 'student') {
            return response()->json(['success' => false, 'message' => 'Only student accounts can be managed here.'], 422);
        }

        $user->status = 'inactive';
        $user->save();
        $user->tokens()->delete();

        return response()->json(['success' => true, 'message' => 'Student account deactivated successfully.', 'user' => $this->safeUser($user)]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Only administrators can delete student accounts.'], 403);
        }
        if ($user->role !== 'student') {
            return response()->json(['success' => false, 'message' => 'Only student accounts can be deleted here.'], 422);
        }

        $userId = $user->id;
        DB::transaction(function () use ($request, $user): void {
            $products = Product::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->get();

            foreach ($products as $product) {
                $fromStatus = $product->status;
                $stock = (int) $product->stock_quantity;
                $product->status = 'archived';
                $product->archived_at ??= now();
                $product->save();
                $product->historyEvents()->create([
                    'actor_id' => $request->user()->id,
                    'event' => 'seller_account_archived',
                    'stock_before' => $stock,
                    'stock_after' => $stock,
                    'note' => 'Listing archived before the seller account was deleted (previous status: '.$fromStatus.').',
                ]);
            }

            $user->tokens()->delete();
            $user->delete();
        });

        return response()->json(['success' => true, 'message' => 'Student account deleted successfully.', 'deleted_user_id' => $userId]);
    }

    private function safeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'student_id' => $user->student_id,
            'email' => $user->email,
            'contact_number' => $user->contact_number,
            'course' => $user->course,
            'role' => $user->role,
            'status' => $user->status,
            'profile_picture' => $user->profile_picture,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }
}
