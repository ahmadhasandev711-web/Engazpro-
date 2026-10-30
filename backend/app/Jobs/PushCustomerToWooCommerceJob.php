<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Models\Party;
use App\Models\User;
use App\Services\WooCommerce\WooCommerceCustomerSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PushCustomerToWooCommerceJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $partyId
    ) {
        $this->onQueue(QueueName::WOO_REALTIME->value);
    }

    public function handle(WooCommerceCustomerSyncService $customerSyncService): void
    {
        $party = Party::find($this->partyId);
        if (!$party || $party->type !== 'CUSTOMER') {
            return;
        }

        $user = $party->user;
        if (!$user) {
            return;
        }

        $customerSyncService->pushCustomerToWooCommerce($user, $party);
    }
}
