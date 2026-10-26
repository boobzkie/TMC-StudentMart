<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductWarning;
use App\Notifications\ProductModerationNotification;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminProductController extends Controller
{
    /** List and filter products for an Admin or authorized Staff moderator. */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['all', 'pending', 'active', 'approved', 'rejected', 'inactive', 'suspended', 'sold_out', 'archived'])],
            'category' => ['nullable', 'string', 'max:120'],
            'category_id' => ['nullable', 'integer', 'min:1'],
            'seller' => ['nullable', 'string', 'max:120'],
            'seller_id' => ['nullable', 'integer', 'min:1'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);

        if (isset($filters['date_from'], $filters['date_to']) && $filters['date_to'] < $filters['date_from']) {
            throw ValidationException::withMessages([
                'date_to' => ['The end date must be on or after the start date.'],
            ]);
        }

        $query = Product::query()
            ->with([
                'user:id,name,student_id,email',
                'images',
                'variants',
                'categoryRecord:id,name',
                'moderationEvents.actor:id,name',
                'warnings.actor:id,name',
            ])
            ->orderByDesc('created_at');

        if (filled($filters['search'] ?? null)) {
            $search = trim($filters['search']);
            $query->where(function (Builder $builder) use ($search) {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%")
                    ->orWhereHas('user', function (Builder $user) use ($search) {
                        $user->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('student_id', 'like', "%{$search}%");
                    });
            });
        }

        if (filled($filters['status'] ?? null) && $filters['status'] !== 'all') {
            $status = $filters['status'] === 'approved' ? 'active' : $filters['status'];
            $query->where('status', $status);
        }

        if (filled($filters['category'] ?? null)) {
            $category = trim($filters['category']);
            $query->where('category', 'like', "%{$category}%");
        }

        if (filled($filters['category_id'] ?? null)) {
            $query->where('category_id', $filters['category_id']);
        }

        if (filled($filters['seller'] ?? null)) {
            $seller = trim($filters['seller']);
            $query->whereHas('user', function (Builder $user) use ($seller) {
                $user->where('name', 'like', "%{$seller}%")
                    ->orWhere('email', 'like', "%{$seller}%")
                    ->orWhere('student_id', 'like', "%{$seller}%");
            });
        }

        if (filled($filters['seller_id'] ?? null)) {
            $query->where('user_id', $filters['seller_id']);
        }

        if (filled($filters['date_from'] ?? null)) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (filled($filters['date_to'] ?? null)) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        $products = $query->get();
        $groupedStatusCounts = Product::query()
            ->selectRaw('LOWER(status) as status, COUNT(*) as total')
            ->groupByRaw('LOWER(status)')
            ->pluck('total', 'status');
        $statusCounts = [
            'pending' => (int) ($groupedStatusCounts['pending'] ?? 0),
            'approved' => (int) ($groupedStatusCounts['active'] ?? 0) + (int) ($groupedStatusCounts['approved'] ?? 0),
            'rejected' => (int) ($groupedStatusCounts['rejected'] ?? 0),
            'suspended' => (int) ($groupedStatusCounts['suspended'] ?? 0),
        ];

        return response()->json([
            'success' => true,
            'products' => $products,
            'total' => $products->count(),
            'status_counts' => $statusCounts,
        ]);
    }

    /** Display one product with its moderation history. */
    public function show(Product $product): JsonResponse
    {
        return response()->json([
            'success' => true,
            'product' => $this->loadProduct($product),
        ]);
    }

    public function approve(Request $request, Product $product): JsonResponse
    {
        return $this->recordDecision($request, $product, 'active', null);
    }

    public function reject(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ]);

        return $this->recordDecision($request, $product, 'rejected', trim($validated['reason']));
    }

    public function warn(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
            'complaint_id' => ['nullable', 'integer', 'exists:complaints,id'],
        ]);
        $reason = trim($validated['reason']);

        $warning = DB::transaction(function () use ($request, $product, $validated, $reason): ProductWarning {
            $lockedProduct = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            abort_if((int) $lockedProduct->user_id === (int) $request->user()->id, 403, 'You cannot moderate your own product.');
            abort_unless($lockedProduct->status === 'active', 409, 'Only an active listing can receive a warning.');

            if (! empty($validated['complaint_id'])) {
                $belongsToProduct = $lockedProduct->complaints()->whereKey($validated['complaint_id'])->exists();
                abort_unless($belongsToProduct, 422, 'The selected complaint does not belong to this product.');
            }

            return $lockedProduct->warnings()->create([
                'actor_id' => $request->user()->id,
                'complaint_id' => $validated['complaint_id'] ?? null,
                'reason' => $reason,
            ]);
        });

        $product->refresh();
        $product->user?->notify(new ProductModerationNotification($product, 'product_warning', $reason, $warning));

        return response()->json([
            'success' => true,
            'message' => 'Warning recorded and sent to the seller. The listing remains active.',
            'product' => $this->loadProduct($product),
        ]);
    }

    public function suspend(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
            'complaint_id' => ['nullable', 'integer', 'exists:complaints,id'],
        ]);
        $reason = trim($validated['reason']);

        $suspended = DB::transaction(function () use ($request, $product, $validated, $reason): ?Product {
            $lockedProduct = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            abort_if((int) $lockedProduct->user_id === (int) $request->user()->id, 403, 'You cannot moderate your own product.');
            abort_unless($lockedProduct->status === 'active', 409, 'Only an active listing can be suspended.');

            if (! empty($validated['complaint_id'])) {
                $belongsToProduct = $lockedProduct->complaints()->whereKey($validated['complaint_id'])->exists();
                abort_unless($belongsToProduct, 422, 'The selected complaint does not belong to this product.');
            }

            $lockedProduct->status = 'suspended';
            $lockedProduct->save();
            $lockedProduct->moderationEvents()->create([
                'actor_id' => $request->user()->id,
                'from_status' => 'active',
                'to_status' => 'suspended',
                'reason' => $reason,
            ]);

            return $lockedProduct->fresh();
        });

        $suspended->user?->notify(new ProductModerationNotification($suspended, 'product_suspended', $reason));

        return response()->json([
            'success' => true,
            'message' => 'Product listing suspended and seller notified.',
            'product' => $this->loadProduct($suspended),
        ]);
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        $archived = DB::transaction(function () use ($request, $product): Product {
            $lockedProduct = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            if ($lockedProduct->status !== 'archived') {
                $before = (int) $lockedProduct->stock_quantity;
                $fromStatus = $lockedProduct->status;
                $lockedProduct->status = 'archived';
                $lockedProduct->archived_at = now();
                $lockedProduct->save();
                $lockedProduct->historyEvents()->create([
                    'actor_id' => $request->user()->id,
                    'event' => 'admin_archived',
                    'stock_before' => $before,
                    'stock_after' => $before,
                    'note' => 'Administrator archived listing from status '.$fromStatus.'.',
                ]);
            }

            return $lockedProduct->fresh();
        });

        return response()->json([
            'success' => true,
            'message' => 'Product archived. Existing order and history records are preserved.',
            'product_id' => $archived->id,
            'status' => $archived->status,
        ]);
    }

    public function restore(Request $request, Product $product): JsonResponse
    {
        $restored = DB::transaction(function () use ($request, $product): Product {
            $lockedProduct = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();

            abort_unless(
                $lockedProduct->status === 'archived',
                409,
                'Only archived products can be restored.'
            );

            $stockBefore = (int) $lockedProduct->stock_quantity;
            $fromStatus = $lockedProduct->status;
            $lockedProduct->status = 'pending';
            $lockedProduct->save();

            $lockedProduct->historyEvents()->create([
                'actor_id' => $request->user()->id,
                'event' => 'admin_restored',
                'stock_before' => $stockBefore,
                'stock_after' => $stockBefore,
                'note' => 'Administrator restored listing from archived. Reopened for moderation review (moved to pending).',
            ]);

            return $lockedProduct->fresh();
        });

        return response()->json([
            'success' => true,
            'message' => 'Archived product restored for moderation review. It is not active in the marketplace until approved.',
            'product' => $this->loadProduct($restored),
        ]);
    }

    private function recordDecision(Request $request, Product $product, string $toStatus, ?string $reason): JsonResponse
    {
        $result = DB::transaction(function () use ($request, $product, $toStatus, $reason) {
            $lockedProduct = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();

            abort_if(
                (int) $lockedProduct->user_id === (int) $request->user()->id,
                403,
                'You cannot moderate your own product.'
            );

            if ($lockedProduct->status !== 'pending') {
                return null;
            }

            if ($toStatus === 'active' && (int) $lockedProduct->stock_quantity < 1) {
                abort(422, 'A listing needs at least one unit in stock before it can be approved.');
            }

            $fromStatus = $lockedProduct->status;
            $lockedProduct->status = $toStatus;
            $lockedProduct->save();
            $lockedProduct->moderationEvents()->create([
                'actor_id' => $request->user()->id,
                'from_status' => $fromStatus,
                'to_status' => $toStatus,
                'reason' => $reason,
            ]);

            return $this->loadProduct($lockedProduct->fresh());
        });

        if ($result === null) {
            return response()->json([
                'success' => false,
                'message' => 'This product is no longer pending review. Refresh the list before taking another action.',
            ], 409);
        }

        return response()->json([
            'success' => true,
            'message' => $toStatus === 'active' ? 'Product approved successfully.' : 'Product rejected successfully.',
            'product' => $result,
        ]);
    }

    private function loadProduct(Product $product): Product
    {
        return $product->load([
            'user:id,name,student_id,email',
            'images',
            'variants',
            'categoryRecord:id,name',
            'moderationEvents.actor:id,name',
            'warnings.actor:id,name',
        ]);
    }
}
