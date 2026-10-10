<?php

namespace App\Models\Concerns;

use App\Models\Scopes\StoreScope;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

trait BelongsToStore
{
    protected static function bootBelongsToStore(): void
    {
        static::addGlobalScope(new StoreScope());

        static::creating(function ($model) {
            if (Auth::hasUser()) {
                $user = Auth::user();
                // مسؤولو المنصة فقط يمكنهم تعيين متجر آخر في مسارات لوحة الإدارة
                if (!empty($user->is_admin) && request()->is('api/admin/*') && !empty($model->user_id)) {
                    return;
                }
                $model->user_id = method_exists($user, 'getAccountId') 
                    ? $user->getAccountId() 
                    : ($user->owner_id ?? $user->id);
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
