<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderIdempotencyKey;
use App\Models\OrderItem;
use App\Models\OrderPaymentMethod;
use App\Models\PickupLocation;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\OrderEventNotification;
use App\Services\CommissionRecordingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    private const MAX_STOCK = 4294967295;

    private const ORDER_STATUSES = [
        'pending',
        'confirmed',
        'ready_for_pickup',
        'declined',
        'completed',
        'cancelled',
    ];

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'idempotency_key' => [
                'sometimes',
                'nullable',
                'string',
                'max:128',
                'regex:/\A[A-Za-z0-9._:-]+\z/',
            ],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.variant_id' => ['sometimes', 'nullable', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'payment_method_id' => ['required', 'integer', 'exists:order_payment_methods,id'],
            'pickup_location_id' => ['required', 'integer', 'exists:pickup_locations,id'],
            'buyer_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $lineKeys = [];
        foreach ($validated['items'] as $index => $line) {
            $lineKey = (int) $line['product_id'].':'.(isset($line['variant_id']) ? (int) $line['variant_id'] : 'simple');
            if (isset($lineKeys[$lineKey])) {
                throw ValidationException::withMessages([
                    'items.'.$index => ['Each product or product variant can appear only once in an order.'],
                ]);
            }
            $lineKeys[$lineKey] = true;
        }

        $idempotencyKey = trim((string) ($validated['idempotency_key'] ?? ''));
        $idempotencyKey = $idempotencyKey === '' ? null : $idempotencyKey;
        unset($validated['idempotency_key']);

        $buyerNote = $validated['buyer_note'] ?? null;
        $canonicalItems = collect($validated['items'])
            ->map(fn (array $line): array => [
                'product_id' => (int) $line['product_id'],
                'variant_id' => isset($line['variant_id']) ? (int) $line['variant_id'] : null,
                'quantity' => (int) $line['quantity'],
            ])
            ->sortBy(fn (array $line): string => sprintf('%010d:%010d', $line['product_id'], $line['variant_id'] ?? 0))
            ->values()
            ->all();
        $requestHash = hash('sha256', json_encode([
            'items' => $canonicalItems,
            'payment_method_id' => (int) $validated['payment_method_id'],
            'pickup_location_id' => (int) $validated['pickup_location_id'],
            'buyer_note' => $buyerNote,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $buyerId = (int) $request->user()->id;

        $result = DB::transaction(function () use (
            $buyerId,
            $validated,
            $buyerNote,
            $idempotencyKey,
            $requestHash
        ): array {
            // Serialize checkout submissions from one buyer so concurrent retries
            // cannot both miss the same idempotency record.
            $buyer = User::query()
                ->whereKey($buyerId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($idempotencyKey !== null) {
                $existingRequest = OrderIdempotencyKey::query()
                    ->where('buyer_id', $buyer->id)
                    ->where('idempotency_key', $idempotencyKey)
                    ->lockForUpdate()
                    ->first();

                if ($existingRequest) {
                    if (! hash_equals($existingRequest->request_hash, $requestHash)) {
                        abort(409, 'This idempotency key was already used for different order details.');
                    }

                    $orderIds = array_map('intval', $existingRequest->order_ids ?? []);
                    $ordersById = Order::query()
                        ->where('buyer_id', $buyer->id)
                        ->whereIn('id', $orderIds)
                        ->with([
                            'buyer:id,name,student_id',
                            'seller:id,name,student_id',
                            'items.product.images',
                        ])
                        ->get()
                        ->keyBy(fn (Order $order): int => (int) $order->id);

                    $replayedOrders = collect($orderIds)
                        ->map(fn (int $orderId): ?Order => $ordersById->get($orderId))
                        ->filter()
                        ->values();

                    return [
                        'orders' => $replayedOrders,
                        'replayed' => true,
                    ];
                }
            }

            $paymentMethod = OrderPaymentMethod::query()
                ->whereKey((int) $validated['payment_method_id'])
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();
            if (! $paymentMethod) {
                throw ValidationException::withMessages([
                    'payment_method_id' => ['This payment method is no longer available. Refresh checkout and choose another method.'],
                ]);
            }

            $pickupLocation = PickupLocation::query()
                ->whereKey((int) $validated['pickup_location_id'])
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();
            if (! $pickupLocation) {
                throw ValidationException::withMessages([
                    'pickup_location_id' => ['This pickup location is no longer available. Refresh checkout and choose another location.'],
                ]);
            }

            $lines = $validated['items'];
            $productIds = array_values(array_unique(array_map(
                fn (array $line): int => (int) $line['product_id'],
                $lines
            )));
            sort($productIds);

            $products = Product::query()
                ->whereIn('id', $productIds)
                ->with(['user:id,name,student_id,role,status', 'categoryRecord:id,status'])
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($products->count() !== count($productIds)) {
                throw ValidationException::withMessages([
                    'items' => ['One or more products are no longer available. Refresh your cart and try again.'],
                ]);
            }

            $variantsByProduct = ProductVariant::query()
                ->whereIn('product_id', $productIds)
                ->where('is_active', true)
                ->orderBy('product_id')
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->groupBy('product_id');
            $variantProductIds = ProductVariant::query()
                ->whereIn('product_id', $productIds)
                ->distinct()
                ->pluck('product_id')
                ->map(fn ($id): int => (int) $id)
                ->all();

            $linesBySeller = [];
            foreach ($lines as $index => $line) {
                $product = $products->get((int) $line['product_id']);
                $seller = $product?->user;

                if (! $product || strtolower((string) $product->status) !== 'active') {
                    throw ValidationException::withMessages([
                        'items.'.$index.'.product_id' => ['This product is no longer available for ordering.'],
                    ]);
                }

                if (
                    $product->category_id !== null
                    && $product->categoryRecord !== null
                    && strtolower((string) $product->categoryRecord->status) !== 'active'
                ) {
                    throw ValidationException::withMessages([
                        'items.'.$index.'.product_id' => ['This product is currently unavailable.'],
                    ]);
                }

                $quantity = (int) $line['quantity'];
                $variant = null;
                if (in_array((int) $product->id, $variantProductIds, true)) {
                    if (! isset($line['variant_id'])) {
                        throw ValidationException::withMessages([
                            'items.'.$index.'.variant_id' => ['Choose an available variant for this product.'],
                        ]);
                    }
                    $variant = $variantsByProduct->get($product->id, collect())
                        ->firstWhere('id', (int) $line['variant_id']);
                    if (! $variant) {
                        throw ValidationException::withMessages([
                            'items.'.$index.'.variant_id' => ['This variant is no longer available for this product.'],
                        ]);
                    }
                    if ((int) $variant->stock_quantity < $quantity) {
                        throw ValidationException::withMessages([
                            'items.'.$index.'.quantity' => ['Only '.(int) $variant->stock_quantity.' unit(s) remain for this variant.'],
                        ]);
                    }
                } else {
                    if (isset($line['variant_id'])) {
                        throw ValidationException::withMessages([
                            'items.'.$index.'.variant_id' => ['This product does not have variants. Refresh your cart and try again.'],
                        ]);
                    }
                    if ((int) $product->stock_quantity < $quantity) {
                        throw ValidationException::withMessages([
                            'items.'.$index.'.quantity' => ['Only '.(int) $product->stock_quantity.' unit(s) remain for this product.'],
                        ]);
                    }
                }

                if ((int) $product->user_id === (int) $buyer->id) {
                    throw ValidationException::withMessages([
                        'items.'.$index.'.product_id' => ['You cannot purchase your own product.'],
                    ]);
                }

                if (! $seller || strtolower((string) $seller->role) !== 'student'
                    || strtolower((string) $seller->status) !== 'active') {
                    throw ValidationException::withMessages([
                        'items.'.$index.'.product_id' => ['This seller is not currently able to receive orders.'],
                    ]);
                }

                $linesBySeller[$seller->id][] = [
                    'product' => $product,
                    'variant' => $variant,
                    'quantity' => (int) $line['quantity'],
                ];
            }

            $createdOrders = collect();
            foreach ($linesBySeller as $sellerId => $sellerLines) {
                $seller = $products->first(
                    fn (Product $product): bool => (int) $product->user_id === (int) $sellerId
                )?->user;

                if (! $seller) {
                    throw ValidationException::withMessages([
                        'items' => ['A seller account is no longer available. Refresh your cart and try again.'],
                    ]);
                }

                $totalCents = 0;
                foreach ($sellerLines as $line) {
                    $unitCents = (int) round(((float) $line['product']->price) * 100);
                    $totalCents += $unitCents * $line['quantity'];
                }

                $order = Order::create([
                    'order_number' => $this->newOrderNumber(),
                    'buyer_id' => $buyer->id,
                    'seller_id' => $seller->id,
                    'buyer_name_snapshot' => (string) $buyer->name,
                    'seller_name_snapshot' => (string) $seller->name,
                    'status' => 'pending',
                    'seller_response_deadline_at' => now()->addHours(48),
                    'total_amount' => number_format($totalCents / 100, 2, '.', ''),
                    'payment_method_id' => $paymentMethod->id,
                    'payment_method_name_snapshot' => $paymentMethod->name,
                    'payment_method_instructions_snapshot' => $paymentMethod->instructions,
                    'payment_status' => 'unpaid',
                    'pickup_location_id' => $pickupLocation->id,
                    'pickup_location_name_snapshot' => $pickupLocation->name,
                    'pickup_location_area_snapshot' => $pickupLocation->campus_area,
                    'pickup_location_details_snapshot' => $pickupLocation->building_room,
                    'pickup_location_instructions_snapshot' => $pickupLocation->instructions,
                    'pickup_location_hours_snapshot' => $pickupLocation->operating_hours,
                    'buyer_note' => $buyerNote,
                ]);

                foreach ($sellerLines as $line) {
                    $product = $line['product'];
                    $quantity = $line['quantity'];
                    $unitCents = (int) round(((float) $product->price) * 100);

                    $order->items()->create([
                        'product_id' => $product->id,
                        'product_variant_id' => $line['variant']?->id,
                        'variant_label_snapshot' => $line['variant']?->label,
                        'variant_attributes_snapshot' => $line['variant']?->attributes,
                        'product_name' => $product->name,
                        'unit_price' => number_format($unitCents / 100, 2, '.', ''),
                        'quantity' => $quantity,
                        'line_total' => number_format(($unitCents * $quantity) / 100, 2, '.', ''),
                    ]);

                    $productStockBefore = (int) $product->stock_quantity;
                    if ($line['variant']) {
                        $variant = $line['variant'];
                        $variantStockBefore = (int) $variant->stock_quantity;
                        $variantStockAfter = $variantStockBefore - $quantity;
                        $variant->stock_quantity = $variantStockAfter;
                        $variant->save();
                        $productStockAfter = (int) $product->variants()
                            ->where('is_active', true)
                            ->sum('stock_quantity');
                        $product->stock_quantity = $productStockAfter;
                        if ($productStockAfter === 0) {
                            $product->status = 'sold_out';
                            $product->sold_out_at = now();
                        }
                        $product->save();
                        $product->historyEvents()->create([
                            'actor_id' => $buyer->id,
                            'order_id' => $order->id,
                            'product_variant_id' => $variant->id,
                            'variant_label_snapshot' => $variant->label,
                            'variant_attributes_snapshot' => $variant->attributes,
                            'event' => 'variant_stock_reserved',
                            'stock_before' => $variantStockBefore,
                            'stock_after' => $variantStockAfter,
                            'note' => 'Stock reserved for variant '.$variant->label.' in '.$order->order_number.'.',
                        ]);
                    } else {
                        $productStockAfter = $productStockBefore - $quantity;
                        $product->stock_quantity = $productStockAfter;
                        if ($productStockAfter === 0) {
                            $product->status = 'sold_out';
                            $product->sold_out_at = now();
                        }
                        $product->save();
                        $product->historyEvents()->create([
                            'actor_id' => $buyer->id,
                            'order_id' => $order->id,
                            'event' => 'stock_reserved',
                            'stock_before' => $productStockBefore,
                            'stock_after' => $productStockAfter,
                            'note' => 'Stock reserved for '.$order->order_number.'.',
                        ]);
                    }
                    if ($productStockAfter === 0 && $productStockBefore > 0) {
                        $product->historyEvents()->create([
                            'actor_id' => $buyer->id,
                            'order_id' => $order->id,
                            'event' => 'sold_out',
                            'stock_before' => $productStockBefore,
                            'stock_after' => 0,
                            'note' => 'All available stock was reserved.',
                        ]);
                    }
                }

                $createdOrders->push($order);
            }

            if ($idempotencyKey !== null) {
                OrderIdempotencyKey::create([
                    'buyer_id' => $buyer->id,
                    'idempotency_key' => $idempotencyKey,
                    'request_hash' => $requestHash,
                    'order_ids' => $createdOrders->pluck('id')->values()->all(),
                ]);
            }

            return [
                'orders' => $createdOrders,
                'replayed' => false,
            ];
        });

        $orders = $result['orders'];
        $orders->each(fn (Order $order) => $order->load([
            'buyer:id,name,student_id',
            'seller:id,name,student_id',
            'items.product.images',
        ]));

        $replayed = $result['replayed'];

        if (! $replayed) {
            foreach ($orders as $order) {
                $order->seller?->notify(new OrderEventNotification($order, 'order_placed'));
            }
        }

        return response()->json([
            'success' => true,
            'message' => $replayed
                ? 'This order request was already processed.'
                : 'Order request placed. No payment was collected.',
            'orders' => $orders->map(fn (Order $order): array => $this->orderData($order))->values(),
        ], $replayed ? 200 : 201);
    }

    public function buyerIndex(Request $request): JsonResponse
    {
        $orders = Order::query()
            ->where('buyer_id', $request->user()->id)
            ->with(['buyer:id,name,student_id', 'seller:id,name,student_id', 'items.product.images'])
            ->latest()
            ->limit(100)
            ->get();

        return response()->json([
            'success' => true,
            'orders' => $orders->map(fn (Order $order): array => $this->orderData($order))->values(),
            'total' => $orders->count(),
        ]);
    }

    public function sellerIndex(Request $request): JsonResponse
    {
        $query = Order::query()
            ->where('seller_id', $request->user()->id)
            ->with(['buyer:id,name,student_id', 'seller:id,name,student_id', 'items.product.images'])
            ->latest();

        if ($request->filled('status') && in_array($request->query('status'), self::ORDER_STATUSES, true)) {
            $query->where('status', $request->query('status'));
        }

        $orders = $query->limit(100)->get();

        return response()->json([
            'success' => true,
            'orders' => $orders->map(fn (Order $order): array => $this->orderData($order))->values(),
            'total' => $orders->count(),
        ]);
    }

    public function updateBySeller(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:confirmed,declined,ready_for_pickup,completed'],
            'seller_note' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($validated['status'] === 'declined' && trim((string) ($validated['seller_note'] ?? '')) === '') {
            throw ValidationException::withMessages([
                'seller_note' => ['Add a short reason before declining this order.'],
            ]);
        }

        $order = DB::transaction(function () use ($request, $order, $validated): Order {
            $lockedOrder = Order::query()
                ->whereKey($order->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ((int) $lockedOrder->seller_id !== (int) $request->user()->id) {
                abort(403, 'You are not allowed to manage this order.');
            }

            $allowedTransitions = [
                'pending' => ['confirmed', 'declined'],
                'confirmed' => ['ready_for_pickup'],
                'ready_for_pickup' => ['completed'],
            ];

            if (! in_array($validated['status'], $allowedTransitions[$lockedOrder->status] ?? [], true)) {
                throw ValidationException::withMessages([
                    'status' => ['This order cannot be moved from '.$lockedOrder->status.' to '.$validated['status'].'.'],
                ]);
            }

            $lockedOrder->status = $validated['status'];
            if ($validated['status'] === 'completed') {
                $lockedOrder->completed_at = now();
            }
            if (array_key_exists('seller_note', $validated)) {
                $lockedOrder->seller_note = $validated['seller_note'];
            }
            $lockedOrder->save();

            if ($validated['status'] === 'completed') {
                app(CommissionRecordingService::class)->recordCompletedOrder(
                    $lockedOrder,
                    $lockedOrder->completed_at,
                );
            }

            if ($validated['status'] === 'declined') {
                $this->restoreReservedStock(
                    $lockedOrder,
                    (int) $request->user()->id,
                    'Stock restored after the seller declined the order.'
                );
            }

            return $lockedOrder;
        });

        $order->load(['buyer:id,name,student_id', 'seller:id,name,student_id', 'items.product.images']);

        $event = match ($order->status) {
            'confirmed' => 'order_accepted',
            'declined' => 'order_declined',
            'ready_for_pickup' => 'order_ready_for_pickup',
            'completed' => 'order_completed',
            default => null,
        };
        if ($event !== null) {
            $order->buyer?->notify(new OrderEventNotification($order, $event));
        }

        return response()->json([
            'success' => true,
            'message' => 'Order status updated.',
            'order' => $this->orderData($order),
        ]);
    }

    public function cancelByBuyer(Request $request, Order $order): JsonResponse
    {
        $order = DB::transaction(function () use ($request, $order): Order {
            $lockedOrder = Order::query()
                ->whereKey($order->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ((int) $lockedOrder->buyer_id !== (int) $request->user()->id) {
                abort(403, 'You are not allowed to cancel this order.');
            }

            if ($lockedOrder->status !== 'pending') {
                throw ValidationException::withMessages([
                    'status' => ['Only pending order requests can be cancelled.'],
                ]);
            }

            $lockedOrder->status = 'cancelled';
            $lockedOrder->save();
            $this->restoreReservedStock(
                $lockedOrder,
                (int) $request->user()->id,
                'Stock restored after the buyer cancelled the order.'
            );

            return $lockedOrder;
        });

        $order->load(['buyer:id,name,student_id', 'seller:id,name,student_id', 'items.product.images']);

        $order->seller?->notify(new OrderEventNotification($order, 'order_cancelled'));

        return response()->json([
            'success' => true,
            'message' => 'Order request cancelled.',
            'order' => $this->orderData($order),
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', 'in:pending,confirmed,ready_for_pickup,declined,completed,cancelled'],
            'search' => ['nullable', 'string', 'max:100'],
            'from_date' => ['nullable', 'date_format:Y-m-d'],
            'to_date' => ['nullable', 'date_format:Y-m-d'],
            'pickup_location_id' => ['nullable', 'integer', 'exists:pickup_locations,id'],
        ]);

        if (! empty($validated['from_date']) && ! empty($validated['to_date'])
            && $validated['to_date'] < $validated['from_date']) {
            throw ValidationException::withMessages([
                'to_date' => ['The end date must be on or after the start date.'],
            ]);
        }

        $query = Order::query()
            ->with(['buyer:id,name,student_id', 'seller:id,name,student_id', 'items.product.images'])
            ->latest();

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['search'])) {
            $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($validated['search'])).'%';
            $query->where(function ($orders) use ($term): void {
                $orders->where('order_number', 'like', $term)
                    ->orWhere('buyer_name_snapshot', 'like', $term)
                    ->orWhere('seller_name_snapshot', 'like', $term)
                    ->orWhereHas('buyer', function ($buyer) use ($term): void {
                        $buyer->where('name', 'like', $term)
                            ->orWhere('student_id', 'like', $term);
                    })
                    ->orWhereHas('seller', function ($seller) use ($term): void {
                        $seller->where('name', 'like', $term)
                            ->orWhere('student_id', 'like', $term);
                    })
                    ->orWhereHas('items', function ($items) use ($term): void {
                        $items->where('product_name', 'like', $term);
                    });
            });
        }

        if (! empty($validated['from_date'])) {
            $query->whereDate('created_at', '>=', $validated['from_date']);
        }

        if (! empty($validated['to_date'])) {
            $query->whereDate('created_at', '<=', $validated['to_date']);
        }

        if (! empty($validated['pickup_location_id'])) {
            $query->where('pickup_location_id', (int) $validated['pickup_location_id']);
        }

        $matchingTotal = (clone $query)->count();
        $orders = $query->limit(200)->get();
        $summary = Order::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            'success' => true,
            'summary' => [
                'total_orders' => (int) $summary->sum(),
                'pending' => (int) ($summary['pending'] ?? 0),
                'confirmed' => (int) ($summary['confirmed'] ?? 0),
                'ready_for_pickup' => (int) ($summary['ready_for_pickup'] ?? 0),
                'declined' => (int) ($summary['declined'] ?? 0),
                'completed' => (int) ($summary['completed'] ?? 0),
                'cancelled' => (int) ($summary['cancelled'] ?? 0),
            ],
            'orders' => $orders->map(fn (Order $order): array => $this->orderData($order))->values(),
            'total' => $matchingTotal,
        ]);
    }
    private function orderItemImage($item): ?string
    {
        $product = $item->product;
        if (! $product) {
            return null;
        }

        return $product->images->firstWhere('is_primary', true)?->path
            ?? $product->images->first()?->path
            ?? $product->image;
    }
    private function newOrderNumber(): string
    {
        return 'TMC-'.now()->format('ymd').'-'.Str::upper(Str::random(8));
    }

    private function restoreReservedStock(Order $order, int $actorId, string $reason): void
    {
        $items = $order->items()
            ->whereNotNull('product_id')
            ->get()
            ->groupBy('product_id');

        foreach ($items as $productId => $productItems) {
            $product = Product::query()
                ->whereKey((int) $productId)
                ->lockForUpdate()
                ->first();
            if (! $product) {
                continue;
            }

            $variantItems = $productItems
                ->filter(fn (OrderItem $item): bool => $item->product_variant_id !== null)
                ->groupBy('product_variant_id');

            foreach ($variantItems as $variantId => $lines) {
                $variant = ProductVariant::query()
                    ->whereKey((int) $variantId)
                    ->where('product_id', $product->id)
                    ->lockForUpdate()
                    ->first();
                if (! $variant) {
                    continue;
                }

                $quantity = (int) $lines->sum('quantity');
                if ($quantity <= 0) {
                    continue;
                }
                $before = (int) $variant->stock_quantity;
                $after = $before + $quantity;
                $variant->stock_quantity = $after;
                $variant->save();
                $aggregate = (int) $product->variants()->where('is_active', true)->sum('stock_quantity');
                if ($aggregate > self::MAX_STOCK) {
                    throw ValidationException::withMessages([
                        'stock_quantity' => ['The restored order stock would exceed the supported product stock limit. Reduce available stock and retry the order update.'],
                    ]);
                }
                $previousStatus = $product->status;
                $product->stock_quantity = $aggregate;
                if ($aggregate > 0 && $previousStatus === 'sold_out' && $product->archived_at === null) {
                    $product->status = 'active';
                    $product->sold_out_at = null;
                }
                $product->save();
                $snapshot = $lines->first();
                $product->historyEvents()->create([
                    'actor_id' => $actorId,
                    'order_id' => $order->id,
                    'product_variant_id' => $variant->id,
                    'variant_label_snapshot' => $snapshot->variant_label_snapshot ?? $variant->label,
                    'variant_attributes_snapshot' => $snapshot->variant_attributes_snapshot ?? $variant->attributes,
                    'event' => 'variant_stock_restored',
                    'stock_before' => $before,
                    'stock_after' => $after,
                    'note' => $reason.' Variant: '.($snapshot->variant_label_snapshot ?? $variant->label).'.',
                ]);
            }

            $legacyItems = $productItems->filter(fn (OrderItem $item): bool =>
                $item->product_variant_id === null && $item->variant_label_snapshot === null
            );
            $quantity = (int) $legacyItems->sum('quantity');
            if ($quantity > 0) {
                $before = (int) $product->stock_quantity;
                $after = $before + $quantity;
                if ($after > self::MAX_STOCK) {
                    throw ValidationException::withMessages([
                        'stock_quantity' => ['The restored order stock would exceed the supported product stock limit. Reduce available stock and retry the order update.'],
                    ]);
                }
                $product->stock_quantity = $after;
                if ($product->status === 'sold_out' && $product->archived_at === null) {
                    $product->status = 'active';
                    $product->sold_out_at = null;
                }
                $product->save();
                $product->historyEvents()->create([
                    'actor_id' => $actorId,
                    'order_id' => $order->id,
                    'event' => 'stock_restored',
                    'stock_before' => $before,
                    'stock_after' => $after,
                    'note' => $reason,
                ]);
            }
        }
    }

    public function markPaid(Request $request, Order $order): JsonResponse
    {
        $order = DB::transaction(function () use ($order): Order {
            $locked = Order::query()
                ->whereKey($order->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($locked->payment_status !== 'paid') {
                $locked->payment_status = 'paid';
                $locked->save();
            }

            return $locked;
        });

        $order->load(['buyer:id,name,student_id', 'seller:id,name,student_id', 'items.product.images']);

        return response()->json([
            'success' => true,
            'message' => 'Payment status updated.',
            'order' => $this->orderData($order),
        ]);
    }

    private function orderData(Order $order): array
    {
        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'status' => $order->status,
            'needs_attention' => (bool) $order->needs_attention,
            'seller_response_deadline_at' => $order->seller_response_deadline_at,
            'total_amount' => $order->total_amount,
            'buyer_note' => $order->buyer_note,
            'seller_note' => $order->seller_note,
            'payment_method' => [
                'id' => $order->payment_method_id,
                'name' => $order->payment_method_name_snapshot,
                'instructions' => $order->payment_method_instructions_snapshot,
            ],
            'payment_status' => $order->payment_status,
            'pickup_location' => [
                'id' => $order->pickup_location_id,
                'name' => $order->pickup_location_name_snapshot,
                'area' => $order->pickup_location_area_snapshot,
                'details' => $order->pickup_location_details_snapshot,
                'instructions' => $order->pickup_location_instructions_snapshot,
                'operating_hours' => $order->pickup_location_hours_snapshot,
            ],
            'buyer' => [
                'id' => $order->buyer?->id,
                'name' => $order->buyer?->name ?? $order->buyer_name_snapshot,
                'student_id' => $order->buyer?->student_id,
            ],
            'seller' => [
                'id' => $order->seller?->id,
                'name' => $order->seller?->name ?? $order->seller_name_snapshot,
                'student_id' => $order->seller?->student_id,
            ],
            'items' => $order->items->map(fn ($item): array => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product_name,
                'variant_label' => $item->variant_label_snapshot,
                'variant_attributes' => $item->variant_attributes_snapshot ?? [],
                'unit_price' => $item->unit_price,
                'quantity' => $item->quantity,
                'line_total' => $item->line_total,
                'product_image' => $this->orderItemImage($item),
            ])->values(),
            'created_at' => $order->created_at,
            'updated_at' => $order->updated_at,
        ];
    }
}
