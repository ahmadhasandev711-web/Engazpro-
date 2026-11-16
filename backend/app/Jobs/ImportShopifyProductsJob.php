<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Services\Shopify\ShopifyProductImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ImportShopifyProductsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 900;

    public function __construct(
        public int $accountId,
        public int $actingUserId,
        public bool $importStock = false
    ) {
        $this->onQueue(QueueName::SHOPIFY_BULK->value);
    }

    public function handle(ShopifyProductImportService $importService): array
    {
        $user = User::withoutGlobalScopes()->findOrFail($this->actingUserId);
        $integration = ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $this->accountId)
            ->where('is_active', true)
            ->firstOrFail();

        try {
            return $importService->importProducts($user, $integration, $this->importStock);
        } catch (\Throwable $e) {
            Log::error('ImportShopifyProductsJob failed', ['account_id' => $this->accountId, 'exception' => $e]);
            throw $e;
        }
    }
}
