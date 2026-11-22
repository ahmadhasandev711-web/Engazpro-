<?php

namespace App\Http\Requests\Easyfy\Storefront;

use Illuminate\Foundation\Http\FormRequest;

class UploadCartArtworkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'artwork' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ];
    }
}
