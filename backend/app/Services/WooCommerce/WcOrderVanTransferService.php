<?php

namespace App\Services\WooCommerce;

use App\Enums\BranchType;
use App\Enums\StockTransferStatus;
use App\Models\Branch;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\User;
use App\Models\WcOrder;
use App\Services\StockTransferService;

class WcOrderVanTransferService
{
    public function __construct(
        private readonly StockTransferService $stockTransferService
    ) {}

    /**
     * Build standard transfer note for mandob dispatch
     */
    public static function buildTransferNote(int $wcOrderId, string $mandobName): string
    {
        return "شحن طلب ووكومرس #{$wcOrderId} مع المندوب {$mandobName}";
    }

    /**
     * Build exact prefix to search for mandob transfer without ambiguous ID collisions
     */
    public static function buildTransferNotePrefix(int $wcOrderId): string
    {
        return "شحن طلب ووكومرس #{$wcOrderId} ";
    }

    /**
     * Resolve mandob's VAN branch or fallback to any active VAN branch
     */
    public function resolveVanBranch(int $accountId, User $mandob): ?Branch
    {
        $vanBranchId = $mandob->branch_id;
        $vanBranch = $vanBranchId
            ? Branch::where('user_id', $accountId)->where('type', BranchType::VAN)->find($vanBranchId)
            : null;

        if (!$vanBranch) {
            $vanBranch = Branch::where('user_id', $accountId)
                ->where('type', BranchType::VAN)
                ->where('is_active', true)
                ->first();
        }

        return $vanBranch;
    }

    /**
     * Create stock transfer for mandob dispatch to VAN branch
     */
    public function createForDispatch(User $user, WcOrder $order, User $mandob, Branch $van): ?StockTransfer
    {
        $accountId = $user->getAccountId();
        if ($van->id === $order->branch_id) {
            return null;
        }

        $transferItems = [];
        foreach ($order->items_snapshot ?? [] as $item) {
            $wcProductId = (int) ($item['product_id'] ?? 0);
            $wcVarId = !empty($item['variation_id']) ? (int) $item['variation_id'] : null;

            $product = Product::where('user_id', $accountId)->where('wc_product_id', $wcProductId)->first();
            $variant = $product && $wcVarId ? $product->variants()->where('wc_variation_id', $wcVarId)->first() : null;

            if ($product) {
                $transferItems[] = [
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                    'quantity_sent' => (float) ($item['quantity'] ?? 1),
                    'unit_name' => $product->unit,
                ];
            }
        }

        if (empty($transferItems)) {
            return null;
        }

        return $this->stockTransferService->createTransfer($user, [
            'from_branch_id' => $order->branch_id,
            'to_branch_id' => $van->id,
            'items' => $transferItems,
            'notes' => self::buildTransferNote($order->wc_order_id, $mandob->name),
        ]);
    }

    /**
     * Find active or associated stock transfer for order with lock
     */
    public function findForOrder(int $accountId, WcOrder $order): ?StockTransfer
    {
        $notePrefix = self::buildTransferNotePrefix($order->wc_order_id);

        return StockTransfer::where('user_id', $accountId)
            ->where('notes', 'like', $notePrefix . '%')
            ->lockForUpdate()
            ->latest()
            ->first();
    }

    /**
     * Reverse VAN stock transfer for returned order
     */
    public function reverseForReturn(User $user, WcOrder $order): ?string
    {
        $accountId = $user->getAccountId();
        $transfer = $this->findForOrder($accountId, $order);

        if (!$transfer) {
            return null;
        }

        if ($transfer->status === StockTransferStatus::IN_TRANSIT) {
            $this->stockTransferService->cancelTransfer($user, $transfer, "مرتجع أوردر ووكومرس #{$order->wc_order_id}");
            return null;
        }

        return "[تحذير: إذن تحويل سيارة المندوب رقم {$transfer->transfer_number} بحالة '{$transfer->status->value}' ولم يتم إلغاؤه تلقائياً]";
    }
}
