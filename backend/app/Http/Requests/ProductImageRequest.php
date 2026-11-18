<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProductImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'image' => ['required', 'file', 'image', 'mimes:jpeg,jpg,png,webp', 'max:1024'],
        ];
    }

    public function messages(): array
    {
        return [
            'image.required' => 'يرجى اختيار صورة الصنف أولاً',
            'image.file' => 'الملف المرفوع غير صالح',
            'image.image' => 'الملف المرفوع يجب أن يكون صورة صالحة',
            'image.mimes' => 'صيغة الصورة المدعومة هي WebP أو PNG أو JPG فقط',
            'image.max' => 'حجم الصورة يجب ألا يتجاوز 1 ميجابايت بعد الضغط',
        ];
    }
}
