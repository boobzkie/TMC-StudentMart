<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->notificationAccessDenial($request)) {
            return $denied;
        }

        $user = $request->user();
        $notifications = $user->notifications()
            ->latest()
            ->limit(100)
            ->get();

        return response()->json([
            'success' => true,
            'unread_count' => $user->unreadNotifications()->count(),
            'notifications' => $notifications->map(function ($notification): array {
                $data = $notification->data ?? [];

                return [
                    'id' => (string) $notification->id,
                    'event' => (string) ($data['event'] ?? ''),
                    'title' => (string) ($data['title'] ?? 'Notification'),
                    'message' => (string) ($data['message'] ?? ''),
                    'order_id' => isset($data['order_id']) ? (int) $data['order_id'] : null,
                    'order_number' => (string) ($data['order_number'] ?? ''),
                    'status' => (string) ($data['status'] ?? ''),
                    'product_id' => isset($data['product_id']) ? (int) $data['product_id'] : null,
                    'warning_id' => isset($data['warning_id']) ? (int) $data['warning_id'] : null,
                    'complaint_id' => isset($data['complaint_id']) ? (int) $data['complaint_id'] : null,
                    'created_at' => $notification->created_at,
                    'read_at' => $notification->read_at,
                ];
            })->values(),
            'total' => $notifications->count(),
        ]);
    }

    public function markRead(Request $request, string $notificationId): JsonResponse
    {
        if ($denied = $this->notificationAccessDenial($request)) {
            return $denied;
        }

        $notification = $request->user()
            ->notifications()
            ->whereKey($notificationId)
            ->firstOrFail();

        if ($notification->read_at === null) {
            $notification->markAsRead();
        }

        return response()->json([
            'success' => true,
            'notification' => [
                'id' => (string) $notification->id,
                'read_at' => $notification->fresh()->read_at,
            ],
        ]);
    }

    private function notificationAccessDenial(Request $request): ?JsonResponse
    {
        $user = $request->user();
        $allowedRoles = ['student', 'staff', 'admin'];

        if (! $user || $user->status !== 'active' || ! in_array($user->role, $allowedRoles, true)) {
            return response()->json([
                'success' => false,
                'message' => 'An active Student, Staff, or Administrator account is required.',
            ], 403);
        }

        return null;
    }
}
