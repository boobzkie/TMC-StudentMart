<?php

namespace App\Http\Controllers;

use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SellerProfileController extends Controller
{
    public function show(Request $request, User $student): JsonResponse
    {
        abort_unless($student->isStudent() && $student->isActive(), 404);

        $reviews = ProductReview::query()
            ->whereHas('product', fn (Builder $query) => $query->where('user_id', $student->id))
            ->whereHas('reviewer', fn (Builder $query) => $query
                ->where('role', 'student')
                ->where('status', 'active'));
        $reviewCount = (clone $reviews)->count();
        $averageRating = (float) ((clone $reviews)->avg('rating') ?? 0);

        return response()->json([
            'success' => true,
            'student' => [
                'id' => (int) $student->id,
                'name' => $student->name,
                'username' => $student->username ?: 'student'.$student->id,
                'bio' => $student->bio,
                'course' => $student->course,
                'profile_picture' => $student->profile_picture,
                'joined_at' => $student->created_at?->toDateString(),
            ],
            'followers_count' => $student->followers()
                ->where('users.role', 'student')
                ->where('users.status', 'active')
                ->count(),
            'following_count' => $student->following()
                ->where('users.role', 'student')
                ->where('users.status', 'active')
                ->count(),
            'products_count' => $student->products()
                ->whereIn('status', ['active', 'sold_out'])
                ->count(),
            'reviews_count' => $reviewCount,
            'average_rating' => round($averageRating, 2),
            'is_following' => $request->user()->following()
                ->whereKey($student->getKey())
                ->exists(),
            'is_self' => $request->user()->is($student),
        ]);
    }
}
