<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use App\Http\Requests\Concerns\HasScopedValidation;
use App\Models\Invoice;
use App\Services\BranchScopeService;
use App\Support\Money;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class InvoiceRequest extends FormRequest
{
    use HasScopedValidation;

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
            'discount' => Money::of($this->discount ?? 0)->getAmount(),
            'tax' => Money::of($this->tax ?? 0)->getAmount(),
            'shipping_amount' => Money::of($this->shipping_amount ?? 0)->getAmount(),
            'paid_amount' => Money::of($this->paid_amount ?? 0)->getAmount(),
            'payment_method' => $this->payment_method ?: PaymentMethod::CASH->value,
        ]);
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'in:SALE,PURCHASE,SALE_RETURN,PURCHASE_RETURN'],
            'idempotency_key' => ['nullable', 'string', 'max:100'],
            'branch_id' => ['nullable', $this->scopedExists('branches')],
            'salesperson_id' => ['nullable', $this->scopedAccountUserExists()],
            'party_id' => ['nullable', $this->scopedExists('parties')],
            'courier_party_id' => ['nullable', $this->scopedExists('parties')],
            'parent_invoice_id' => ['nullable', $this->scopedExists('invoices')],
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
            ...$this->itemRules(),
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $user = $this->user();
            if (!$user || $user->hasGlobalBranchAccess() || !$this->filled('parent_invoice_id')) {
                return;
            }
            $parent = Invoice::find((int) $this->input('parent_invoice_id'));
            if ($parent && !app(BranchScopeService::class)->canAccessBranch($user, $parent->branch_id)) {
                $v->errors()->add('parent_invoice_id', 'عذراً، لا يمكنك عمل مرتجع على فاتورة تابعة لفرع آخر.');
            }
        });
    }

    private function itemRules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', $this->scopedExists('products')],
            'items.*.product_variant_id' => ['nullable', $this->scopedExists('product_variants')],
            'items.*.product_batch_id' => ['nullable', $this->scopedExists('product_batches')],
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
