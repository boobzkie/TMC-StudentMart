<?php

namespace App\Http\Controllers;

use App\Models\OrderPaymentMethod;
use App\Models\PickupLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
        ]);

        $paymentMethod->update($validated);

        return response()->json(['message' => 'Payment method updated.', 'payment_method' => $paymentMethod->fresh()]);
    }

    public function storePickupLocation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'building_room' => ['nullable', 'string', 'max:120'],
            'campus_area' => ['nullable', 'string', 'max:120'],
            'instructions' => ['nullable', 'string', 'max:2000'],
            'operating_hours' => ['nullable', 'string', 'max:120'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
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
            'name' => ['required', 'string', 'max:120'],
            'building_room' => ['nullable', 'string', 'max:120'],
            'campus_area' => ['nullable', 'string', 'max:120'],
            'instructions' => ['nullable', 'string', 'max:2000'],
            'operating_hours' => ['nullable', 'string', 'max:120'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:65535'],
        ]);

        $pickupLocation->update($validated);

        return response()->json(['message' => 'Pickup location updated.', 'pickup_location' => $pickupLocation->fresh()]);
    }
}
