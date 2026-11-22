<?php

namespace App\Models\Easyfy;

use App\Enums\Easyfy\EasyfyOrderStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EasyfyOrderStatusHistory extends Model
{
    public $timestamps = false;

    protected $table = 'easyfy_order_status_histories';

    protected $fillable = [
        'order_id', 'from_status', 'to_status', 'actor_user_id', 'actor_name', 'note', 'created_at',
    ];

    protected $casts = [
        'from_status' => EasyfyOrderStatus::class,
        'to_status' => EasyfyOrderStatus::class,
        'created_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(EasyfyOrder::class, 'order_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
