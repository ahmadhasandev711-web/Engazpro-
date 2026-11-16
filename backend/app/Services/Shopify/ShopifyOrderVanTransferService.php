<?php

namespace App\Services\Shopify;

use App\Enums\BranchType;
use App\Enums\StockTransferStatus;
use App\Exceptions\PosDomainException;
use App\Models\Branch;
use App\Models\ShopifyOrder;
use App\Models\StockTransfer;
use App\Models\User;
use App\Services\StockTransferService;
use App\Support\Quantity;

class ShopifyOrderVanTransferService
{
    public function __construct(
        private readonly StockTransferService $stockTransferService
    ) {}

    public static function buildTransferNote(int $shopifyOrderId, string $mandobName): string
    {
        return "شحن طلب شوبيفاي #{$shopifyOrderId} مع المندوب {$mandobName}";
    }

    public static function buildTransferNotePrefix(int $shopifyOrderId): string
    {
        return "شحن طلب شوبيفاي #{$shopifyOrderId} ";
    }

    public function resolveVanBranch(int $accountId, User $mandob): ?Branch
    {
        $van = $mandob->branch_id
            ? Branch::where('user_id', $accountId)->where('type', BranchType::VAN)->find($mandob->branch_id)
            : null;

        return $van ?? Branch::where('user_id', $accountId)->where('type', BranchType::VAN)->where('is_active', true)->first();
    }

    public function createForDispatch(User $user, ShopifyOrder $order, User $mandob, Branch $van): ?StockTransfer
    {
        if ($van->id === $order->branch_id) {
            return null;
        }
        $items = $this->buildTransferItems($order->items_snapshot ?? []);
        if (empty($items)) {
            return null;
        }

        return $this->stockTransferService->createTransfer($user, [
            'from_branch_id' => $order->branch_id,
            'to_branch_id' => $van->id,
            'items' => $items,
            'notes' => self::buildTransferNote($order->shopify_order_id, $mandob->name),
        ]);
    }

    public function settleForDelivery(User $user, ShopifyOrder $order): ?StockTransfer
    {
        $transfer = StockTransfer::where('user_id', $user->getAccountId())
            ->where('notes', 'like', self::buildTransferNotePrefix($order->shopify_order_id) . '%')
            ->latest('id')->first();

        if (!$transfer || $transfer->status === StockTransferStatus::RECEIVED) {
            return $transfer;
        }
        if ($transfer->status !== StockTransferStatus::IN_TRANSIT) {
            throw new PosDomainException("تحويل المخزون لسيارة المندوب ({$transfer->transfer_number}) لم يعد نشطاً.", 'DISPATCH_TRANSFER_NOT_ACTIVE', 422);
        }

        return $this->stockTransferService->receiveTransfer($user, $transfer);
    }

    public function reverseForReturn(User $user, ShopifyOrder $order): ?string
    {
        $transfer = StockTransfer::where('user_id', $user->getAccountId())
            ->where('notes', 'like', self::buildTransferNotePrefix($order->shopify_order_id) . '%')
            ->latest('id')->first();

        if (!$transfer) {
            return null;
        }
        if ($transfer->status === StockTransferStatus::IN_TRANSIT) {
            $this->stockTransferService->cancelTransfer($user, $transfer);

            return null;
        }

        return $transfer->status === StockTransferStatus::RECEIVED
            ? "تنبيه: البضاعة مستلمة فعلياً في مخزن سيارة المندوب ({$transfer->transfer_number})؛ يرجى عمل تحويل إرجاع يدوي للمخزن الرئيسي."
            : null;
    }

    private function buildTransferItems(array $snapshot): array
    {
        $items = [];
        foreach ($snapshot as $item) {
            if (!empty($item['product_id'])) {
                $items[] = [
                    'product_id' => (int) $item['product_id'],
                    'product_variant_id' => !empty($item['product_variant_id']) ? (int) $item['product_variant_id'] : null,
                    'quantity_sent' => Quantity::of($item['quantity'] ?? 1)->toFloat(),
                ];
            }
        }

        return $items;
    }
}
