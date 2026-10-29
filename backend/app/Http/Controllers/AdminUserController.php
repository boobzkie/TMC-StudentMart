<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\AccountEnforcementNotification;
use App\Services\AccountEnforcementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Throwable;

class AdminUserController extends Controller
{
    private const COURSES = ['BSIT', 'BSOA', 'BSCRIM', 'BSED', 'CAS'];

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'course' => ['nullable', 'string', 'in:BSIT,BSOA,BSCRIM,BSED,CAS'],
        ]);
        $actor = $request->user();
        $query = User::query()->select([
            'id', 'name', 'student_id', 'email', 'contact_number', 'course',
            'role', 'status', 'suspended_until', 'profile_picture', 'created_at', 'updated_at',
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

        app(AccountEnforcementService::class)->expireIfDue($user);
        $user->load('enforcementEvents.actor');

        return response()->json(['success' => true, 'user' => $this->safeUser($user, true)]);
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

        $user = app(AccountEnforcementService::class)->reinstate($user, $request->user());

        $user->load('enforcementEvents.actor');

        return response()->json(['success' => true, 'message' => 'Student account access restored successfully.', 'user' => $this->safeUser($user, true)]);
    }

    public function deactivate(Request $request, User $user): JsonResponse
    {
        if ($user->role !== 'student') {
            return response()->json(['success' => false, 'message' => 'Only student accounts can be managed here.'], 422);
        }

        if (is_string($request->input('reason'))) {
            $request->merge(['reason' => trim($request->input('reason'))]);
        }

        $validated = $request->validate([
            'action' => ['required', Rule::in(['warning', 'suspension', 'warning_and_suspension'])],
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
            'duration_days' => [
                Rule::requiredIf(fn (): bool => in_array($request->input('action'), ['suspension', 'warning_and_suspension'], true)),
                'nullable',
                'integer',
                'between:1,7',
                'prohibited_if:action,warning',
            ],
        ]);

        $user = app(AccountEnforcementService::class)->apply(
            $user,
            $request->user(),
            $validated['action'],
            $validated['reason'],
            isset($validated['duration_days']) ? (int) $validated['duration_days'] : null,
        );

        $this->notifyEnforcement($user, $validated['action'], $validated['reason'], $validated['duration_days'] ?? null);

        $user->load('enforcementEvents.actor');

        return response()->json([
            'success' => true,
            'message' => $validated['action'] === 'warning'
                ? 'Student account warning recorded successfully.'
                : 'Student account enforcement recorded; access is suspended for the selected period.',
            'user' => $this->safeUser($user, true),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Student accounts cannot be deleted or archived through account management.',
        ], 403);
    }

    private function safeUser(User $user, bool $includeHistory = false): array
    {
        $result = [
            'id' => $user->id,
            'name' => $user->name,
            'student_id' => $user->student_id,
            'email' => $user->email,
            'contact_number' => $user->contact_number,
            'course' => $user->course,
            'role' => $user->role,
            'status' => $user->status,
            'suspended_until' => $user->suspended_until?->toIso8601String(),
            'profile_picture' => $user->profile_picture,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];

        if ($includeHistory) {
            $result['enforcement_history'] = $user->enforcementEvents->map(fn ($event): array => [
                'id' => $event->id,
                'event' => $event->action,
                'reason' => $event->reason,
                'duration_days' => $event->duration_days,
                'suspended_until' => $event->suspended_until?->toIso8601String(),
                'actor_name' => $event->actor?->name,
                'created_at' => $event->created_at?->toIso8601String(),
            ])->values();
        }

        return $result;
    }

    private function notifyEnforcement(User $user, string $action, string $reason, mixed $durationDays): void
    {
        $actions = match ($action) {
            'warning' => ['warning'],
            'suspension' => ['suspension'],
            'warning_and_suspension' => ['warning', 'suspension'],
            default => [],
        };

        foreach ($actions as $notificationAction) {
            try {
                $user->notify(new AccountEnforcementNotification(
                    $notificationAction,
                    $reason,
                    $notificationAction === 'suspension' ? (int) $durationDays : null,
                    $notificationAction === 'suspension' ? $user->suspended_until?->toIso8601String() : null,
                ));
            } catch (Throwable $exception) {
                Log::warning('Account enforcement notification could not be delivered.', [
                    'user_id' => $user->id,
                    'action' => $notificationAction,
                ]);
            }
        }
    }
}
