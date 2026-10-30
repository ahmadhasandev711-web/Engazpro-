<?php

namespace App\Jobs;

use App\Enums\QueueName;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceProductImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ImportWooCommerceProductsPageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    /** Must stay below config('queue.connections.database.retry_after') */
    public int $timeout = 120;

    public function __construct(
        public int $accountId,
        public int $actingUserId,
        public int $page = 1,
        public bool $importStock = false
    ) {
        $this->onQueue(QueueName::WOO_BULK->value);
    }

    /**
     * @return array{imported: int, updated: int, errors: list<string>, count: int, has_more: bool}
     */
    public function handle(WooCommerceProductImportService $importService): array
    {
        $user = User::withoutGlobalScopes()->findOrFail($this->actingUserId);
        $integration = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $this->accountId)
            ->where('is_active', true)
            ->firstOrFail();

        try {
            $result = $importService->importPage($user, $integration, $this->page, 50, $this->importStock);

            if ($result['has_more']) {
                self::dispatch($this->accountId, $this->actingUserId, $this->page + 1, $this->importStock);
            }

            return $result;
        } catch (\Throwable $e) {
            Log::error('ImportWooCommerceProductsPageJob failed', [
                'account_id' => $this->accountId,
                'acting_user_id' => $this->actingUserId,
                'page' => $this->page,
                'exception' => $e,
            ]);
            throw $e;
        }
    }
}
