<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProductReviewController extends Controller
{
    private const PAGE_SIZE = 20;

    public function index(Request $request, Product $product): JsonResponse
    {
        $reviews = $this->visibleReviews($product);
        $page = (clone $reviews)
            ->with('reviewer:id,name,profile_picture')
            ->latest()
            ->paginate(self::PAGE_SIZE);
        $reviewed = ProductReview::query()
            ->where('product_id', $product->id)
            ->where('reviewer_id', $request->user()->id)
            ->exists();
        $eligible = $this->eligibleOrders($request->user(), $product)->exists();

        return response()->json([
            'success' => true,
            'reviews' => $page->getCollection()->map(fn (ProductReview $review): array => $this->reviewData($review))->values(),
            'total' => $page->total(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'average_rating' => round((float) (clone $reviews)->avg('rating'), 2),
            'can_review' => $eligible && ! $reviewed,
            'already_reviewed' => $reviewed,
            'eligibility_message' => $this->eligibilityMessage($eligible, $reviewed),
        ]);
    }

    public function sellerIndex(Request $request, User $student): JsonResponse
    {
        abort_unless($student->isStudent() && $student->isActive(), 404);

        $query = $this->visibleReviewsForSeller($student);
        $page = (clone $query)
            ->with([
                'reviewer:id,name,profile_picture',
                'product:id,name,image,price,user_id',
                'product.images',
            ])
            ->latest()
            ->paginate(self::PAGE_SIZE);

        return response()->json([
            'success' => true,
            'reviews' => $page->getCollection()->map(function (ProductReview $review): array {
                $data = $this->reviewData($review);
                $data['product'] = [
                    'id' => $review->product?->id,
                    'name' => $review->product?->name,
                    'price' => $review->product?->price,
                    'image' => $review->product?->images
                        ->firstWhere('is_primary', true)?->path
                        ?? $review->product?->images->first()?->path
                        ?? $review->product?->image,
                ];

                return $data;
            })->values(),
            'total' => $page->total(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'average_rating' => round((float) (clone $query)->avg('rating'), 2),
        ]);
    }

    public function store(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'title' => ['nullable', 'string', 'max:120'],
            'comment' => ['required', 'string', 'min:3', 'max:2000'],
        ]);
        $validated['title'] = isset($validated['title'])
            ? trim(strip_tags($validated['title']))
            : null;
        $validated['comment'] = trim(strip_tags($validated['comment']));
        if (mb_strlen($validated['comment']) < 3) {
            throw ValidationException::withMessages([
                'comment' => ['Write at least 3 characters using plain text.'],
            ]);
        }
        if ($validated['title'] === '') {
            $validated['title'] = null;
        }

        try {
            $review = DB::transaction(function () use ($request, $product, $validated): ProductReview {
                $existing = ProductReview::query()
                    ->where('product_id', $product->id)
                    ->where('reviewer_id', $request->user()->id)
                    ->exists();
                if ($existing) {
                    abort(409, 'You have already reviewed this product.');
                }

                $order = $this->eligibleOrders($request->user(), $product)
                    ->orderByDesc('completed_at')
                    ->lockForUpdate()
                    ->first();
                if (! $order) {
                    throw ValidationException::withMessages([
                        'eligibility' => ['You can review this product after a completed order confirms you received it.'],
                    ]);
                }

                return ProductReview::query()->create([
                    'product_id' => $product->id,
                    'reviewer_id' => $request->user()->id,
                    'order_id' => $order->id,
                    'rating' => $validated['rating'],
                    'title' => $validated['title'],
                    'comment' => $validated['comment'],
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            abort(409, 'You have already reviewed this product.');
        }

        $review->load('reviewer:id,name,profile_picture');

        return response()->json([
            'success' => true,
            'message' => 'Your verified buyer review has been submitted.',
            'review' => $this->reviewData($review),
        ], 201);
    }

    private function eligibleOrders(User $buyer, Product $product): Builder
    {
        return Order::query()
            ->where('buyer_id', $buyer->id)
            ->where('status', 'completed')
            ->whereNotNull('completed_at')
            ->whereHas('items', fn (Builder $query) => $query->where('product_id', $product->id));
    }

    private function visibleReviews(Product $product): Builder
    {
        return ProductReview::query()
            ->where('product_id', $product->id)
            ->whereHas('reviewer', fn (Builder $query) => $query
                ->where('role', 'student')
                ->where('status', 'active'));
    }

    private function visibleReviewsForSeller(User $student): Builder
    {
        return ProductReview::query()
            ->whereHas('product', fn (Builder $query) => $query->where('user_id', $student->id))
            ->whereHas('reviewer', fn (Builder $query) => $query
                ->where('role', 'student')
                ->where('status', 'active'));
    }

    private function eligibilityMessage(bool $eligible, bool $reviewed): string
    {
        if ($reviewed) {
            return 'You have already reviewed this product.';
        }
        if ($eligible) {
            return 'Your completed order is verified. You can review this product.';
        }

        return 'Only students with a completed order confirming receipt can review this product.';
    }

    /** @return array<string, mixed> */
    private function reviewData(ProductReview $review): array
    {
        return [
            'id' => $review->id,
            'rating' => $review->rating,
            'title' => $review->title,
            'comment' => $review->comment,
            'created_at' => $review->created_at?->toIso8601String(),
            'reviewer' => [
                'id' => $review->reviewer?->id,
                'name' => $review->reviewer?->name ?? 'Former student',
                'profile_picture' => $review->reviewer?->profile_picture,
            ],
        ];
    }
}
