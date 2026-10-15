<?php

namespace App\Http\Controllers;

use App\Models\OrderPaymentMethod;
use App\Models\PickupLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderOptionsController extends Controller
{
    public function available(): JsonResponse
    {
        return response()->json([
            'payment_methods' => OrderPaymentMethod::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'instructions']),
            'pickup_locations' => PickupLocation::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'building_room', 'campus_area', 'instructions', 'operating_hours']),
        ]);
    }

    public function adminIndex(): JsonResponse
    {
        return response()->json([
            'payment_methods' => OrderPaymentMethod::query()
                ->withCount('orders')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'pickup_locations' => PickupLocation::query()
                ->withCount('orders')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function storePaymentMethod(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:order_payment_methods,name'],
            'instructions' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
        ], [
            'sort_order.integer' => 'Display order must be a whole number.',
            'sort_order.min' => 'Display order must be at least 0.',
            'sort_order.max' => 'Display order must be 65535 or less.',
        ]);

        $method = OrderPaymentMethod::query()->create($validated + [
            'is_active' => true,
            'sort_order' => 0,
        ]);

        return response()->json(['message' => 'Payment method added.', 'payment_method' => $method], 201);
    }

    public function updatePaymentMethod(Request $request, OrderPaymentMethod $paymentMethod): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('order_payment_methods', 'name')->ignore($paymentMethod->id)],
            'instructions' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:65535'],
        ], [
            'sort_order.integer' => 'Display order must be a whole number.',
            'sort_order.min' => 'Display order must be at least 0.',
            'sort_order.max' => 'Display order must be 65535 or less.',
        ]);

        $paymentMethod->update($validated);

        return response()->json(['message' => 'Payment method updated.', 'payment_method' => $paymentMethod->fresh()]);
    }

    public function storePickupLocation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('pickup_locations', 'name')],
            'building_room' => ['nullable', 'string', 'max:120'],
            'campus_area' => ['nullable', 'string', 'max:120'],
            'instructions' => ['nullable', 'string', 'max:2000'],
            'operating_hours' => ['nullable', 'string', 'max:120'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
        ], [
            'sort_order.integer' => 'Display order must be a whole number.',
            'sort_order.min' => 'Display order must be at least 0.',
            'sort_order.max' => 'Display order must be 65535 or less.',
        ]);

        $location = PickupLocation::query()->create($validated + [
            'is_active' => true,
            'sort_order' => 0,
        ]);

        return response()->json(['message' => 'Pickup location added.', 'pickup_location' => $location], 201);
    }

    public function updatePickupLocation(Request $request, PickupLocation $pickupLocation): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('pickup_locations', 'name')->ignore($pickupLocation->id)],
            'building_room' => ['nullable', 'string', 'max:120'],
            'campus_area' => ['nullable', 'string', 'max:120'],
            'instructions' => ['nullable', 'string', 'max:2000'],
            'operating_hours' => ['nullable', 'string', 'max:120'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:65535'],
        ], [
            'sort_order.integer' => 'Display order must be a whole number.',
            'sort_order.min' => 'Display order must be at least 0.',
            'sort_order.max' => 'Display order must be 65535 or less.',
        ]);

        $pickupLocation->update($validated);

        return response()->json(['message' => 'Pickup location updated.', 'pickup_location' => $pickupLocation->fresh()]);
    }

    public function destroyPaymentMethod(OrderPaymentMethod $paymentMethod): JsonResponse
    {
        $result = DB::transaction(function () use ($paymentMethod): JsonResponse {
            $lockedMethod = OrderPaymentMethod::query()
                ->whereKey($paymentMethod->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $orderCount = $lockedMethod->orders()->count();
            if ($orderCount > 0) {
                throw ValidationException::withMessages([
                    'payment_method' => [
                        'This payment method cannot be deleted because '.$orderCount.' saved order(s) reference it. Deactivate it instead.',
                    ],
                ]);
            }

            $lockedMethod->delete();

            return response()->json(['message' => 'Payment method deleted.']);
        });

        return $result;
    }

    public function destroyPickupLocation(PickupLocation $pickupLocation): JsonResponse
    {
        $result = DB::transaction(function () use ($pickupLocation): JsonResponse {
            $lockedLocation = PickupLocation::query()
                ->whereKey($pickupLocation->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $orderCount = $lockedLocation->orders()->count();
            if ($orderCount > 0) {
                throw ValidationException::withMessages([
                    'pickup_location' => [
                        'This pickup location cannot be deleted because '.$orderCount.' saved order(s) reference it. Deactivate it instead.',
                    ],
                ]);
            }

            $lockedLocation->delete();

            return response()->json(['message' => 'Pickup location deleted.']);
        });

        return $result;
    }
}
