<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminCategoryController extends Controller
{
    /**
     * Display all categories.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Category::query()
            ->orderBy('name');

        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere(
                        'description',
                        'like',
                        "%{$search}%"
                    );
            });
        }

        if ($request->filled('status')) {
            $allowedStatuses = [
                'active',
                'inactive',
            ];

            if (in_array(
                $request->status,
                $allowedStatuses,
                true
            )) {
                $query->where(
                    'status',
                    $request->status
                );
            }
        }

        $categories = $query->get();
        $this->attachProductCounts($categories);

        return response()->json([
            'success' => true,
            'categories' => $categories,
            'total' => $categories->count(),
        ]);
    }

    /**
     * Display one category.
     */
    public function show(Category $category): JsonResponse
    {
        $this->attachProductCounts(collect([$category]));

        return response()->json([
            'success' => true,
            'category' => $category,
        ]);
    }

    /**
     * Create a category.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                'unique:categories,name',
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'status' => [
                'nullable',
                Rule::in([
                    'active',
                    'inactive',
                ]),
            ],
        ]);

        $category = Category::create([
            'name' => trim($validated['name']),
            'description' => isset(
                $validated['description']
            )
                ? trim($validated['description'])
                : null,
            'status' => $validated['status']
                ?? 'active',
        ]);

        $this->attachProductCounts(collect([$category]));

        return response()->json([
            'success' => true,
            'message' =>
                'Category created successfully.',
            'category' => $category,
        ], 201);
    }

    /**
     * Update a category.
     */
    public function update(
        Request $request,
        Category $category
    ): JsonResponse {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique(
                    'categories',
                    'name'
                )->ignore($category->id),
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'status' => [
                'required',
                Rule::in([
                    'active',
                    'inactive',
                ]),
            ],
        ]);

        $oldName = $category->name;
        $newName = trim($validated['name']);

        /*
         * Keep the legacy category label synchronized while
         * the normalized category_id remains the relationship.
         */
        if ($oldName !== $newName) {
            Product::query()
                ->where(function ($query) use ($category, $oldName) {
                    $query->where('category_id', $category->id)
                        ->orWhere(function ($legacy) use ($oldName) {
                            $legacy->whereNull('category_id')
                                ->where('category', $oldName);
                        });
                })
                ->update(['category' => $newName]);
        }

        $category->update([
            'name' => $newName,
            'description' => isset(
                $validated['description']
            )
                ? trim($validated['description'])
                : null,
            'status' => $validated['status'],
        ]);

        $this->attachProductCounts(collect([$category]));

        return response()->json([
            'success' => true,
            'message' =>
                'Category updated successfully.',
            'category' => $category,
        ]);
    }

    /**
     * Toggle category status.
     */
    public function toggleStatus(
        Category $category
    ): JsonResponse {
        $category->status =
            $category->status === 'active'
                ? 'inactive'
                : 'active';

        $category->save();

        $this->attachProductCounts(collect([$category]));

        return response()->json([
            'success' => true,
            'message' =>
                $category->status === 'active'
                    ? 'Category activated successfully.'
                    : 'Category deactivated successfully.',
            'category' => $category,
        ]);
    }

    /**
     * Delete a category.
     */
    public function destroy(
        Category $category
    ): JsonResponse {
        $productCount = Product::query()
            ->where(function ($query) use ($category) {
                $query->where('category_id', $category->id)
                    ->orWhere(function ($legacy) use ($category) {
                        $legacy->whereNull('category_id')
                            ->where('category', $category->name);
                    });
            })
            ->count();

        if ($productCount > 0) {
            return response()->json([
                'success' => false,
                'message' =>
                    "This category cannot be deleted because {$productCount} product(s) are using it. Deactivate the category instead.",
                'product_count' => $productCount,
            ], 422);
        }

        $categoryId = $category->id;

        $category->delete();

        return response()->json([
            'success' => true,
            'message' =>
                'Category deleted successfully.',
            'deleted_category_id' => $categoryId,
        ]);
    }
    private function attachProductCounts($categories): void
    {
        $categoryIds = $categories->pluck('id')->all();
        $categoryNames = $categories->pluck('name')->all();

        if ($categoryIds === []) {
            return;
        }

        $linkedCounts = Product::query()
            ->selectRaw('category_id, COUNT(*) as aggregate')
            ->whereIn('category_id', $categoryIds)
            ->groupBy('category_id')
            ->pluck('aggregate', 'category_id');

        $legacyCounts = Product::query()
            ->selectRaw('category, COUNT(*) as aggregate')
            ->whereNull('category_id')
            ->whereIn('category', $categoryNames)
            ->groupBy('category')
            ->pluck('aggregate', 'category');

        foreach ($categories as $category) {
            $category->setAttribute(
                'products_count',
                (int) ($linkedCounts[$category->id] ?? 0)
                    + (int) ($legacyCounts[$category->name] ?? 0)
            );
        }
    }
}