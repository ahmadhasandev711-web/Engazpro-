<?php

namespace App\Http\Requests;

use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateInvoiceSalespersonRequest extends FormRequest
{
    public function authorize(): bool
    {
        $invoice = Invoice::findOrFail((int) $this->route('id'));

        return Gate::allows('updateSalesperson', $invoice);
    }

    public function rules(): array
    {
        $accountId = $this->user()->getAccountId();

        return [
            'salesperson_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(
                    fn ($q) => $q->where('owner_id', $accountId)->orWhere('id', $accountId)
                ),
            ],
        ];
    }
}
