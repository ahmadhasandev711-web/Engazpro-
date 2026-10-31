<?php

namespace App\Jobs\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Support\Facades\Auth;

class WithTenantContext
{
    public function __construct(
        protected int $userId
    ) {}

    /**
     * Process the queued job with isolated tenant authentication context.
     */
    public function handle(object $job, Closure $next): mixed
    {
        $user = User::withoutGlobalScopes()->find($this->userId);
        if ($user) {
            Auth::setUser($user);
        }

        try {
            return $next($job);
        } finally {
            Auth::forgetGuards();
        }
    }
}
