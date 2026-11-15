<?php

namespace App\Http\Requests;

use Illuminate\Support\Facades\Gate;

class UpdateEmployeeRequest extends EmployeeFormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('employee'));
    }

    public function rules(): array
    {
        $employee = $this->route('employee');

        return array_merge($this->sharedRules($this->user(), $employee?->id), [
            'password' => ['nullable', 'string', 'min:6'],
        ]);
    }
}
