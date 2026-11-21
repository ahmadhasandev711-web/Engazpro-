<?php

namespace App\Models;

use App\Enums\ExchangeSettlementType;
use App\Enums\ExchangeSource;
use App\Enums\ExchangeStatus;
use App\Enums\PaymentMethod;
use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exchange extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'user_id',
        'branch_id',
        'created_by',
        'salesperson_id',
        'exchange_number',
        'idempotency_key',
        'source',
        'status',
        'party_id',
        'original_invoice_id',
        'original_online_order_id',
        'return_invoice_id',
        'replacement_invoice_id',
        'replacement_online_order_id',
        'return_total',
        'replacement_total',
        'exchange_shipping_fee',
        'store_credit_used',
        'net_amount',
        'settlement_type',
        'payment_method',
        'treasury_id',
        'shift_id',
        'completed_at',
        'notes',
    ];

    protected $casts = [
        'source' => ExchangeSource::class,
        'status' => ExchangeStatus::class,
        'settlement_type' => ExchangeSettlementType::class,
        'payment_method' => PaymentMethod::class,
        'return_total' => 'decimal:2',
        'replacement_total' => 'decimal:2',
        'exchange_shipping_fee' => 'decimal:2',
        'store_credit_used' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'completed_at' => 'datetime',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function salesperson(): BelongsTo
    {
        return $this->belongsTo(User::class, 'salesperson_id');
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    public function originalInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'original_invoice_id');
    }

    public function originalOnlineOrder(): BelongsTo
    {
        return $this->belongsTo(OnlineOrder::class, 'original_online_order_id');
    }

    public function returnInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'return_invoice_id');
    }

    public function replacementInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'replacement_invoice_id');
    }

    public function replacementOnlineOrder(): BelongsTo
    {
        return $this->belongsTo(OnlineOrder::class, 'replacement_online_order_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ExchangeItem::class);
    }
}
