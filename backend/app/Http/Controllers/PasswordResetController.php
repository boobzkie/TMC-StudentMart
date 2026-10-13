<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    public function sendResetLink(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        Password::sendResetLink([
            'email' => strtolower(trim($validated['email'])),
        ]);

        // Keep the response identical for known and unknown email addresses.
        return response()->json([
            'success' => true,
            'message' => 'If an account matches that email, password-reset instructions have been sent.',
        ]);
    }

    public function reset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            [
                'token' => $validated['token'],
                'email' => strtolower(trim($validated['email'])),
                'password' => $validated['password'],
                'password_confirmation' => $request->input('password_confirmation'),
            ],
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                // Password recovery ends existing Sanctum sessions.
                $user->tokens()->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'success' => false,
                'message' => 'This reset link is invalid or expired. Request a new password-reset link.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Your password has been reset. You can now sign in with your new password.',
        ]);
    }
}
