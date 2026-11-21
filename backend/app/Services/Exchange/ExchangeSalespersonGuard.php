<?php

namespace App\Services\Exchange;

use App\Exceptions\PosDomainException;
use App\Models\Invoice;
use App\Models\User;
use App\Services\SettingService;

class ExchangeSalespersonGuard
{
    public function __construct(
        private readonly SettingService $settingService
    ) {}

    /**
     * Resolve and strictly lock salesperson attribution for return & replacement invoices.
     *
     * @return array{return_salesperson_id: ?int, replacement_salesperson_id: ?int}
     */
    public function resolveForPosExchange(
        User $actor,
        ?Invoice $originalInvoice,
        ?int $requestedReplacementSalespersonId
    ): array {
        $canOverride = $actor->isOwnerOrAdmin() || $actor->isManager();

        if (!$originalInvoice) {
            return $this->resolveUnlinkedExchangeSalespersons($actor, $canOverride, $requestedReplacementSalespersonId);
        }

        $lockedOriginalId = $this->resolveOriginalSalespersonId($originalInvoice);
        if ($requestedReplacementSalespersonId !== null && $requestedReplacementSalespersonId !== $lockedOriginalId && !$canOverride) {
            throw new PosDomainException(
                'عذراً، لا يُسمح للكاشير بتغيير البائع المسجل على الفاتورة الأصلية أثناء الاستبدال.',
                'UNAUTHORIZED_SALESPERSON_OVERRIDE',
                403
            );
        }

        return [
            'return_salesperson_id' => $lockedOriginalId,
            'replacement_salesperson_id' => $canOverride && $requestedReplacementSalespersonId !== null
                ? $requestedReplacementSalespersonId
                : $lockedOriginalId,
        ];
    }

    private function resolveUnlinkedExchangeSalespersons(
        User $actor,
        bool $canOverride,
        ?int $requestedReplacementSalespersonId
    ): array {
        if (!$this->settingService->allowsCashierUnlinkedExchange($actor)) {
            throw new PosDomainException(
                'عذراً، الاستبدال بدون ربط بفاتورة أصلية متاح للمالك والمدير فقط.',
                'UNLINKED_EXCHANGE_FORBIDDEN',
                403
            );
        }

        if ($requestedReplacementSalespersonId !== null && !$canOverride) {
            throw new PosDomainException(
                'عذراً، لا يُسمح للكاشير بتعيين بائع أو نسبة عمولة على استبدال بدون فاتورة أصلية.',
                'UNAUTHORIZED_SALESPERSON_OVERRIDE',
                403
            );
        }

        return [
            'return_salesperson_id' => null,
            'replacement_salesperson_id' => $canOverride ? $requestedReplacementSalespersonId : null,
        ];
    }

    private function resolveOriginalSalespersonId(Invoice $originalInvoice): ?int
    {
        if ($originalInvoice->salesperson_id !== null) {
            return (int) $originalInvoice->salesperson_id;
        }
        if ($originalInvoice->isEcommerceOrder()) {
            return null;
        }

        return $originalInvoice->created_by ? (int) $originalInvoice->created_by : null;
    }
}
