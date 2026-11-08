<?php

namespace App\Jobs\Middleware;

use App\Support\TenantContext;
use Closure;

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
        return TenantContext::runAs($this->userId, fn () => $next($job));
    }
}
