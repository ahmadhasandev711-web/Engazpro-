<?php

namespace App\Services\OnlineOrders;

use App\Enums\BranchType;
use App\Enums\StockTransferStatus;
use App\Exceptions\PosDomainException;
use App\Models\Branch;
use App\Models\OnlineOrder;
use App\Models\StockTransfer;
use App\Models\User;
use App\Services\StockTransferService;
use App\Support\Quantity;

class OnlineOrderVanTransferService
{
    public function __construct(
        private readonly StockTransferService $stockTransferService,
        private readonly StoreOrderAdapterRegistry $adapters,
    ) {}

    public static function buildTransferNote(OnlineOrder $order, string $mandobName): string
    {
        return self::buildTransferNotePrefix($order) . "مع المندوب {$mandobName}";
    }

    public static function buildTransferNotePrefix(OnlineOrder $order): string
    {
        return "شحن طلب #{$order->id} ({$order->displayReference()}) ";
    }

    public function resolveVanBranch(int $accountId, User $mandob): ?Branch
    {
        $van = $mandob->branch_id
            ? Branch::where('user_id', $accountId)->where('type', BranchType::VAN)->find($mandob->branch_id)
            : null;

        return $van ?? Branch::where('user_id', $accountId)
            ->where('type', BranchType::VAN)
            ->where('is_active', true)
            ->first();
    }

    public function createForDispatch(User $user, OnlineOrder $order, User $mandob, Branch $van): ?StockTransfer
    {
        if ($van->id === $order->branch_id) {
            return null;
        }

        $transferItems = $this->buildTransferItems($user->getAccountId(), $order);
        if (empty($transferItems)) {
            return null;
        }

        return $this->stockTransferService->createTransfer($user, [
            'from_branch_id' => $order->branch_id,
            'to_branch_id' => $van->id,
            'items' => $transferItems,
            'notes' => self::buildTransferNote($order, $mandob->name),
        ]);
    }

    public function settleForDelivery(User $user, OnlineOrder $order): ?StockTransfer
    {
        $transfer = $this->findLatestDispatchTransfer($user->getAccountId(), $order);
        if (!$transfer || $transfer->status === StockTransferStatus::RECEIVED) {
            return $transfer;
        }
        if ($transfer->status !== StockTransferStatus::IN_TRANSIT) {
            throw new PosDomainException(
                "تحويل المخزون لسيارة المندوب ({$transfer->transfer_number}) لم يعد نشطاً.",
                'DISPATCH_TRANSFER_NOT_ACTIVE',
                422
            );
        }

        return $this->stockTransferService->receiveTransfer($user, $transfer);
    }

    public function reverseForReturn(User $user, OnlineOrder $order): ?string
    {
        $transfer = $this->findLatestDispatchTransfer($user->getAccountId(), $order);
        if (!$transfer) {
            return null;
        }
        if ($transfer->status === StockTransferStatus::IN_TRANSIT) {
            $this->stockTransferService->cancelTransfer($user, $transfer, "مرتجع طلب {$order->displayReference()}");

            return null;
        }

        return $transfer->status === StockTransferStatus::RECEIVED
            ? "تحذير: البضاعة مستلمة فعلياً في مخزن سيارة المندوب ({$transfer->transfer_number})؛ يرجى عمل تحويل إرجاع يدوي للمخزن الرئيسي."
            : null;
    }

    public function findForOrder(int $accountId, OnlineOrder $order): ?StockTransfer
    {
        return $this->findLatestDispatchTransfer($accountId, $order);
    }

    private function findLatestDispatchTransfer(int $accountId, OnlineOrder $order): ?StockTransfer
    {
        return StockTransfer::where('user_id', $accountId)
            ->where('notes', 'like', self::buildTransferNotePrefix($order) . '%')
            ->latest('id')
            ->first();
    }

    private function buildTransferItems(int $accountId, OnlineOrder $order): array
    {
        $adapter = $this->adapters->forPlatform($order->platform);
        $items = [];
        foreach ($order->items_snapshot ?? [] as $row) {
            $resolved = $adapter->resolveItemProduct($accountId, $row);
            $product = $resolved['product'];
            if ($product) {
                $items[] = [
                    'product_id' => $product->id,
                    'product_variant_id' => $resolved['variant']?->id,
                    'quantity_sent' => Quantity::of($row['quantity'] ?? 1)->toFloat(),
                    'unit_name' => $product->unit,
                ];
            }
        }

        return $items;
    }
}
