<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Models\User;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class PullWooCommerceOrdersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 300;

    public function __construct(
        public int $accountId,
        public int $actingUserId
    ) {
        $this->onQueue(QueueName::WOO_BULK->value);
    }

    /**
     * @return array{imported: int, updated: int, failed: int, errors: list<string>}
     */
    public function handle(WooCommerceOrderSyncService $orderSyncService): array
    {
        $user = User::withoutGlobalScopes()->find($this->actingUserId)
            ?? User::withoutGlobalScopes()->findOrFail($this->accountId);

        Auth::setUser($user);

        try {
            return $orderSyncService->pullRecentOrders($user);
        } catch (\Throwable $e) {
            Log::error('PullWooCommerceOrdersJob failed', [
                'account_id' => $this->accountId,
                'acting_user_id' => $this->actingUserId,
                'exception' => $e,
            ]);
            throw $e;
        }
    }
}
