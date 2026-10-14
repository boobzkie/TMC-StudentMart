<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const COURSES = ['BSIT', 'BSOA', 'BSCRIM', 'BSED', 'CAS'];

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'student_id' => ['required', 'string', 'max:50', 'unique:users,student_id'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'contact_number' => ['required', 'string', 'max:30'],
            'course' => ['nullable', 'string', 'in:' . implode(',', self::COURSES)],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'profile_picture' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $profilePicture = null;

        if ($request->hasFile('profile_picture')) {
            $profilePicture = $request->file('profile_picture')
                ->store('profile-pictures', 'public');
        }

        $user = User::create([
            'name' => $validated['name'],
            'student_id' => $validated['student_id'],
            'email' => strtolower($validated['email']),
            'contact_number' => $validated['contact_number'],
            'course' => $validated['course'] ?? null,
            'password' => Hash::make($validated['password']),
            'role' => 'student',
            'status' => 'active',
            'profile_picture' => $profilePicture,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Registration successful. Please sign in with your email and password.',
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()
            ->where('email', strtolower($credentials['email']))
            ->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (strtolower((string) $user->status) !== 'active') {
            $status = strtolower((string) $user->status);

            $message = match ($status) {
                'pending' => 'Your Staff application is still waiting for administrator approval.',
                'rejected' => 'Your Staff application was not approved. Check your application status for the decision note.',
                'suspended' => 'Your Staff access has been suspended. Contact the TMC Administrator.',
                'archived' => 'This Staff account is archived and cannot sign in.',
                default => 'Your account is not active.',
            };

            return response()->json([
                'success' => false,
                'message' => $message,
                'status' => $user->status,
            ], 403);
        }

        $user->tokens()->delete();

        $token = $user->createToken('tmc-studentmart')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
    }

    public function user(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user instanceof User
                && strtolower((string) $user->status) === 'active',
            403
        );

        return response()->json([
            'success' => true,
            'user' => $this->userPayload($user),
        ]);
    }

    /**
     * Update Admin or Staff portal account settings.
     * Existing Admin/Staff behavior is preserved.
     */
    public function updatePortalProfile(Request $request): JsonResponse
    {
        $user = $this->requirePortalAccount($request);

        $allowedFields = $user->isStaff()
            ? [
                'first_name',
                'middle_name',
                'last_name',
                'suffix',
                'date_of_birth',
                'contact_number',
                'profile_picture',
            ]
            : [
                'name',
                'contact_number',
                'profile_picture',
            ];

        $submittedFields = array_unique(array_merge(
            array_keys($request->input()),
            array_keys($request->allFiles()),
        ));

        if (array_diff($submittedFields, $allowedFields) !== []) {
            throw ValidationException::withMessages([
                'profile' => [
                    'One or more submitted fields cannot be changed from account settings.',
                ],
            ]);
        }

        $rules = [
            'contact_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'profile_picture' => [
                'sometimes',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:2048',
            ],
        ];

        if ($user->isStaff()) {
            $rules += [
                'first_name' => ['sometimes', 'required', 'string', 'max:100'],
                'middle_name' => ['sometimes', 'nullable', 'string', 'max:100'],
                'last_name' => ['sometimes', 'required', 'string', 'max:100'],
                'suffix' => ['sometimes', 'nullable', 'string', 'max:30'],
                'date_of_birth' => ['sometimes', 'required', 'date', 'before:today'],
            ];
        } else {
            $rules['name'] = ['sometimes', 'required', 'string', 'max:255'];
        }

        $validated = $request->validate($rules);
        $profilePicture = $request->file('profile_picture');

        unset($validated['profile_picture']);

        if ($user->isStaff()) {
            $staffFields = [
                'first_name',
                'middle_name',
                'last_name',
                'suffix',
                'date_of_birth',
            ];

            $profileChanges = array_intersect_key(
                $validated,
                array_flip($staffFields)
            );

            if ($profileChanges !== []) {
                $profile = $user->staffProfile()->firstOrNew();
                $profile->fill($profileChanges);
                $profile->save();

                $nameParts = array_filter([
                    $profile->first_name,
                    $profile->middle_name,
                    $profile->last_name,
                    $profile->suffix,
                ], fn ($part) => is_string($part) && trim($part) !== '');

                $fullName = trim(implode(' ', $nameParts));

                if ($fullName !== '') {
                    $user->name = $fullName;
                }
            }
        } elseif (array_key_exists('name', $validated)) {
            $user->name = $validated['name'];
        }

        if (array_key_exists('contact_number', $validated)) {
            $user->contact_number = $validated['contact_number'];
        }

        if ($profilePicture) {
            $user->profile_picture = $profilePicture
                ->store('profile-pictures', 'public');
        }

        $user->save();
        $user->refresh()->loadMissing('staffProfile');

        return response()->json([
            'success' => true,
            'message' => 'Profile information was updated.',
            'user' => $this->userPayload($user),
        ]);
    }

    /**
     * Change an Admin or Staff password.
     */
    public function updatePortalPassword(Request $request): JsonResponse
    {
        $user = $this->requirePortalAccount($request);

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->password = Hash::make($validated['password']);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully.',
        ]);
    }

    /**
     * Update the authenticated student's own profile.
     *
     * This endpoint is also protected by the student middleware
     * registered in routes/api.php.
     */
    public function updateStudentProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user instanceof User
                && $user->isStudent()
                && strtolower((string) $user->status) === 'active',
            403
        );

        $allowedFields = [
            'name',
            'contact_number',
            'course',
            'facebook_url',
            'instagram_url',
            'tiktok_url',
            'share_contact_info',
        ];

        $submittedFields = array_keys($request->all());

        if (array_diff($submittedFields, $allowedFields) !== []) {
            throw ValidationException::withMessages([
                'profile' => [
                    'You cannot change your student ID, email, role, or account status here.',
                ],
            ]);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'contact_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'course' => ['sometimes', 'nullable', 'string', 'in:' . implode(',', self::COURSES)],
            'facebook_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'instagram_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'tiktok_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'share_contact_info' => ['sometimes', 'boolean'],
        ]);

        foreach ($validated as $field => $value) {
            $user->{$field} = is_string($value) && trim($value) === ''
                ? null
                : $value;
        }

        $user->save();
        $user->refresh();

        return response()->json([
            'success' => true,
            'message' => 'Student profile updated successfully.',
            'user' => $this->userPayload($user),
        ]);
    }

    /**
     * Change the authenticated student's own password.
     */
    public function updateStudentPassword(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user instanceof User
                && $user->isStudent()
                && strtolower((string) $user->status) === 'active',
            403
        );

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->password = Hash::make($validated['password']);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully.',
        ]);
    }

    private function requirePortalAccount(Request $request): User
    {
        $user = $request->user();

        abort_unless(
            $user instanceof User
                && ($user->isAdmin() || $user->isStaff())
                && strtolower((string) $user->status) === 'active',
            403
        );

        return $user;
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user instanceof User && $user->isStaff() && $user->staffProfile) {
            $user->staffProfile->forceFill([
                'last_seen_at' => now(),
            ])->save();
        }

        $user?->currentAccessToken()?->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * Payload for the authenticated account.
     *
     * Contact number is included here because this is the authenticated
     * user's own account endpoint. Do not reuse this payload for public
     * seller or product responses.
     */
    private function userPayload(User $user): array
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

            'facebook_url' => $user->facebook_url,
            'instagram_url' => $user->instagram_url,
            'tiktok_url' => $user->tiktok_url,
            'share_contact_info' => (bool) $user->share_contact_info,

            'created_at' => $user->created_at,

            'staff_permissions' => $user->isStaff()
                ? ($user->staffProfile?->permissions ?? [])
                : [],

            'staff_profile' => $user->isStaff() && $user->staffProfile ? [
                'first_name' => $user->staffProfile->first_name,
                'middle_name' => $user->staffProfile->middle_name,
                'last_name' => $user->staffProfile->last_name,
                'suffix' => $user->staffProfile->suffix,
                'date_of_birth' => $user->staffProfile->date_of_birth?->toDateString(),
                'employee_id' => $user->staffProfile->employee_id,
                'department' => $user->staffProfile->department,
                'position' => $user->staffProfile->position,
                'employment_status' => $user->staffProfile->employment_status,
                'employment_start_date' => $user->staffProfile->employment_start_date?->toDateString(),
                'campus' => $user->staffProfile->campus,
            ] : null,
        ];
    }
}
