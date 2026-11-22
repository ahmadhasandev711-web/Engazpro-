<?php

namespace App\Http\Requests\Easyfy\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UploadEasyfyImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'variant_id' => ['nullable', 'integer', 'exists:easyfy_product_variants,id'],
            'is_primary' => ['nullable', 'boolean'],
        ];
    }
}
