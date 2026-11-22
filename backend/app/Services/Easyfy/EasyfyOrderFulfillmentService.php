<?php

namespace App\Services\Easyfy;

use App\Enums\AdminAuditAction;
use App\Enums\Easyfy\EasyfyOrderStatus;
use App\Enums\Easyfy\EasyfyPaymentStatus;
use App\Enums\Easyfy\EasyfyStockMode;
use App\Enums\Easyfy\EasyfyStockMovementType;
use App\Exceptions\PosDomainException;
use App\Models\Easyfy\EasyfyCoupon;
use App\Models\Easyfy\EasyfyOrder;
use App\Models\Easyfy\EasyfyOrderItem;
use App\Models\Easyfy\EasyfyOrderStatusHistory;
use App\Models\Easyfy\EasyfyProductVariant;
use App\Models\Easyfy\EasyfyStockMovement;
use App\Models\User;
use App\Services\AdminAuditService;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class EasyfyOrderFulfillmentService
{
    public function __construct(private readonly AdminAuditService $auditService) {}

    public function verifyPayment(User $admin, int $orderId, ?string $note = null): EasyfyOrder
    {
        return DB::transaction(function () use ($admin, $orderId, $note) {
            $order = EasyfyOrder::lockForUpdate()->findOrFail($orderId);
            if (!$order->payment_method->requiresTransferProof()) {
                throw new PosDomainException('هذا الطلب دفع عند الاستلام ولا يحتاج مراجعة تحويل.', 'PROOF_NOT_APPLICABLE', 422);
            }
            $order->update([
                'payment_verification_status' => EasyfyPaymentStatus::VERIFIED,
                'verified_by' => $admin->id, 'verified_at' => now(), 'payment_rejection_reason' => null,
            ]);
            if ($order->status === EasyfyOrderStatus::PENDING) {
                $this->applyStatusUpdate($admin, $order, EasyfyOrderStatus::CONFIRMED, $note ?: 'تم تأكيد التحويل البنكي/الإلكتروني');
            }
            $this->auditService->record(AdminAuditAction::EASYFY_PAYMENT_VERIFIED, "تأكيد الدفع للطلب ({$order->order_number})", $order->account, null, EasyfyOrder::class, $order->id, $admin);

            return $order->fresh(['items', 'statusHistories', 'verifier:id,name']);
        });
    }

    public function rejectPayment(User $admin, int $orderId, string $reason): EasyfyOrder
    {
        return DB::transaction(function () use ($admin, $orderId, $reason) {
            $order = EasyfyOrder::lockForUpdate()->findOrFail($orderId);
            if (!$order->payment_method->requiresTransferProof()) {
                throw new PosDomainException('هذا الطلب لا يتطلب إثبات تحويل.', 'PROOF_NOT_APPLICABLE', 422);
            }
            $order->update([
                'payment_verification_status' => EasyfyPaymentStatus::REJECTED,
                'verified_by' => $admin->id, 'verified_at' => now(), 'payment_rejection_reason' => trim($reason),
            ]);
            $this->auditService->record(AdminAuditAction::EASYFY_PAYMENT_REJECTED, "رفض إثبات الدفع للطلب ({$order->order_number})", $order->account, ['reason' => $reason], EasyfyOrder::class, $order->id, $admin);

            return $order->fresh(['items', 'statusHistories', 'verifier:id,name']);
        });
    }

    public function transitionStatus(User $admin, int $orderId, EasyfyOrderStatus $target, array $meta = []): EasyfyOrder
    {
        return DB::transaction(function () use ($admin, $orderId, $target, $meta) {
            $order = EasyfyOrder::with('items')->lockForUpdate()->findOrFail($orderId);
            if (!$order->status->canTransitionTo($target)) {
                throw new PosDomainException("لا يمكن تغيير حالة الطلب من {$order->status->label()} إلى {$target->label()}.", 'INVALID_ORDER_TRANSITION', 422);
            }
            $order->update(array_filter([
                'courier_name' => $meta['courier_name'] ?? null,
                'tracking_number' => $meta['tracking_number'] ?? null,
                'admin_notes' => $meta['admin_notes'] ?? null,
            ], fn ($v) => $v !== null));
            $this->applyStatusUpdate($admin, $order, $target, $meta['note'] ?? null);
            if ($target === EasyfyOrderStatus::CANCELLED) {
                $this->restoreTrackedStockAndCoupon($admin, $order);
            }
            $this->auditService->record(AdminAuditAction::EASYFY_ORDER_STATUS_UPDATED, "تحديث حالة طلب ({$order->order_number})", $order->account, ['to' => $target->value], EasyfyOrder::class, $order->id, $admin);

            return $order->fresh(['items', 'statusHistories', 'shippingZone']);
        });
    }

    public function updateItemCosts(User $admin, int $orderId, array $itemCosts): EasyfyOrder
    {
        return DB::transaction(function () use ($orderId, $itemCosts) {
            $order = EasyfyOrder::with('items')->lockForUpdate()->findOrFail($orderId);
            $costMap = collect($itemCosts)->keyBy('order_item_id');
            $totalCost = Money::zero();
            foreach ($order->items as $item) {
                $totalCost = $totalCost->add($this->recomputeSingleOrderItemCost($item, $costMap->get($item->id)));
            }
            $netMerchandise = Money::of($order->subtotal)->subtract(Money::of($order->discount_amount));
            $order->update([
                'total_cost' => $totalCost->getAmount(),
                'gross_profit' => $netMerchandise->subtract($totalCost)->getAmount(),
            ]);

            return $order->fresh(['items', 'statusHistories']);
        });
    }

    private function recomputeSingleOrderItemCost(EasyfyOrderItem $item, ?array $override): Money
    {
        if ($override !== null && isset($override['unit_cost'])) {
            $unitCost = Money::of($override['unit_cost']);
            $lineCost = $unitCost->multiply($item->quantity);
            $lineProfit = Money::of($item->line_total)->subtract($lineCost);
            $item->update(['unit_cost' => $unitCost->getAmount(), 'line_cost' => $lineCost->getAmount(), 'line_profit' => $lineProfit->getAmount()]);

            return $lineCost;
        }

        return Money::of($item->line_cost);
    }

    private function applyStatusUpdate(User $admin, EasyfyOrder $order, EasyfyOrderStatus $target, ?string $note): void
    {
        $from = $order->status;
        $timestamps = match ($target) {
            EasyfyOrderStatus::CONFIRMED => ['confirmed_at' => now()],
            EasyfyOrderStatus::SHIPPED => ['shipped_at' => now()],
            EasyfyOrderStatus::DELIVERED => ['delivered_at' => now()],
            EasyfyOrderStatus::CANCELLED => ['cancelled_at' => now()],
            default => [],
        };
        $order->update(array_merge(['status' => $target], $timestamps));
        EasyfyOrderStatusHistory::create([
            'order_id' => $order->id, 'from_status' => $from, 'to_status' => $target,
            'actor_user_id' => $admin->id, 'actor_name' => $admin->name,
            'note' => $note ?: "تحديث الحالة إلى {$target->label()}", 'created_at' => now(),
        ]);
    }

    private function restoreTrackedStockAndCoupon(User $admin, EasyfyOrder $order): void
    {
        foreach ($order->items as $item) {
            if ($item->stock_mode === EasyfyStockMode::TRACKED && $item->variant_id) {
                $variant = EasyfyProductVariant::lockForUpdate()->find($item->variant_id);
                if ($variant) {
                    $newBal = $variant->stock_quantity + $item->quantity;
                    $variant->update(['stock_quantity' => $newBal]);
                    EasyfyStockMovement::create([
                        'variant_id' => $variant->id, 'type' => EasyfyStockMovementType::ORDER_CANCEL_RESTORE,
                        'quantity_delta' => $item->quantity, 'balance_after' => $newBal, 'reference_order_id' => $order->id,
                        'created_by' => $admin->id, 'notes' => "إرجاع لإلغاء {$order->order_number}", 'created_at' => now(),
                    ]);
                }
            }
        }
        if ($order->coupon_id) {
            EasyfyCoupon::whereKey($order->coupon_id)->where('used_count', '>', 0)->decrement('used_count');
        }
    }
}
