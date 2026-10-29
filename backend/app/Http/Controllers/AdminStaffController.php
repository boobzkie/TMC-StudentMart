<?php

namespace App\Http\Controllers;

use App\Models\StaffApplicationEvent;
use App\Models\StaffProfile;
use App\Models\User;
use App\Notifications\AccountEnforcementNotification;
use App\Services\AccountEnforcementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AdminStaffController extends Controller
{
    private const DEPARTMENTS = ['BSIT', 'BSOA', 'BSCRIM', 'BSED', 'CAS'];
    private const EMPLOYMENT_STATUSES = ['Regular', 'Part-Time', 'Contractual'];
    private const PERMISSIONS = ['manage_students', 'moderate_products', 'manage_complaints', 'view_reports', 'view_analytics'];

    public function index(Request $request): JsonResponse
    {
        $query = User::query()
            ->where('role', 'staff')
            ->with('staffProfile')
            ->withCount('tokens')
            ->orderByDesc('created_at');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search) {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhereHas('staffProfile', fn ($profile) => $profile->where('employee_id', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('department') && in_array($request->input('department'), self::DEPARTMENTS, true)) {
            $query->whereHas('staffProfile', fn ($profile) => $profile->where('department', $request->input('department')));
        }

        if ($request->filled('employment_status') && in_array($request->input('employment_status'), self::EMPLOYMENT_STATUSES, true)) {
            $query->whereHas('staffProfile', fn ($profile) => $profile->where('employment_status', $request->input('employment_status')));
        }

        $statuses = ['pending', 'active', 'rejected', 'suspended', 'inactive', 'archived'];
        if ($request->filled('status') && in_array($request->input('status'), $statuses, true)) {
            $query->where('status', $request->input('status'));
        } else {
            $query->where('status', '!=', 'archived');
        }

        $counts = User::query()->where('role', 'staff')->where('status', '!=', 'archived');
        $stats = [
            'total' => (clone $counts)->count(),
            'pending' => (clone $counts)->where('status', 'pending')->count(),
            'active' => (clone $counts)->where('status', 'active')->count(),
            'rejected' => (clone $counts)->where('status', 'rejected')->count(),
            'suspended' => (clone $counts)->where('status', 'suspended')->count(),
        ];

        $staff = $query->paginate(min(max((int) $request->input('per_page', 15), 1), 100))->withQueryString();

        return response()->json([
            'success' => true,
            'staff' => collect($staff->items())->map(fn (User $user) => $this->safeStaff($user))->values(),
            'stats' => $stats,
            'pagination' => [
                'current_page' => $staff->currentPage(),
                'last_page' => $staff->lastPage(),
                'per_page' => $staff->perPage(),
                'total' => $staff->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'contact_number' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', Rule::in(self::PERMISSIONS)],
        ]);

        $staff = DB::transaction(function () use ($validated, $request) {
            $user = User::create([
                'name' => $validated['name'],
                'student_id' => null,
                'email' => strtolower($validated['email']),
                'contact_number' => $validated['contact_number'] ?? null,
                'password' => Hash::make($validated['password']),
                'role' => 'staff',
                'status' => 'active',
            ]);

            $profile = StaffProfile::create([
                'user_id' => $user->id,
                'permissions' => array_values(array_unique($validated['permissions'] ?? [])),
                'is_admin_created' => true,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            $this->record($profile, $request->user()->id, 'created_by_admin', null, 'active', 'Staff account created by an administrator.');

            return $user->load('staffProfile');
        });

        return response()->json([
            'success' => true,
            'message' => 'Staff account created successfully.',
            'staff' => $this->safeStaff($staff),
        ], 201);
    }

    public function show(User $user): JsonResponse
    {
        $staff = $this->findStaff($user);
        app(AccountEnforcementService::class)->expireIfDue($staff);
        $staff->load(['staffProfile.reviewer', 'staffProfile.events.actor', 'enforcementEvents.actor']);

        return response()->json([
            'success' => true,
            'staff' => $this->safeStaff($staff, true),
        ]);
    }

    public function document(User $user): Response|JsonResponse
    {
        $staff = $this->findStaff($user);
        $path = $staff->staffProfile?->verification_document_path;

        if (! $path || ! Storage::disk('local')->exists($path)) {
            return response()->json(['success' => false, 'message' => 'No verification document is available.'], 404);
        }

        $name = basename($path);
        return Storage::disk('local')->response($path, $name, [
            'Content-Disposition' => 'inline; filename="'.$name.'"',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $staff = $this->findStaff($user);
        $profile = $staff->staffProfile;
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($staff->id)],
            'contact_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'first_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'middle_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'suffix' => ['sometimes', 'nullable', 'string', 'max:30'],
            'date_of_birth' => ['sometimes', 'nullable', 'date', 'before:today'],
            'employee_id' => ['sometimes', 'nullable', 'string', 'max:100', Rule::unique('staff_profiles', 'employee_id')->ignore($profile?->id)],
            'department' => ['sometimes', 'nullable', 'string', Rule::in(self::DEPARTMENTS)],
            'position' => ['sometimes', 'nullable', 'string', 'max:120'],
            'employment_status' => ['sometimes', 'nullable', 'string', Rule::in(self::EMPLOYMENT_STATUSES)],
            'employment_start_date' => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'campus' => ['sometimes', 'nullable', 'string', 'max:150'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', Rule::in(self::PERMISSIONS)],
        ]);

        DB::transaction(function () use ($staff, $profile, $validated, $request) {
            $profile = $profile ?: StaffProfile::create(['user_id' => $staff->id, 'permissions' => []]);
            foreach (['email', 'contact_number'] as $field) {
                if (array_key_exists($field, $validated)) {
                    $staff->{$field} = $field === 'email' ? strtolower($validated[$field]) : $validated[$field];
                }
            }
            if (array_key_exists('name', $validated)) {
                $staff->name = $validated['name'];
            }
            $staff->save();

            $profileFields = [
                'first_name', 'middle_name', 'last_name', 'suffix', 'date_of_birth',
                'employee_id', 'department', 'position', 'employment_status',
                'employment_start_date', 'campus',
            ];
            $changed = [];
            foreach ($profileFields as $field) {
                if (array_key_exists($field, $validated)) {
                    $profile->{$field} = $validated[$field];
                    $changed[] = $field;
                }
            }
            if (array_key_exists('permissions', $validated)) {
                $profile->permissions = array_values(array_unique($validated['permissions']));
                $changed[] = 'permissions';
            }
            if (in_array('first_name', $changed, true) || in_array('middle_name', $changed, true) || in_array('last_name', $changed, true) || in_array('suffix', $changed, true)) {
                $parts = collect([$profile->first_name, $profile->middle_name, $profile->last_name, $profile->suffix])->filter(fn ($part) => filled($part));
                if ($parts->isNotEmpty()) {
                    $staff->name = $parts->implode(' ');
                    $staff->save();
                }
            }
            $profile->save();
            if ($changed !== []) {
                $this->record($profile, $request->user()->id, 'profile_updated', $staff->status, $staff->status, 'Staff profile or permissions updated.', ['fields' => $changed]);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Staff account updated successfully.',
            'staff' => $this->safeStaff($staff->fresh('staffProfile')),
        ]);
    }

    public function approve(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', Rule::in(self::PERMISSIONS)],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        $staff = $this->findStaff($user);
        if ($staff->status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Only pending applications can be approved.'], 422);
        }

        DB::transaction(function () use ($staff, $request, $validated) {
            $profile = $staff->staffProfile ?: StaffProfile::create(['user_id' => $staff->id]);
            $from = $staff->status;
            $staff->status = 'active';
            $staff->save();
            $profile->permissions = array_values(array_unique($validated['permissions'] ?? []));
            $profile->reviewed_by = $request->user()->id;
            $profile->reviewed_at = now();
            $profile->decision_reason = $validated['note'] ?? null;
            $profile->archived_at = null;
            $profile->save();
            $this->record($profile, $request->user()->id, 'approved', $from, 'active', $validated['note'] ?? 'Application approved.', ['permissions' => $profile->permissions]);
        });

        $staff = $staff->fresh('staffProfile');

        return response()->json(['success' => true, 'message' => 'Staff application approved.', 'staff' => $this->safeStaff($staff)]);
    }

    public function reject(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ]);
        $staff = $this->findStaff($user);
        if ($staff->status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Only pending applications can be rejected.'], 422);
        }

        DB::transaction(function () use ($staff, $request, $validated) {
            $profile = $staff->staffProfile ?: StaffProfile::create(['user_id' => $staff->id]);
            $from = $staff->status;
            $staff->status = 'rejected';
            $staff->save();
            $profile->permissions = [];
            $profile->reviewed_by = $request->user()->id;
            $profile->reviewed_at = now();
            $profile->decision_reason = $validated['reason'];
            $profile->save();
            $staff->tokens()->delete();
            $this->record($profile, $request->user()->id, 'rejected', $from, 'rejected', $validated['reason']);
        });

        $staff = $staff->fresh('staffProfile');
        return response()->json(['success' => true, 'message' => 'Staff application rejected.', 'staff' => $this->safeStaff($staff)]);
    }

    public function reopen(Request $request, User $user): JsonResponse
    {
        $staff = DB::transaction(function () use ($request, $user) {
            $lockedStaff = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            abort_unless($lockedStaff->role === 'staff', 404, 'Staff account not found.');

            if ($lockedStaff->status !== 'rejected') {
                return null;
            }

            $profile = $lockedStaff->staffProfile()->lockForUpdate()->first();
            if (! $profile) {
                $profile = StaffProfile::create([
                    'user_id' => $lockedStaff->id,
                    'permissions' => [],
                ]);
            }

            $previousReason = $profile->decision_reason;
            $lockedStaff->status = 'pending';
            $lockedStaff->save();

            $profile->permissions = [];
            $profile->reviewed_by = null;
            $profile->reviewed_at = null;
            $profile->decision_reason = null;
            $profile->archived_at = null;
            $profile->save();

            // Reopening never restores access; rejected accounts should have no active tokens.
            $lockedStaff->tokens()->delete();

            $historyNote = 'Application returned to pending review.';
            if (filled($previousReason)) {
                $historyNote .= ' Previous rejection reason: '.$previousReason;
            }

            $this->record(
                $profile,
                $request->user()->id,
                'reopened',
                'rejected',
                'pending',
                $historyNote,
                ['previous_rejection_reason' => $previousReason]
            );

            return $lockedStaff->load('staffProfile');
        });

        if (! $staff) {
            return response()->json([
                'success' => false,
                'message' => 'Only rejected Staff applications can be reopened.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Staff application returned to pending review. No Staff access was granted.',
            'staff' => $this->safeStaff($staff),
        ]);
    }

    public function restore(Request $request, User $user): JsonResponse
    {
        $staff = DB::transaction(function () use ($request, $user) {
            $lockedStaff = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            abort_unless($lockedStaff->role === 'staff', 404, 'Staff account not found.');

            if ($lockedStaff->status !== 'archived') {
                return null;
            }

            $profile = $lockedStaff->staffProfile()->lockForUpdate()->first();
            if (! $profile) {
                $profile = StaffProfile::create([
                    'user_id' => $lockedStaff->id,
                    'permissions' => [],
                ]);
            }

            $previousReview = [
                'permissions' => $profile->permissions ?? [],
                'reviewed_by' => $profile->reviewed_by,
                'reviewed_at' => $profile->reviewed_at?->toIso8601String(),
                'decision_reason' => $profile->decision_reason,
            ];

            $lockedStaff->status = 'pending';
            $lockedStaff->save();

            // Restoring an archived account only returns it to review; it never restores access.
            $profile->permissions = [];
            $profile->reviewed_by = null;
            $profile->reviewed_at = null;
            $profile->decision_reason = null;
            $profile->archived_at = null;
            $profile->save();
            $lockedStaff->tokens()->delete();

            $this->record(
                $profile,
                $request->user()->id,
                'restored_for_review',
                'archived',
                'pending',
                'Archived Staff account restored to pending review; access permissions were cleared.',
                ['previous_review' => $previousReview]
            );

            return $lockedStaff->load('staffProfile');
        });

        if (! $staff) {
            return response()->json([
                'success' => false,
                'message' => 'Only archived Staff accounts can be restored.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Staff account restored to pending review. No Staff access was granted.',
            'staff' => $this->safeStaff($staff),
        ]);
    }

    public function suspend(Request $request, User $user): JsonResponse
    {
        $staff = $this->findStaff($user);
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

        $staff = app(AccountEnforcementService::class)->apply(
            $staff,
            $request->user(),
            $validated['action'],
            $validated['reason'],
            isset($validated['duration_days']) ? (int) $validated['duration_days'] : null,
        );

        $this->notifyEnforcement($staff, $validated['action'], $validated['reason'], $validated['duration_days'] ?? null);
        $staff->load(['staffProfile', 'enforcementEvents.actor']);

        return response()->json([
            'success' => true,
            'message' => $validated['action'] === 'warning'
                ? 'Staff account warning recorded successfully.'
                : 'Staff account enforcement recorded; access is suspended for the selected period.',
            'staff' => $this->safeStaff($staff, true),
        ]);
    }

    public function deactivate(Request $request, User $user): JsonResponse
    {
        return $this->suspend($request, $user);
    }

    public function activate(Request $request, User $user): JsonResponse
    {
        $staff = $this->findStaff($user);
        if (! in_array($staff->status, ['suspended', 'inactive'], true)) {
            return response()->json(['success' => false, 'message' => 'Only previously approved suspended Staff accounts can be reactivated.'], 422);
        }

        $staff = app(AccountEnforcementService::class)->reinstate($staff, $request->user());
        $staff->load(['staffProfile', 'enforcementEvents.actor']);

        return response()->json([
            'success' => true,
            'message' => 'Staff account access restored successfully.',
            'staff' => $this->safeStaff($staff, true),
        ]);
    }

    public function archive(Request $request, User $user): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Staff accounts cannot be archived through account management.',
        ], 403);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Staff accounts cannot be deleted through account management.',
        ], 403);
    }

    private function findStaff(User $user): User
    {
        abort_unless($user->role === 'staff', 404, 'Staff account not found.');
        return $user->loadMissing('staffProfile');
    }

    private function record(StaffProfile $profile, ?int $actorId, string $event, ?string $from, ?string $to, ?string $note = null, array $metadata = []): void
    {
        StaffApplicationEvent::create([
            'staff_profile_id' => $profile->id,
            'actor_id' => $actorId,
            'event' => $event,
            'from_status' => $from,
            'to_status' => $to,
            'note' => $note,
            'metadata' => $metadata ?: null,
        ]);
    }

    private function approvalStatus(User $staff): string
    {
        return match (strtolower((string) $staff->status)) {
            'pending' => 'pending',
            'rejected' => 'rejected',
            default => 'approved',
        };
    }

    private function accountStatus(User $staff): string
    {
        $status = strtolower((string) $staff->status);

        return in_array($status, ['active', 'inactive', 'suspended', 'archived'], true)
            ? $status
            : 'not_active';
    }

    private function presenceStatus(User $staff): string
    {
        $lastSeenAt = $staff->staffProfile?->last_seen_at;
        $timeoutMinutes = max(1, (int) config('app.staff_presence_timeout_minutes', 5));
        $tokensCount = $staff->getAttribute('tokens_count');
        $hasActiveToken = $tokensCount === null
            ? $staff->tokens()->exists()
            : (int) $tokensCount > 0;

        return $staff->status === 'active'
            && $lastSeenAt !== null
            && $lastSeenAt->greaterThanOrEqualTo(now()->subMinutes($timeoutMinutes))
            && $hasActiveToken
                ? 'online'
                : 'offline';
    }

    private function safeStaff(User $staff, bool $includeHistory = false): array
    {
        $profile = $staff->staffProfile;
        $result = [
            'id' => $staff->id,
            'name' => $staff->name,
            'student_id' => $staff->student_id,
            'email' => $staff->email,
            'contact_number' => $staff->contact_number,
            'role' => $staff->role,
            'status' => $staff->status,
            'suspended_until' => $staff->suspended_until?->toIso8601String(),
            'approval_status' => $this->approvalStatus($staff),
            'account_status' => $this->accountStatus($staff),
            'presence' => $this->presenceStatus($staff),
            'last_seen_at' => $profile?->last_seen_at?->toIso8601String(),
            'profile_picture' => $staff->profile_picture,
            'created_at' => $staff->created_at,
            'updated_at' => $staff->updated_at,
            'staff_permissions' => $profile?->permissions ?? [],
            'profile' => $profile ? [
                'first_name' => $profile->first_name,
                'middle_name' => $profile->middle_name,
                'last_name' => $profile->last_name,
                'suffix' => $profile->suffix,
                'date_of_birth' => $profile->date_of_birth?->toDateString(),
                'employee_id' => $profile->employee_id,
                'department' => $profile->department,
                'position' => $profile->position,
                'employment_status' => $profile->employment_status,
                'employment_start_date' => $profile->employment_start_date?->toDateString(),
                'campus' => $profile->campus,
                'has_verification_document' => filled($profile->verification_document_path),
                'is_admin_created' => $profile->is_admin_created,
                'reviewed_by' => $profile->reviewed_by,
                'reviewer_name' => $profile->reviewer?->name,
                'reviewed_at' => $profile->reviewed_at,
                'decision_reason' => $profile->decision_reason,
                'archived_at' => $profile->archived_at,
            ] : null,
        ];

        if ($includeHistory) {
            $applicationHistory = ($profile?->events ?? collect())->map(fn (StaffApplicationEvent $event) => [
                'id' => 'application-'.$event->id,
                'event' => $event->event,
                'from_status' => $event->from_status,
                'to_status' => $event->to_status,
                'note' => $event->note,
                'metadata' => $event->metadata,
                'actor_name' => $event->actor?->name,
                'created_at' => $event->created_at,
            ]);
            $enforcementHistory = $staff->enforcementEvents->map(fn ($event): array => [
                'id' => 'enforcement-'.$event->id,
                'event' => $event->action,
                'from_status' => null,
                'to_status' => null,
                'note' => $event->reason,
                'metadata' => [
                    'duration_days' => $event->duration_days,
                    'suspended_until' => $event->suspended_until?->toIso8601String(),
                ],
                'actor_name' => $event->actor?->name,
                'created_at' => $event->created_at,
            ]);
            $result['history'] = $applicationHistory
                ->concat($enforcementHistory)
                ->sortByDesc('created_at')
                ->values();
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
