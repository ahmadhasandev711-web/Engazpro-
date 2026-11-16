<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CashFlowTransactionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'channel' => ['required', 'string'],
            'from_date' => ['nullable', 'date'],
            'to_date' => ['nullable', 'date'],
            'flow_type' => ['nullable', 'string', 'in:ALL,INFLOW,OUTFLOW,all,inflow,outflow'],
            'movement_category' => ['nullable', 'string'],
            'search' => ['nullable', 'string', 'max:100'],
            'cashier_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
