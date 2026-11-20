<?php

namespace App\Http\Controllers;

use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
        $activeListings = $student->products()
            ->whereRaw('LOWER(status) = ?', ['active'])
            ->where('stock_quantity', '>', 0)
            ->whereNull('archived_at')
            ->where(function (Builder $query): void {
                $query->whereNull('category_id')
                    ->orWhereHas('categoryRecord', fn (Builder $category) => $category->where('status', 'active'));
            })
            ->count();
        $productsSold = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.seller_id', $student->id)
            ->where('orders.status', 'completed')
            ->whereNotNull('orders.completed_at')
            ->where('orders.payment_status', 'paid')
            ->sum('order_items.quantity');

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
            'products_count' => $activeListings,
            'products_sold' => (int) $productsSold,
            'reviews_count' => $reviewCount,
            'average_rating' => round($averageRating, 2),
            'is_following' => $request->user()->following()
                ->whereKey($student->getKey())
                ->exists(),
            'is_self' => $request->user()->is($student),
        ]);
    }
}
