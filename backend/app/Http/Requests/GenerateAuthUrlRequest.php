<?php

namespace App\Http\Requests;

use App\Rules\PublicHttpsUrl;
use Illuminate\Foundation\Http\FormRequest;

class GenerateAuthUrlRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();
        return (bool) ($user && ($user->isOwnerOrAdmin() || $user->isManager()));
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'store_url' => ['required', 'url', new PublicHttpsUrl()],
            'return_url' => ['nullable', 'url'],
        ];
    }

    /**
     * Get custom error messages.
     */
    public function messages(): array
    {
        return [
            'store_url.required' => 'رابط متجر ووكومرس مطلوب.',
            'store_url.url' => 'صيغة رابط المتجر غير صحيحة.',
        ];
    }
}
