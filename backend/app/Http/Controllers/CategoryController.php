<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    /**
     * Return the active marketplace categories available to students.
     */
    public function index(): JsonResponse
    {
        $categories = Category::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'description']);

        return response()->json([
            'success' => true,
            'categories' => $categories,
            'total' => $categories->count(),
        ]);
    }
}
