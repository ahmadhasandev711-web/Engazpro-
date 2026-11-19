<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Jobs\Middleware\WithTenantContext;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Services\Shopify\ShopifyProductImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ImportShopifyProductsPageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 120;

    public function __construct(
        public int $accountId,
        public int $actingUserId,
        public ?string $cursor = null,
        public bool $importStock = false
    ) {
        $this->onQueue(QueueName::SHOPIFY_BULK->value);
    }

    public function middleware(): array
    {
        return [new WithTenantContext($this->actingUserId)];
    }

    public function handle(ShopifyProductImportService $importService): array
    {
        $user = User::withoutGlobalScopes()->findOrFail($this->actingUserId);
        $integration = ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $this->accountId)
            ->where('is_active', true)
            ->firstOrFail();

        try {
            $result = $importService->importPage($user, $integration, $this->cursor, 50, $this->importStock);
            if ($result['has_more'] && !empty($result['end_cursor'])) {
                self::dispatch($this->accountId, $this->actingUserId, $result['end_cursor'], $this->importStock);
            }

            return $result;
        } catch (\Throwable $e) {
            Log::error('ImportShopifyProductsPageJob failed', ['account_id' => $this->accountId, 'exception' => $e]);
            throw $e;
        }
    }
}
