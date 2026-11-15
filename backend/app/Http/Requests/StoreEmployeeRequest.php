<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Support\Facades\Gate;

class StoreEmployeeRequest extends EmployeeFormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', User::class);
    }

    public function rules(): array
    {
        return array_merge($this->sharedRules($this->user()), [
            'password' => ['required', 'string', 'min:6'],
        ]);
    }
}
