<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'salesperson_id' => ($this->salesperson_id === '' || $this->salesperson_id === 0 || $this->salesperson_id === '0') ? null : $this->salesperson_id,
            'branch_id' => ($this->branch_id === '' || $this->branch_id === 0 || $this->branch_id === '0') ? null : $this->branch_id,
            'party_id' => ($this->party_id === '' || $this->party_id === 0 || $this->party_id === '0') ? null : $this->party_id,
            'courier_party_id' => ($this->courier_party_id === '' || $this->courier_party_id === 0 || $this->courier_party_id === '0') ? null : $this->courier_party_id,
            'parent_invoice_id' => ($this->parent_invoice_id === '' || $this->parent_invoice_id === 0 || $this->parent_invoice_id === '0') ? null : $this->parent_invoice_id,
            'discount' => (float) ($this->discount ?? 0),
            'tax' => (float) ($this->tax ?? 0),
            'shipping_amount' => (float) ($this->shipping_amount ?? 0),
            'paid_amount' => (float) ($this->paid_amount ?? 0),
            'payment_method' => $this->payment_method ?: 'CASH',
        ]);
    }

    public function rules(): array
    {
        $accountId = $this->user()?->getAccountId();

        return [
            'type' => ['required', 'in:SALE,PURCHASE,SALE_RETURN,PURCHASE_RETURN'],
            'idempotency_key' => ['nullable', 'string', 'max:100'],
            'branch_id' => [
                'nullable',
                $accountId ? Rule::exists('branches', 'id')->where('user_id', $accountId) : 'exists:branches,id',
            ],
            'salesperson_id' => ['nullable', 'exists:users,id'],
            'party_id' => [
                'nullable',
                $accountId ? Rule::exists('parties', 'id')->where('user_id', $accountId) : 'exists:parties,id',
            ],
            'courier_party_id' => [
                'nullable',
                $accountId ? Rule::exists('parties', 'id')->where('user_id', $accountId) : 'exists:parties,id',
            ],
            'parent_invoice_id' => [
                'nullable',
                $accountId ? Rule::exists('invoices', 'id')->where('user_id', $accountId) : 'exists:invoices,id',
            ],
            'date' => ['required', 'date'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'tax' => ['nullable', 'numeric', 'min:0'],
            'shipping_amount' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'in:CASH,CARD,INSTAPAY,VODAFONE_CASH,TRANSFER,CREDIT,SPLIT,COURIER_COD'],
            'split_payments' => ['nullable', 'array'],
            'split_payments.*.method' => ['required_with:split_payments', 'string', 'in:CASH,CARD,INSTAPAY,VODAFONE_CASH,TRANSFER'],
            'split_payments.*.amount' => ['required_with:split_payments', 'numeric', 'min:0.01'],
            'split_payments.*.notes' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => [
                'required',
                $accountId ? Rule::exists('products', 'id')->where('user_id', $accountId) : 'exists:products,id',
            ],
            'items.*.product_variant_id' => ['nullable', 'exists:product_variants,id'],
            'items.*.product_batch_id' => ['nullable', 'exists:product_batches,id'],
            'items.*.variant_name' => ['nullable', 'string', 'max:255'],
            'items.*.batch_number' => ['nullable', 'string', 'max:100'],
            'items.*.expiry_date' => ['nullable', 'date'],
            'items.*.unit_name' => ['nullable', 'string', 'max:50'],
            'items.*.is_sub_unit' => ['nullable', 'boolean'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.notes' => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'type.required' => 'نوع الفاتورة مطلوب',
            'items.required' => 'الفاتورة يجب أن تحتوي على صنف واحد على الأقل',
            'items.min' => 'الفاتورة يجب أن تحتوي على صنف واحد على الأقل',
            'items.*.quantity.min' => 'الكمية يجب أن تكون أكبر من الصفر',
            'party_id.exists' => 'العميل أو المورد المحدد غير مسجل في النظام',
            'parent_invoice_id.exists' => 'الفاتورة الأصلية غير موجودة',
        ];
    }
}
