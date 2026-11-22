<?php

namespace App\Services\Easyfy;

use App\Enums\Easyfy\EasyfyOrderStatus;
use App\Enums\Easyfy\EasyfyPaymentMethod;
use App\Enums\Easyfy\EasyfyPaymentStatus;
use App\Enums\Easyfy\EasyfyStockMode;
use App\Enums\Easyfy\EasyfyStockMovementType;
use App\Exceptions\PosDomainException;
use App\Models\Easyfy\EasyfyCart;
use App\Models\Easyfy\EasyfyCoupon;
use App\Models\Easyfy\EasyfyOrder;
use App\Models\Easyfy\EasyfyOrderItem;
use App\Models\Easyfy\EasyfyOrderStatusHistory;
use App\Models\Easyfy\EasyfyProductVariant;
use App\Models\Easyfy\EasyfyShippingZone;
use App\Models\Easyfy\EasyfyStockMovement;
use App\Models\User;
use App\Support\Money;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class EasyfyOrderCheckoutService
{
    public function __construct(
        private readonly EasyfySettingsService $settingsService,
        private readonly EasyfyCartService $cartService,
        private readonly EasyfyPricingService $pricingService,
        private readonly EasyfyMediaService $mediaService,
        private readonly EasyfyNotificationService $notificationService,
    ) {}

    public function checkout(User $user, array $data, ?UploadedFile $paymentProof = null): EasyfyOrder
    {
        $idempotencyKey = $data['idempotency_key'] ?? null;
        if (!empty($idempotencyKey)) {
            $existing = EasyfyOrder::where('account_id', $user->getAccountId())->where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing->load(['items', 'statusHistories']);
            }
        }
        $method = EasyfyPaymentMethod::from((string) $data['payment_method']);
        $this->assertPaymentReady($method, $data['transfer_reference'] ?? null, $paymentProof);
        $proofPath = $paymentProof ? $this->mediaService->storePrivateFile($paymentProof, 'proofs') : null;

        try {
            $order = DB::transaction(fn () => $this->executeCheckout($user, $data, $method, $proofPath, $idempotencyKey));
        } catch (\Throwable $e) {
            $this->mediaService->deletePrivateFile($proofPath);
            throw $e;
        }
        $this->notificationService->notifyAdminNewOrder($order, false);

        return $order;
    }

    public function reuploadPaymentProof(User $user, int $orderId, string $transferRef, UploadedFile $proof): EasyfyOrder
    {
        $order = EasyfyOrder::where('account_id', $user->getAccountId())->findOrFail($orderId);
        if (!$order->payment_method->requiresTransferProof() || $order->status->isTerminal()) {
            throw new PosDomainException('لا يمكن تحديث إثبات التحويل لهذا الطلب.', 'INVALID_PROOF_REUPLOAD', 422);
        }
        $newPath = $this->mediaService->storePrivateFile($proof, 'proofs');
        $oldPath = $order->payment_proof_path;
        $order->update([
            'transfer_reference' => trim($transferRef), 'payment_proof_path' => $newPath,
            'payment_verification_status' => EasyfyPaymentStatus::PENDING_REVIEW, 'payment_rejection_reason' => null,
        ]);
        $this->mediaService->deletePrivateFile($oldPath);
        $this->notificationService->notifyAdminNewOrder($order->fresh(), true);

        return $order->fresh(['items', 'statusHistories']);
    }

    private function executeCheckout(User $user, array $data, EasyfyPaymentMethod $method, ?string $proofPath, ?string $idempKey): EasyfyOrder
    {
        $cart = $this->cartService->getCartWithRelations($user);
        if ($cart->items->isEmpty()) {
            throw new PosDomainException('سلة التسوق فارغة، أضف منتجات أولاً.', 'EMPTY_EASYFY_CART', 422);
        }
        $preparedLines = $this->prepareLockedLines($cart);
        $zone = !empty($data['shipping_zone_id']) ? EasyfyShippingZone::find($data['shipping_zone_id']) : null;
        $totals = $this->computeOrderTotals($user, $preparedLines, $zone, $data['coupon_code'] ?? $cart->coupon_code);
        $order = $this->createOrderRecord($user, $data, $method, $proofPath, $idempKey, $zone, $totals);
        $this->persistOrderItemsAndStock($user, $order, $preparedLines);
        $this->finalizeCouponAndHistory($user, $order, $totals['coupon']);
        $this->cartService->clearCart($cart);

        return $order->fresh(['items', 'statusHistories', 'shippingZone']);
    }

    private function assertPaymentReady(EasyfyPaymentMethod $method, ?string $reference, ?UploadedFile $proof): void
    {
        $settings = $this->settingsService->all();
        if (empty($settings[EasyfySettingsService::KEY_STORE_ENABLED])) {
            throw new PosDomainException('متجر Easyfy مغلق مؤقتاً للصيانة.', 'EASYFY_STORE_DISABLED', 422);
        }
        $enabled = match ($method) {
            EasyfyPaymentMethod::CASH_ON_DELIVERY => !empty($settings[EasyfySettingsService::KEY_COD_ENABLED]),
            EasyfyPaymentMethod::INSTAPAY => !empty($settings[EasyfySettingsService::KEY_INSTAPAY_ENABLED]),
            EasyfyPaymentMethod::VODAFONE_CASH => !empty($settings[EasyfySettingsService::KEY_VODAFONE_CASH_ENABLED]),
        };
        if (!$enabled) {
            throw new PosDomainException('وسيلة الدفع المختارة غير متاحة حالياً.', 'EASYFY_PAYMENT_DISABLED', 422);
        }
        if ($method->requiresTransferProof() && (trim((string) $reference) === '' || !$proof)) {
            throw new PosDomainException('يرجى إدخال الرقم المرجعي وإرفاق صورة إثبات التحويل.', 'TRANSFER_PROOF_REQUIRED', 422);
        }
    }

    private function prepareLockedLines(EasyfyCart $cart): array
    {
        $variantIds = $cart->items->pluck('variant_id')->unique()->values()->all();
        $variants = EasyfyProductVariant::with(['product', 'priceTiers'])->whereIn('id', $variantIds)->lockForUpdate()->get()->keyBy('id');
        $lines = [];
        foreach ($cart->items as $item) {
            $variant = $variants->get($item->variant_id);
            $lines[] = $this->buildPreparedLine($variant, $item->quantity, $item->custom_note, $item->artwork_path);
        }

        return $lines;
    }

    private function buildPreparedLine(?EasyfyProductVariant $variant, int $qty, ?string $note, ?string $artworkPath): array
    {
        if (!$variant || !$variant->is_active || !$variant->product || !$variant->product->is_active) {
            throw new PosDomainException('أحد الأصناف في السلة لم يعد متاحاً.', 'EASYFY_ITEM_UNAVAILABLE', 422);
        }
        if ($variant->product->stock_mode === EasyfyStockMode::TRACKED && $qty > $variant->stock_quantity) {
            throw new PosDomainException("الرصيد المتاح من ({$variant->product->name} - {$variant->label}) هو {$variant->stock_quantity} فقط.", 'EASYFY_INSUFFICIENT_STOCK', 422);
        }
        $unitPrice = $this->pricingService->resolveVariantUnitPrice($variant, $qty);
        $unitCost = Money::of($variant->cost_price ?? 0);

        return compact('variant', 'qty', 'unitPrice', 'unitCost', 'note', 'artworkPath');
    }

    private function computeOrderTotals(User $user, array $lines, ?EasyfyShippingZone $zone, ?string $couponCode): array
    {
        $subtotal = Money::zero();
        $totalCost = Money::zero();
        foreach ($lines as $line) {
            $subtotal = $subtotal->add($line['unitPrice']->multiply($line['qty']));
            $totalCost = $totalCost->add($line['unitCost']->multiply($line['qty']));
        }
        $shippingFee = $this->pricingService->resolveShippingFee($zone, $subtotal);
        $coupon = $this->pricingService->validateCoupon($couponCode, $user->getAccountId(), $subtotal);
        $discount = $this->pricingService->computeDiscount($coupon, $subtotal, $shippingFee);
        $totalAmount = $subtotal->add($shippingFee)->subtract($discount);
        $grossProfit = $subtotal->subtract($discount)->subtract($totalCost);

        return compact('subtotal', 'totalCost', 'shippingFee', 'coupon', 'discount', 'totalAmount', 'grossProfit');
    }

    private function createOrderRecord(User $user, array $data, EasyfyPaymentMethod $method, ?string $proofPath, ?string $idempKey, ?EasyfyShippingZone $zone, array $totals): EasyfyOrder
    {
        $accountId = $user->getAccountId();
        $owner = User::findOrFail($accountId);
        $payStatus = $method->requiresTransferProof() ? EasyfyPaymentStatus::PENDING_REVIEW : EasyfyPaymentStatus::NOT_REQUIRED;

        return EasyfyOrder::create([
            'order_number' => $this->settingsService->nextOrderNumber(), 'idempotency_key' => $idempKey,
            'account_id' => $accountId, 'store_code' => $owner->store_code,
            'store_name' => $owner->business_name ?? $owner->name, 'owner_name' => $owner->name, 'owner_phone' => $owner->phone,
            'ordered_by_user_id' => $user->id, 'ordered_by_name' => $user->name, 'ordered_by_phone' => $user->phone,
            'ordered_by_role' => $user->role?->value, 'shipping_zone_id' => $zone?->id,
            'recipient_name' => $data['recipient_name'], 'recipient_phone' => $data['recipient_phone'],
            'governorate' => $zone?->governorate_name ?? $data['governorate'], 'shipping_address' => $data['shipping_address'],
            'customer_notes' => $data['customer_notes'] ?? null, 'subtotal' => $totals['subtotal']->getAmount(),
            'discount_amount' => $totals['discount']->getAmount(), 'coupon_id' => $totals['coupon']?->id,
            'coupon_code' => $totals['coupon']?->code, 'shipping_fee' => $totals['shippingFee']->getAmount(),
            'total_amount' => $totals['totalAmount']->getAmount(), 'total_cost' => $totals['totalCost']->getAmount(),
            'gross_profit' => $totals['grossProfit']->getAmount(), 'payment_method' => $method,
            'payment_verification_status' => $payStatus, 'transfer_reference' => $data['transfer_reference'] ?? null,
            'payment_proof_path' => $proofPath, 'status' => EasyfyOrderStatus::PENDING,
        ]);
    }

    private function persistOrderItemsAndStock(User $user, EasyfyOrder $order, array $lines): void
    {
        foreach ($lines as $line) {
            $variant = $line['variant'];
            $lineTotal = $line['unitPrice']->multiply($line['qty']);
            $lineCost = $line['unitCost']->multiply($line['qty']);
            EasyfyOrderItem::create([
                'order_id' => $order->id, 'product_id' => $variant->product_id, 'variant_id' => $variant->id,
                'product_name' => $variant->product->name, 'variant_label' => $variant->label, 'sku' => $variant->sku,
                'stock_mode' => $variant->product->stock_mode, 'unit_price' => $line['unitPrice']->getAmount(),
                'unit_cost' => $line['unitCost']->getAmount(), 'quantity' => $line['qty'],
                'line_total' => $lineTotal->getAmount(), 'line_cost' => $lineCost->getAmount(),
                'line_profit' => $lineTotal->subtract($lineCost)->getAmount(),
                'custom_note' => $line['note'], 'artwork_path' => $line['artworkPath'],
            ]);
            if ($variant->product->stock_mode === EasyfyStockMode::TRACKED) {
                $this->deductTrackedVariantStock($user, $order, $variant, $line['qty']);
            }
        }
    }

    private function deductTrackedVariantStock(User $user, EasyfyOrder $order, EasyfyProductVariant $variant, int $qty): void
    {
        $newBalance = $variant->stock_quantity - $qty;
        $variant->update(['stock_quantity' => $newBalance]);
        EasyfyStockMovement::create([
            'variant_id' => $variant->id, 'type' => EasyfyStockMovementType::ORDER_DEDUCTION,
            'quantity_delta' => -$qty, 'balance_after' => $newBalance, 'unit_cost' => $variant->cost_price,
            'reference_order_id' => $order->id, 'created_by' => $user->id,
            'notes' => "خصم طلب متجر Easyfy رقم {$order->order_number}", 'created_at' => now(),
        ]);
    }

    private function finalizeCouponAndHistory(User $user, EasyfyOrder $order, ?EasyfyCoupon $coupon): void
    {
        if ($coupon) {
            EasyfyCoupon::whereKey($coupon->id)->lockForUpdate()->increment('used_count');
        }
        EasyfyOrderStatusHistory::create([
            'order_id' => $order->id, 'from_status' => null, 'to_status' => EasyfyOrderStatus::PENDING,
            'actor_user_id' => $user->id, 'actor_name' => $user->name,
            'note' => 'تم استلام الطلب بنجاح', 'created_at' => now(),
        ]);
    }
}
