<?php

namespace App\Models\Easyfy;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EasyfyCart extends Model
{
    protected $table = 'easyfy_carts';

    protected $fillable = [
        'account_id', 'user_id', 'coupon_code',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(User::class, 'account_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(EasyfyCartItem::class, 'cart_id')->orderBy('id');
    }
}
