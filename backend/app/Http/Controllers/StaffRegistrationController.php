<?php

namespace App\Http\Controllers;

use App\Models\StaffApplicationEvent;
use App\Models\StaffProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StaffRegistrationController extends Controller
{
    private const DEPARTMENTS = ['BSIT', 'BSOA', 'BSCRIM', 'BSED', 'CAS'];
    private const EMPLOYMENT_STATUSES = ['Regular', 'Part-Time', 'Contractual'];

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'suffix' => ['nullable', 'string', 'max:30'],
            'date_of_birth' => ['required', 'date', 'before:today'],
            'contact_number' => ['required', 'string', 'max:30'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'employee_id' => ['nullable', 'string', 'max:100', 'unique:staff_profiles,employee_id'],
            'department' => ['required', 'string', 'in:'.implode(',', self::DEPARTMENTS)],
            'position' => ['required', 'string', 'max:120'],
            'employment_status' => ['required', 'string', 'in:'.implode(',', self::EMPLOYMENT_STATUSES)],
            'employment_start_date' => ['nullable', 'date', 'before_or_equal:today'],
            'campus' => ['nullable', 'string', 'max:150'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'terms_accepted' => ['accepted'],
            'verification_document' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ]);

        $reference = Str::random(48);
        $documentPath = $request->file('verification_document')->store('staff-verification', 'local');

        try {
            $user = DB::transaction(function () use ($validated, $reference, $documentPath) {
                $fullName = collect([
                    $validated['first_name'],
                    $validated['middle_name'] ?? null,
                    $validated['last_name'],
                    $validated['suffix'] ?? null,
                ])->filter(fn ($part) => filled($part))->implode(' ');

                $user = User::create([
                    'name' => $fullName,
                    'student_id' => null,
                    'email' => strtolower($validated['email']),
                    'contact_number' => $validated['contact_number'],
                    'password' => Hash::make($validated['password']),
                    'role' => 'staff',
                    'status' => 'pending',
                ]);

                $profile = StaffProfile::create([
                    'user_id' => $user->id,
                    'first_name' => $validated['first_name'],
                    'middle_name' => $validated['middle_name'] ?? null,
                    'last_name' => $validated['last_name'],
                    'suffix' => $validated['suffix'] ?? null,
                    'date_of_birth' => $validated['date_of_birth'],
                    'employee_id' => $validated['employee_id'] ?? null,
                    'department' => $validated['department'],
                    'position' => $validated['position'],
                    'employment_status' => $validated['employment_status'],
                    'employment_start_date' => $validated['employment_start_date'] ?? null,
                    'campus' => $validated['campus'] ?? null,
                    'verification_document_path' => $documentPath,
                    'application_reference_hash' => hash('sha256', $reference),
                    'permissions' => [],
                ]);

                StaffApplicationEvent::create([
                    'staff_profile_id' => $profile->id,
                    'event' => 'submitted',
                    'from_status' => null,
                    'to_status' => 'pending',
                    'note' => 'Staff application submitted.',
                ]);

                return $user;
            });
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($documentPath);
            throw $exception;
        }
return response()->json([
            'success' => true,
            'message' => 'Your Staff registration has been submitted successfully. Please wait for the TMC Administrator to review and approve your application.',
            'application_reference' => $reference,
            'status' => 'pending',
            'email' => $user->email,
        ], 201);
    }

    public function status(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'application_reference' => ['required', 'string', 'min:24', 'max:100'],
        ]);

        $user = User::query()
            ->where('role', 'staff')
            ->where('email', strtolower($validated['email']))
            ->with('staffProfile')
            ->first();
        $profile = $user?->staffProfile;

        if (! $profile || ! $profile->application_reference_hash || ! hash_equals(
            $profile->application_reference_hash,
            hash('sha256', $validated['application_reference'])
        )) {
            return response()->json([
                'success' => false,
                'message' => 'The email or application reference does not match our records.',
            ], 404);
        }

        $status = $user->status;
        $message = match ($status) {
            'pending' => 'Your application is waiting for administrator review.',
            'active' => 'Your application has been approved. You may sign in with your account.',
            'rejected' => 'Your application was not approved. Review the administrator note below.',
            'suspended' => 'Your staff access is currently suspended. Contact the TMC Administrator.',
            default => 'Your application status is '.strtolower((string) $status).'.',
        };

        return response()->json([
            'success' => true,
            'status' => $status,
            'message' => $message,
            'decision_reason' => $status === 'rejected' ? $profile->decision_reason : null,
            'submitted_at' => $user->created_at,
            'reviewed_at' => $profile->reviewed_at,
        ]);
    }
}
