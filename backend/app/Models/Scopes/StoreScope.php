<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

class StoreScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        // Allow console commands/seeders to operate when no user is authenticated
        if (app()->runningInConsole() && !Auth::hasUser()) {
            return;
        }

        if (!Auth::hasUser()) {
            // Guard against unauthenticated HTTP requests leaking multi-tenant data
            $builder->where($model->qualifyColumn('user_id'), 0);
            return;
        }

        $user = Auth::user();

        // Platform Admins can see all records across stores only when accessing admin platform routes
        if (!empty($user->is_admin) && request()->is('api/admin/*')) {
            return;
        }

        $accountId = method_exists($user, 'getAccountId') 
            ? $user->getAccountId() 
            : ($user->owner_id ?? $user->id);

        if ($accountId) {
            $builder->where($model->qualifyColumn('user_id'), $accountId);
        } else {
            $builder->where($model->qualifyColumn('user_id'), 0);
        }
    }
}
