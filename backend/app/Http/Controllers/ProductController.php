<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaveProductRequest;

use App\Models\Category;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class ProductController extends Controller
{
    private const MAX_IMAGES = 4;

    private const MAX_GALLERY_IMAGE_KB = 1536;

    private const MAX_STOCK = 4294967295;

    public function index(Request $request): JsonResponse
    {
        $visibleSoldOutCutoff = now()->subHour();
        $products = Product::with(['user:id,name,student_id,contact_number,share_contact_info,facebook_url,instagram_url,tiktok_url', 'images', 'categoryRecord:id,name', 'variants' => fn ($query) => $query->where('is_active', true)])
            ->where(function ($query) use ($visibleSoldOutCutoff): void {
                $query->whereRaw('LOWER(status) = ?', ['active'])
                    ->orWhere(function ($soldOut) use ($visibleSoldOutCutoff): void {
                        $soldOut->whereRaw('LOWER(status) = ?', ['sold_out'])
                            ->where('sold_out_at', '>', $visibleSoldOutCutoff);
                    });
            })
            ->where(function ($query): void {
                $query->whereNull('category_id')
                    ->orWhereHas('categoryRecord', function ($category): void {
                        $category->where('status', 'active');
                    });
            })
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Product $product) => $this->productData($product));

        return response()->json([
            'success' => true,
            'products' => $products,
            'total' => $products->count(),
        ]);
    }

    public function myProducts(Request $request): JsonResponse
    {
        $products = Product::where('user_id', $request->user()->id)
            ->with(['user:id,name,student_id,contact_number,share_contact_info,facebook_url,instagram_url,tiktok_url', 'images', 'categoryRecord:id,name', 'variants' => fn ($query) => $query->where('is_active', true)])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Product $product) => $this->productData($product));

        return response()->json([
            'success' => true,
            'products' => $products,
            'total' => $products->count(),
        ]);
    }

    public function store(SaveProductRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $category = $this->resolveCategory($validated);
        $variants = $validated['variants'] ?? [];
        if ($variants !== []) {
            $variantStockTotal = $this->variantStockTotal($variants);
            if ($variantStockTotal <= 0) {
                throw ValidationException::withMessages([
                    'variants' => ['At least one product variant must have available stock.'],
                ]);
            }
        }
        $files = $this->incomingImages($request);
        $this->ensurePhotoLimit($files, self::MAX_IMAGES);

        $primaryIndex = isset($validated['primary_image_index'])
            ? (int) $validated['primary_image_index']
            : ($files === [] ? null : 0);
        if ($primaryIndex !== null) {
            $this->ensurePrimaryIndex($primaryIndex, $files);
        }
        $storedPaths = $this->storeImages($files);
        $coverPath = $primaryIndex === null ? null : ($storedPaths[$primaryIndex] ?? null);

        try {
            $product = DB::transaction(function () use ($request, $validated, $category, $storedPaths, $primaryIndex, $coverPath, $variants): Product {
                $product = Product::create([
                    'user_id' => $request->user()->id,
                    'name' => $validated['name'],
                    'description' => $validated['description'],
                    'price' => $validated['price'],
                    'category_id' => $category->id,
                    'category' => $category->name,
                    'image' => $coverPath,
                    'status' => 'pending',
                    'attributes' => $validated['attributes'] ?? null,
                    'stock_quantity' => $variants !== []
                        ? array_sum(array_column($variants, 'stock_quantity'))
                        : (int) ($validated['stock_quantity'] ?? 1),
                ]);

                $product->historyEvents()->create([
                    'actor_id' => $request->user()->id,
                    'event' => 'listing_created',
                    'stock_after' => $product->stock_quantity,
                    'note' => 'Listing submitted for moderation.',
                ]);

                if ($variants !== []) {
                    $this->syncVariants($product, $variants, (int) $request->user()->id);
                }

                foreach ($storedPaths as $index => $path) {
                    $product->images()->create([
                        'path' => $path,
                        'sort_order' => $index,
                        'is_primary' => $index === $primaryIndex,
                    ]);
                }

                return $product->load(['user:id,name,student_id,contact_number,share_contact_info,facebook_url,instagram_url,tiktok_url', 'images', 'categoryRecord:id,name', 'variants' => fn ($query) => $query->where('is_active', true)]);
            });
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($storedPaths);
            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'Product submitted successfully. Waiting for admin approval.',
            'product' => $this->productData($product),
        ], 201);
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        $isActive = strtolower((string) $product->status) === 'active';
        $isRecentlySoldOut = strtolower((string) $product->status) === 'sold_out'
            && $product->sold_out_at !== null
            && $product->sold_out_at->greaterThan(now()->subHour());
        $isOwner = (int) $product->user_id === (int) $request->user()->id;
        $isArchived = strtolower((string) $product->status) === 'archived';

        if ($isArchived && ! $isOwner) {
            return response()->json([
                'success' => false,
                'message' => 'Product is no longer available.',
            ], 404);
        }

        if (! $isActive && ! $isRecentlySoldOut && ! $isOwner) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found.',
            ], 404);
        }

        $product->load(['user:id,name,student_id,contact_number,share_contact_info,facebook_url,instagram_url,tiktok_url', 'images', 'categoryRecord:id,name']);

        return response()->json([
            'success' => true,
            'product' => $this->productData($product),
        ]);
    }

    public function update(SaveProductRequest $request, Product $product): JsonResponse
    {
        if ($product->user_id !== $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to edit this product.',
            ], 403);
        }

        if ($product->status === 'archived') {
            return response()->json([
                'success' => false,
                'message' => 'Archived listings cannot be edited. Create a new listing instead.',
            ], 409);
        }

        $validated = $request->validated();
        if ($product->variants()->where('is_active', true)->exists()
            && ! array_key_exists('variants', $validated)) {
            throw ValidationException::withMessages([
                'variants' => ['Include this listing’s variants when saving changes so variant stock is preserved.'],
            ]);
        }
        if (isset($validated['variants'])) {
            $variantStockTotal = $this->variantStockTotal($validated['variants']);
            if ($variantStockTotal <= 0) {
                throw ValidationException::withMessages([
                    'variants' => ['At least one product variant must have available stock.'],
                ]);
            }
        }
        if (isset($validated['variants'])
            && ! $product->variants()->exists()
            && OrderItem::query()
                ->where('product_id', $product->id)
                ->whereNull('product_variant_id')
                ->whereHas('order', fn ($query) => $query->where('status', 'pending'))
                ->exists()) {
            throw ValidationException::withMessages([
                'variants' => ['This listing has a pending order. Wait for that order to finish before adding variants.'],
            ]);
        }
        $category = $this->resolveCategory($validated);
        $currentImages = $product->images()->get();
        $removeIds = array_map('intval', $validated['remove_image_ids'] ?? []);
        $currentIds = $currentImages->modelKeys();
        $unknownIds = array_diff($removeIds, $currentIds);

        if ($unknownIds !== []) {
            throw ValidationException::withMessages([
                'remove_image_ids' => 'One or more selected photos do not belong to this product.',
            ]);
        }

        $remainingImages = $currentImages
            ->reject(fn ($image) => in_array($image->id, $removeIds, true))
            ->values();
        $files = $this->incomingImages($request);

        // Older clients send one `image` field to replace the current cover.
        if ($request->hasFile('image') && ! $request->hasFile('images')) {
            $oldCover = $currentImages->firstWhere('is_primary', true)
                ?? $currentImages->first();
            if ($oldCover !== null && ! in_array($oldCover->id, $removeIds, true)) {
                $removeIds[] = $oldCover->id;
                $remainingImages = $currentImages
                    ->reject(fn ($image) => in_array($image->id, $removeIds, true))
                    ->values();
            }
        }
        $this->ensurePhotoLimit($files, self::MAX_IMAGES - $remainingImages->count());

        $primaryId = isset($validated['primary_image_id'])
            ? (int) $validated['primary_image_id']
            : null;
        $primaryIndex = isset($validated['primary_image_index'])
            ? (int) $validated['primary_image_index']
            : null;

        if ($primaryId !== null && $primaryIndex !== null) {
            throw ValidationException::withMessages([
                'primary_image_id' => 'Choose either an existing photo or a new photo as the cover.',
            ]);
        }

        if ($primaryId !== null && ! $remainingImages->contains('id', $primaryId)) {
            throw ValidationException::withMessages([
                'primary_image_id' => 'The selected cover photo must be kept on this product.',
            ]);
        }

        if ($primaryIndex !== null) {
            $this->ensurePrimaryIndex($primaryIndex, $files);
        }

        // Keep compatibility with older clients that replace the legacy `image` field.
        if ($request->hasFile('image') && ! $request->hasFile('images') && $primaryId === null && $primaryIndex === null) {
            $primaryIndex = 0;
        }

        $oldPaths = $currentImages
            ->whereIn('id', $removeIds)
            ->pluck('path')
            ->all();
        $storedPaths = $this->storeImages($files);

        try {
            $product = DB::transaction(function () use (
                $product,
                $validated,
                $category,
                $removeIds,
                $remainingImages,
                $storedPaths,
                $primaryId,
                $primaryIndex,
                $request
            ): Product {
                $product = Product::query()
                    ->whereKey($product->getKey())
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($removeIds !== []) {
                    $product->images()->whereIn('id', $removeIds)->delete();
                }

                $nextOrder = ((int) $remainingImages->max('sort_order')) + 1;
                $newImages = collect();
                foreach ($storedPaths as $index => $path) {
                    $newImages->push($product->images()->create([
                        'path' => $path,
                        'sort_order' => $nextOrder + $index,
                        'is_primary' => false,
                    ]));
                }

                $existingPrimary = $remainingImages->firstWhere('is_primary', true)
                    ?? $remainingImages->first();
                $cover = $primaryId !== null
                    ? $remainingImages->firstWhere('id', $primaryId)
                    : ($primaryIndex !== null
                        ? $newImages->get($primaryIndex)
                        : ($existingPrimary ?? $newImages->first()));

                foreach ($remainingImages as $image) {
                    $image->is_primary = $cover !== null && $image->id === $cover->id;
                    $image->save();
                }
                foreach ($newImages as $image) {
                    $image->is_primary = $cover !== null && $image->id === $cover->id;
                    $image->save();
                }

                $oldStatus = $product->status;
                $oldStock = (int) $product->stock_quantity;
                $nextStock = array_key_exists('variants', $validated)
                    ? $this->syncVariants($product, $validated['variants'], (int) $request->user()->id)
                    : (int) ($validated['stock_quantity'] ?? $oldStock);
                $product->name = $validated['name'];
                $product->description = $validated['description'];
                $product->price = $validated['price'];
                $product->category_id = $category->id;
                $product->category = $category->name;
                $product->image = $cover?->path;
                $product->status = 'pending';
                $product->stock_quantity = $nextStock;
                if (array_key_exists('attributes', $validated)) {
                    $product->attributes = $validated['attributes'] ?: null;
                }
                $product->sold_out_at = null;
                $product->save();

                $product->historyEvents()->create([
                    'actor_id' => $request->user()->id,
                    'event' => 'listing_resubmitted',
                    'stock_before' => $oldStock,
                    'stock_after' => $nextStock,
                    'note' => 'Seller updated the listing: '.$oldStatus.' → pending moderation.',
                ]);

                if ($oldStock !== $nextStock) {
                    $product->historyEvents()->create([
                        'actor_id' => $request->user()->id,
                        'event' => 'stock_adjusted',
                        'stock_before' => $oldStock,
                        'stock_after' => $nextStock,
                        'note' => 'Stock changed while the listing was resubmitted for moderation.',
                    ]);
                }

                return $product->fresh()->load(['user:id,name,student_id,contact_number,share_contact_info,facebook_url,instagram_url,tiktok_url', 'images', 'categoryRecord:id,name', 'variants' => fn ($query) => $query->where('is_active', true)]);
            });
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($storedPaths);
            throw $exception;
        }

        Storage::disk('public')->delete(array_values(array_unique(array_filter($oldPaths))));

        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully. Waiting for admin approval.',
            'product' => $this->productData($product),
        ]);
    }

    public function updateStock(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'stock_quantity' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'variant_id' => ['sometimes', 'nullable', 'integer'],
        ]);

        $product = DB::transaction(function () use ($request, $product, $validated): Product {
            $lockedProduct = Product::query()
                ->whereKey($product->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ((int) $lockedProduct->user_id !== (int) $request->user()->id) {
                abort(403, 'You are not allowed to manage this product stock.');
            }

            if (! in_array($lockedProduct->status, ['active', 'sold_out'], true)) {
                abort(409, 'Stock can only be changed for active or recently sold-out listings.');
            }

            $hasVariants = $lockedProduct->variants()->exists();
            $activeVariants = $lockedProduct->variants()->where('is_active', true)->get();
            $previousStatus = $lockedProduct->status;
            $productStockBefore = (int) $lockedProduct->stock_quantity;
            $after = (int) $validated['stock_quantity'];

            if ($hasVariants) {
                if ($activeVariants->isEmpty()) {
                    throw ValidationException::withMessages([
                        'variant_id' => ['This listing has no active options. Edit the listing before managing stock.'],
                    ]);
                }

                $variantId = (int) ($validated['variant_id'] ?? 0);
                if ($variantId <= 0) {
                    throw ValidationException::withMessages([
                        'variant_id' => ['Choose a variant when managing stock for this listing.'],
                    ]);
                }

                $variant = $lockedProduct->variants()
                    ->whereKey($variantId)
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->first();
                if (! $variant) {
                    throw ValidationException::withMessages([
                        'variant_id' => ['The selected variant does not belong to this active listing.'],
                    ]);
                }

                $before = (int) $variant->stock_quantity;
                if ($before === $after) {
                    return $lockedProduct->fresh()->load(['images', 'categoryRecord:id,name', 'variants' => fn ($query) => $query->where('is_active', true)]);
                }

                $variant->stock_quantity = $after;
                $variant->save();
                $aggregate = (int) $lockedProduct->variants()->where('is_active', true)->sum('stock_quantity');
                if ($aggregate > self::MAX_STOCK) {
                    throw ValidationException::withMessages([
                        'stock_quantity' => ['The combined stock for this listing exceeds the supported limit.'],
                    ]);
                }
                $this->setProductAggregateStock($lockedProduct, $aggregate, $previousStatus);
                $lockedProduct->historyEvents()->create([
                    'actor_id' => $request->user()->id,
                    'product_variant_id' => $variant->id,
                    'variant_label_snapshot' => $variant->label,
                    'variant_attributes_snapshot' => $variant->attributes,
                    'event' => 'variant_stock_adjusted',
                    'stock_before' => $before,
                    'stock_after' => $after,
                    'note' => 'Seller updated stock for variant '.$variant->label.'.',
                ]);

                if ($aggregate === 0 && $previousStatus !== 'sold_out') {
                    $lockedProduct->historyEvents()->create([
                        'actor_id' => $request->user()->id,
                        'event' => 'sold_out',
                        'stock_before' => $productStockBefore,
                        'stock_after' => 0,
                        'note' => 'All active product variants are out of stock.',
                    ]);
                } elseif ($previousStatus === 'sold_out' && $aggregate > 0) {
                    $lockedProduct->historyEvents()->create([
                        'actor_id' => $request->user()->id,
                        'event' => 'restocked',
                        'stock_before' => 0,
                        'stock_after' => $aggregate,
                        'note' => 'A product variant was restocked; the listing is available again.',
                    ]);
                }

                return $lockedProduct->fresh()->load(['images', 'categoryRecord:id,name', 'variants' => fn ($query) => $query->where('is_active', true)]);
            }

            if (! empty($validated['variant_id'])) {
                throw ValidationException::withMessages([
                    'variant_id' => ['This listing does not have product variants.'],
                ]);
            }

            $before = (int) $lockedProduct->stock_quantity;
            if ($before === $after) {
                return $lockedProduct;
            }

            $this->setProductAggregateStock($lockedProduct, $after, $previousStatus);
            $lockedProduct->historyEvents()->create([
                'actor_id' => $request->user()->id,
                'event' => 'stock_adjusted',
                'stock_before' => $before,
                'stock_after' => $after,
                'note' => 'Seller updated available stock.',
            ]);

            if ($after === 0 && $previousStatus !== 'sold_out') {
                $lockedProduct->historyEvents()->create([
                    'actor_id' => $request->user()->id,
                    'event' => 'sold_out',
                    'stock_before' => $before,
                    'stock_after' => 0,
                    'note' => 'Listing has no available stock.',
                ]);
            } elseif ($previousStatus === 'sold_out' && $after > 0) {
                $lockedProduct->historyEvents()->create([
                    'actor_id' => $request->user()->id,
                    'event' => 'restocked',
                    'stock_before' => $before,
                    'stock_after' => $after,
                    'note' => 'Seller restocked the listing; it is available again.',
                ]);
            }

            return $lockedProduct->fresh()->load(['user:id,name,student_id,contact_number,share_contact_info,facebook_url,instagram_url,tiktok_url', 'images', 'categoryRecord:id,name']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Stock updated successfully.',
            'product' => $this->productData($product),
        ]);
    }

    public function history(Request $request, Product $product): JsonResponse
    {
        if ((int) $product->user_id !== (int) $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to view this product history.',
            ], 403);
        }

        $product->load([
            'user:id,name,student_id,contact_number,share_contact_info,facebook_url,instagram_url,tiktok_url',
            'images',
            'categoryRecord:id,name',
            'historyEvents.actor:id,name',
            'historyEvents.order:id,order_number,status,created_at,updated_at',
            'historyEvents.variant',
            'moderationEvents.actor:id,name',
            'warnings.actor:id,name',
        ]);

        $timeline = collect([[
            'event' => 'listing_created',
            'label' => 'Listing created',
            'occurred_at' => $product->created_at,
            'note' => 'Initial status: '.str_replace('_', ' ', $product->status).'.',
            'stock_before' => null,
            'stock_after' => (int) $product->stock_quantity,
            'actor' => $product->user?->name,
        ]]);

        foreach ($product->historyEvents as $event) {
            $timeline->push([
                'event' => $event->event,
                'label' => str($event->event)->replace('_', ' ')->ucfirst()->toString(),
                'occurred_at' => $event->created_at,
                'note' => $event->note,
                'stock_before' => $event->stock_before,
                'stock_after' => $event->stock_after,
                'variant_label' => $event->variant_label_snapshot,
                'variant_attributes' => $event->variant_attributes_snapshot ?? [],
                'actor' => $event->actor?->name,
                'order_number' => $event->order?->order_number,
                'order_status' => $event->order?->status,
            ]);
        }

        foreach ($product->moderationEvents as $event) {
            $timeline->push([
                'event' => 'moderation',
                'label' => 'Moderation: '.str_replace('_', ' ', (string) $event->to_status),
                'occurred_at' => $event->created_at,
                'note' => $event->reason,
                'stock_before' => null,
                'stock_after' => null,
                'actor' => $event->actor?->name,
            ]);
        }

        foreach ($product->warnings as $warning) {
            $timeline->push([
                'event' => 'warning',
                'label' => 'Seller warning',
                'occurred_at' => $warning->created_at,
                'note' => $warning->reason,
                'stock_before' => null,
                'stock_after' => null,
                'actor' => $warning->actor?->name,
            ]);
        }

        $orderItems = OrderItem::query()
            ->where('product_id', $product->id)
            ->with(['order.buyer:id,name,student_id'])
            ->latest()
            ->get();

        foreach ($orderItems as $item) {
            if (! $item->order) {
                continue;
            }
            $timeline->push([
                'event' => 'order_activity',
                'label' => 'Order activity',
                'occurred_at' => $item->order->created_at,
                'note' => 'Order status: '.str_replace('_', ' ', $item->order->status).'.',
                'stock_before' => null,
                'stock_after' => null,
                'actor' => $item->order->buyer?->name,
                'order_number' => $item->order->order_number,
                'order_status' => $item->order->status,
                'quantity' => (int) $item->quantity,
                'amount' => $item->line_total,
                'variant_label' => $item->variant_label_snapshot,
                'variant_attributes' => $item->variant_attributes_snapshot ?? [],
            ]);
        }

        $productPayload = $this->productData($product);
        unset($productPayload['history_events'], $productPayload['moderation_events']);

        return response()->json([
            'success' => true,
            'product' => $productPayload,
            'history' => $timeline->sortByDesc('occurred_at')->values(),
        ]);
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        if ((int) $product->user_id !== (int) $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to archive this product.',
            ], 403);
        }

        $product = DB::transaction(function () use ($request, $product): Product {
            $lockedProduct = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            if ($lockedProduct->status !== 'archived') {
                $before = (int) $lockedProduct->stock_quantity;
                $fromStatus = $lockedProduct->status;
                $lockedProduct->status = 'archived';
                $lockedProduct->archived_at = now();
                $lockedProduct->save();
                $lockedProduct->historyEvents()->create([
                    'actor_id' => $request->user()->id,
                    'event' => 'seller_archived',
                    'stock_before' => $before,
                    'stock_after' => $before,
                    'note' => 'Seller archived listing from status '.$fromStatus.'.',
                ]);
            }

            return $lockedProduct->fresh()->load(['user:id,name,student_id,contact_number,share_contact_info,facebook_url,instagram_url,tiktok_url', 'images', 'categoryRecord:id,name']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Listing archived. Its orders and history are preserved.',
            'product' => $this->productData($product),
        ]);
    }

    private function resolveCategory(array $validated): Category
    {
        $category = isset($validated['category_id'])
            ? Category::query()
                ->whereKey($validated['category_id'])
                ->where('status', 'active')
                ->first()
            : Category::query()
                ->where('name', trim((string) ($validated['category'] ?? '')))
                ->where('status', 'active')
                ->first();

        if (! $category) {
            $field = isset($validated['category_id']) ? 'category_id' : 'category';
            throw ValidationException::withMessages([
                $field => ['Choose an active marketplace category.'],
            ]);
        }

        if (isset($validated['category'])
            && trim($validated['category']) !== $category->name) {
            throw ValidationException::withMessages([
                'category_id' => ['The category ID and category name do not match.'],
            ]);
        }

        return $category;
    }

    /** @return list<UploadedFile> */
    private function incomingImages(Request $request): array
    {
        $files = [];
        if ($request->hasFile('image')) {
            $files[] = $request->file('image');
        }

        $galleryFiles = $request->file('images', []);
        if ($galleryFiles instanceof UploadedFile) {
            $galleryFiles = [$galleryFiles];
        }

        foreach ((array) $galleryFiles as $file) {
            if ($file instanceof UploadedFile) {
                $files[] = $file;
            }
        }

        return $files;
    }

    /** @param list<UploadedFile> $files */
    private function ensurePhotoLimit(array $files, int $allowed): void
    {
        if ($allowed < 0 || count($files) > $allowed) {
            throw ValidationException::withMessages([
                'images' => 'A product can have up to '.self::MAX_IMAGES.' photos in total. Remove a photo before adding another.',
            ]);
        }
    }

    /** @param list<UploadedFile> $files */
    private function ensurePrimaryIndex(int $index, array $files): void
    {
        if ($index < 0 || $index >= count($files)) {
            throw ValidationException::withMessages([
                'primary_image_index' => 'Select a photo that was included in this upload.',
            ]);
        }
    }

    /** @param list<UploadedFile> $files
     *  @return list<string>
     */
    private function storeImages(array $files): array
    {
        $paths = [];
        try {
            foreach ($files as $file) {
                $path = $file->store('products', 'public');
                if (! is_string($path) || $path === '') {
                    throw new \RuntimeException('The product photo could not be saved.');
                }
                $paths[] = $path;
            }
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($paths);
            throw $exception;
        }

        return $paths;
    }

    private function productData(Product $product): array
    {
        $viewerIsOwner = (int) Auth::id() === (int) $product->user_id;
        $product->loadMissing(['user:id,name,student_id,contact_number,share_contact_info,facebook_url,instagram_url,tiktok_url', 'images', 'categoryRecord:id,name', 'variants' => fn ($query) => $query->where('is_active', true)]);
        if ($viewerIsOwner) {
            $product->loadMissing(['latestModerationEvent', 'warnings.actor:id,name']);
        }
        $data = $product->toArray();
        $seller = $product->user;
        $data['user'] = $seller ? [
            'id' => $seller->id,
            'name' => $seller->name,
            'student_id' => $seller->student_id,
        ] : null;
        if ($seller?->share_contact_info) {
            foreach (['contact_number', 'facebook_url', 'instagram_url', 'tiktok_url'] as $field) {
                if (filled($seller->{$field})) {
                    $data['user'][$field] = $seller->{$field};
                }
            }
        }
        unset($data['latest_moderation_event']);
        if ($viewerIsOwner) {
            $latestEvent = $product->latestModerationEvent;
            $data['rejection_reason'] = $product->status === 'rejected'
                && $latestEvent?->to_status === 'rejected'
                    ? $latestEvent->reason
                    : null;
            $data['warnings'] = $product->warnings->map(fn ($warning) => [
                'id' => $warning->id,
                'reason' => $warning->reason,
                'created_at' => $warning->created_at,
                'reviewer' => $warning->actor?->name,
            ])->values()->all();
        }
        $images = $product->images->values();
        $primary = $images->firstWhere('is_primary', true) ?? $images->first();
        $data['image'] = $primary?->path ?? $product->image;
        $data['images'] = $images->map(fn ($image) => [
            'id' => $image->id,
            'path' => $image->path,
            'sort_order' => $image->sort_order,
            'is_primary' => (bool) $image->is_primary,
        ])->all();

        // Keep old product rows readable if the gallery migration has not backfilled a path.
        if ($data['images'] === [] && $product->image) {
            $data['images'] = [[
                'id' => null,
                'path' => $product->image,
                'sort_order' => 0,
                'is_primary' => true,
            ]];
        }

        return $data;
    }

    /** @param list<array{id?: int|null, label: string, attributes?: array<string, string>, stock_quantity: int}> $variants */
    private function syncVariants(Product $product, array $variants, int $actorId): int
    {
        $existing = $product->variants()->lockForUpdate()->get()->keyBy('id');
        $keptIds = [];

        foreach ($variants as $row) {
            $variantId = isset($row['id']) ? (int) $row['id'] : 0;
            $variant = $variantId > 0 ? $existing->get($variantId) : null;
            if ($variantId > 0 && ! $variant) {
                throw ValidationException::withMessages([
                    'variants' => ['A submitted variant does not belong to this product.'],
                ]);
            }

            $isNew = $variant === null;
            $before = $isNew ? 0 : (int) $variant->stock_quantity;
            $previousLabel = $isNew ? null : (string) $variant->label;
            $previousAttributes = $isNew ? null : $variant->attributes;
            $label = trim((string) $row['label']);
            $attributes = $row['attributes'] ?? null;
            $attributes = $attributes ?: null;
            $quantity = (int) $row['stock_quantity'];
            $detailsChanged = ! $isNew
                && ($previousLabel !== $label || $previousAttributes !== $attributes);

            if ($isNew) {
                $variant = $product->variants()->make();
            }
            $variant->label = $label;
            $variant->attributes = $attributes;
            $variant->stock_quantity = $quantity;
            $variant->is_active = true;
            $variant->save();
            $keptIds[] = (int) $variant->id;

            if ($isNew || $before !== $quantity || $detailsChanged) {
                $product->historyEvents()->create([
                    'actor_id' => $actorId,
                    'product_variant_id' => $variant->id,
                    'variant_label_snapshot' => $label,
                    'variant_attributes_snapshot' => $attributes,
                    'event' => $isNew
                        ? 'variant_created'
                        : ($before !== $quantity ? 'variant_stock_adjusted' : 'variant_details_updated'),
                    'stock_before' => $before,
                    'stock_after' => $quantity,
                    'note' => $isNew
                        ? 'Product variant created.'
                        : ($before !== $quantity
                            ? 'Seller adjusted stock for variant '.$label.'.'
                            : 'Seller updated details for variant '.$label.'.'),
                ]);
            }
        }

        foreach ($existing as $variant) {
            if ($variant->is_active && ! in_array((int) $variant->id, $keptIds, true)) {
                $before = (int) $variant->stock_quantity;
                $variant->is_active = false;
                $variant->save();
                $product->historyEvents()->create([
                    'actor_id' => $actorId,
                    'product_variant_id' => $variant->id,
                    'variant_label_snapshot' => $variant->label,
                    'variant_attributes_snapshot' => $variant->attributes,
                    'event' => 'variant_deactivated',
                    'stock_before' => $before,
                    'stock_after' => $before,
                    'note' => 'Seller removed variant '.$variant->label.' from this listing.',
                ]);
            }
        }

        return $this->variantStockTotal(
            $product->variants()->where('is_active', true)->pluck('stock_quantity')->all()
        );
    }

    /** @param list<array<string, mixed>|int|string> $variants */
    private function variantStockTotal(array $variants): int
    {
        $quantities = array_map(
            static fn (array|int|string $variant): int => is_array($variant)
                ? (int) ($variant['stock_quantity'] ?? 0)
                : (int) $variant,
            $variants
        );
        $total = array_sum($quantities);

        if ($total > self::MAX_STOCK) {
            throw ValidationException::withMessages([
                'variants' => ['Combined variant stock cannot exceed 4,294,967,295 units.'],
            ]);
        }

        return (int) $total;
    }

    private function setProductAggregateStock(Product $product, int $stock, string $previousStatus): void
    {
        $product->stock_quantity = $stock;
        if ($stock === 0) {
            $product->status = 'sold_out';
            $product->sold_out_at ??= now();
        } elseif ($previousStatus === 'sold_out') {
            $product->status = 'active';
            $product->sold_out_at = null;
        }
        $product->save();
    }
}
