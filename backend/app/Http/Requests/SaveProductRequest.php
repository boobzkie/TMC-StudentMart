<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveProductRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['attributes', 'variants'] as $field) {
            $value = $this->input($field);
            if (! is_string($value) || trim($value) === '') {
                continue;
            }

            $decoded = json_decode($value, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $this->merge([$field => $decoded]);
            }
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'stock_quantity' => ['sometimes', 'integer', 'min:0', 'max:4294967295'],
            'attributes' => ['sometimes', 'nullable', 'array', 'max:24'],
            'attributes.*' => ['nullable', 'string', 'max:255'],
            'attributes.condition' => ['nullable', 'string', Rule::in(['new', 'used'])],
            'variants' => ['sometimes', 'array', 'min:1', 'max:100'],
            'variants.*.id' => ['sometimes', 'nullable', 'integer', 'distinct:strict'],
            'variants.*.label' => ['required', 'string', 'max:120', 'distinct:ignore_case'],
            'variants.*.attributes' => ['sometimes', 'nullable', 'array', 'max:12'],
            'variants.*.attributes.*' => ['nullable', 'string', 'max:120'],
            'variants.*.stock_quantity' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'category_id' => [
                'required_without:category',
                'nullable',
                'integer',
                Rule::exists('categories', 'id')
                    ->where(fn ($query) => $query->where('status', 'active')),
            ],
            'category' => [
                'required_without:category_id',
                'nullable',
                'string',
                'max:100',
                Rule::exists('categories', 'name')
                    ->where(fn ($query) => $query->where('status', 'active')),
            ],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'images' => ['sometimes', 'array', 'max:4'],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:1536'],
            'primary_image_index' => ['sometimes', 'integer', 'min:0', 'max:3'],
            'remove_image_ids' => ['sometimes', 'array', 'max:4'],
            'remove_image_ids.*' => ['integer', 'distinct'],
            'primary_image_id' => ['sometimes', 'integer'],
        ];
    }
}
