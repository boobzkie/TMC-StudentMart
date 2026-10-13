<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffPresenceController extends Controller
{
    public function heartbeat(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user instanceof User && $user->isStaff() && $user->status === 'active',
            403,
            'An approved, active Staff account is required.'
        );

        $profile = $user->staffProfile;
        if (! $profile) {
            return response()->json([
                'success' => false,
                'message' => 'Staff profile not found.',
            ], 409);
        }

        $now = now();
        if ($profile->last_seen_at === null || $profile->last_seen_at->lt($now->copy()->subMinute())) {
            $profile->forceFill(['last_seen_at' => $now])->save();
        }

        return response()->json([
            'success' => true,
            'presence' => 'online',
            'last_seen_at' => $profile->fresh()->last_seen_at?->toIso8601String(),
        ]);
    }
}