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

        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);
        $user = $request->user();
        $query = $user->notifications()
            ->orderByDesc('created_at')
            ->orderByDesc('id');
        $pagination = null;

        if (array_key_exists('page', $validated) || array_key_exists('per_page', $validated)) {
            $perPage = (int) ($validated['per_page'] ?? 25);
            $page = $query->paginate($perPage, ['*'], 'page', (int) ($validated['page'] ?? 1));
            $notifications = $page->getCollection();
            $total = $page->total();
            $pagination = [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $total,
            ];
        } else {
            $notifications = $query->limit(100)->get();
            $total = $notifications->count();
        }

        $payload = [
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
                    'duration_days' => isset($data['duration_days']) ? (int) $data['duration_days'] : null,
                    'suspended_until' => isset($data['suspended_until']) ? (string) $data['suspended_until'] : null,
                    'created_at' => $notification->created_at,
                    'read_at' => $notification->read_at,
                ];
            })->values(),
            'total' => $total,
        ];

        if ($pagination !== null) {
            $payload['pagination'] = $pagination;
        }

        return response()->json($payload);
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
