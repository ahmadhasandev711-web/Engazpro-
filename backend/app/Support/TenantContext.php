<?php

namespace App\Support;

use App\Models\User;
use Closure;
use Illuminate\Support\Facades\Auth;

final class TenantContext
{
    /**
     * Run a callback within an isolated tenant authentication context.
     */
    public static function runAs(int $accountId, Closure $callback): mixed
    {
        $previous = Auth::user();
        $user = User::withoutGlobalScopes()->find($accountId);

        if ($user) {
            Auth::setUser($user);
        }

        try {
            return $callback();
        } finally {
            if ($previous) {
                Auth::setUser($previous);
            } else {
                Auth::forgetGuards();
            }
        }
    }
}
