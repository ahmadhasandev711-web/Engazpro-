<?php

namespace App\Services\WooCommerce;

use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Exceptions\PosDomainException;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WooCommerceIntegration;
use App\Services\CourierService;
use App\Services\InvoiceService;
use App\Services\StockTransferService;
use App\Support\Money;
use Exception;
use Illuminate\Support\Facades\DB;
use App\Contracts\WooCommerceApiClientInterface;
use Illuminate\Support\Facades\Log;

class WooCommerceOrderSyncService
{
    public function __construct(
        protected WooCommerceApiClientInterface $apiClient,
        protected WooCommerceCustomerSyncService $customerSyncService,
        protected InvoiceService $invoiceService,
        protected StockTransferService $stockTransferService,
        protected CourierService $courierService
    ) {}

    /**
     * Handle incoming order from webhook or manual pull
     */
    public function handleIncomingOrder(User $user, array $wcOrderData): WcOrder
    {
        $accountId = $user->getAccountId();
        $wcOrderId = (int) $wcOrderData['id'];

        // 1. Idempotency check: return existing if already imported
        $existing = WcOrder::where('user_id', $accountId)
            ->where('wc_order_id', $wcOrderId)
            ->first();

        // Helper closures for data extraction
        $billing = $wcOrderData['billing'] ?? [];
        $shipping = $wcOrderData['shipping'] ?? [];

        $rawDate = $wcOrderData['date_created'] ?? ($wcOrderData['date_created_gmt'] ?? null);
        $orderDate = null;
        if ($rawDate) {
            try {
                $orderDate = \Carbon\Carbon::parse($rawDate);
            } catch (\Throwable) {
                $orderDate = now();
            }
        } else {
            $orderDate = now();
        }

        // 1. Phone extraction
        $extractedPhone = !empty(trim((string)($billing['phone'] ?? ''))) ? trim((string)$billing['phone']) : null;
        if (empty($extractedPhone) && !empty(trim((string)($shipping['phone'] ?? '')))) {
            $extractedPhone = trim((string)$shipping['phone']);
        }
        if (empty($extractedPhone) && !empty($wcOrderData['meta_data']) && is_array($wcOrderData['meta_data'])) {
            foreach ($wcOrderData['meta_data'] as $meta) {
                $key = strtolower(trim((string)($meta['key'] ?? '')));
                if (in_array($key, [
                    '_billing_phone', 'billing_phone', 'phone', 'mobile', 
                    '_shipping_phone', 'shipping_phone', 'billing_mobile', 'whatsapp', 'customer_phone'
                ])) {
                    $val = trim((string)($meta['value'] ?? ''));
                    if (!empty($val)) {
                        $extractedPhone = $val;
                        break;
                    }
                }
            }
        }

        // 2. Address extraction (prioritize shipping, fallback to billing)
        $addr1 = !empty(trim((string)($shipping['address_1'] ?? ''))) ? trim((string)$shipping['address_1']) : trim((string)($billing['address_1'] ?? ''));
        $addr2 = !empty(trim((string)($shipping['address_2'] ?? ''))) ? trim((string)$shipping['address_2']) : trim((string)($billing['address_2'] ?? ''));
        $city = !empty(trim((string)($shipping['city'] ?? ''))) ? trim((string)$shipping['city']) : trim((string)($billing['city'] ?? ''));
        $state = !empty(trim((string)($shipping['state'] ?? ''))) ? trim((string)$shipping['state']) : trim((string)($billing['state'] ?? ''));
        $addressParts = array_filter([$addr1, $addr2, $city, $state]);
        $extractedAddress = !empty($addressParts) ? implode(', ', $addressParts) : null;

        // 1. Idempotency check: update missing fields if already imported
        if ($existing) {
            $updates = [];
            if ($orderDate) {
                $updates['order_date'] = $orderDate;
            }
            if (empty($existing->customer_phone) && $extractedPhone) {
                $updates['customer_phone'] = $extractedPhone;
            }
            if (empty($existing->customer_address) && $extractedAddress) {
                $updates['customer_address'] = $extractedAddress;
            }
            if (empty($existing->governorate) && !empty($state)) {
                $updates['governorate'] = $state;
            }
            if (empty($existing->city) && !empty($city)) {
                $updates['city'] = $city;
            }

            // Enrich items_snapshot if missing image_url or attributes
            $existingItems = $existing->items_snapshot ?? [];
            $needsItemEnrichment = empty($existingItems) || !isset($existingItems[0]['image_url']);
            if ($needsItemEnrichment && !empty($wcOrderData['line_items'])) {
                $updates['items_snapshot'] = $this->enrichLineItems($accountId, $wcOrderData['line_items']);
            }

            if (!empty($updates)) {
                $existing->update($updates);
            }

            return $existing;
        }

        return DB::transaction(function () use ($user, $accountId, $wcOrderId, $wcOrderData, $orderDate, $extractedPhone, $extractedAddress, $state, $city, $billing, $shipping) {
            $integration = WooCommerceIntegration::withoutGlobalScopes()->where('user_id', $accountId)->first();

            // 2. Customer synchronization
            $party = null;
            if (!empty($wcOrderData['billing'])) {
                $party = $this->customerSyncService->syncCustomerFromWooCommerce($user, [
                    'id' => $wcOrderData['customer_id'] ?? null,
                    'billing' => $wcOrderData['billing'],
                    'first_name' => $wcOrderData['billing']['first_name'] ?? '',
                    'last_name' => $wcOrderData['billing']['last_name'] ?? '',
                    'phone' => $extractedPhone ?: ($wcOrderData['billing']['phone'] ?? ''),
                    'email' => $wcOrderData['billing']['email'] ?? null,
                ]);
            }

            // Fallback phone and address from party
            $finalPhone = $extractedPhone ?: ($party?->phone ?? null);
            $finalAddress = $extractedAddress ?: ($party?->address ?? null);

            // 3. Fallback branch: online_branch_id or main branch
            $branchId = $integration?->online_branch_id;
            if (!$branchId) {
                $branchId = Branch::where('user_id', $accountId)->where('is_main', true)->value('id')
                    ?? Branch::where('user_id', $accountId)->value('id');
            }

            $shippingCostMoney = Money::of($wcOrderData['shipping_total'] ?? 0);
            $totalMoney = Money::of($wcOrderData['total'] ?? 0);
            $discountTotalMoney = Money::of($wcOrderData['discount_total'] ?? 0);
            $subtotalMoney = $totalMoney->subtract($shippingCostMoney)->add($discountTotalMoney);
            if ($subtotalMoney->isNegative()) {
                $subtotalMoney = Money::zero();
            }

            $shippingCost = $shippingCostMoney->getAmount();
            $subtotal = $subtotalMoney->getAmount();
            $discountTotal = $discountTotalMoney->getAmount();
            $total = $totalMoney->getAmount();

            $customerName = trim(($shipping['first_name'] ?? '') . ' ' . ($shipping['last_name'] ?? ''));
            if (empty($customerName)) {
                $customerName = trim(($billing['first_name'] ?? '') . ' ' . ($billing['last_name'] ?? ''));
            }
            if (empty($customerName)) {
                $customerName = $party?->name ?? 'عميل أونلاين';
            }

            $coupons = array_map(fn($c) => $c['code'] ?? '', $wcOrderData['coupon_lines'] ?? []);

            $paymentMethod = $wcOrderData['payment_method'] ?? 'cod';
            $isPaidOnline = !empty($wcOrderData['date_paid'])
                || (isset($wcOrderData['needs_payment']) && $wcOrderData['needs_payment'] === false && strtolower($paymentMethod) !== 'cod')
                || (strtolower($paymentMethod) !== 'cod' && in_array(strtolower($wcOrderData['status'] ?? ''), ['processing', 'completed']))
                || in_array(strtolower($paymentMethod), ['stripe', 'paymob', 'fawry', 'credit_card', 'visa', 'wallet', 'card', 'accept', 'kashier']);

            $sanitizedLineItems = $this->enrichLineItems($accountId, $wcOrderData['line_items'] ?? []);

            $trackingNumber = null;
            $courierName = null;
            if (!empty($wcOrderData['meta_data']) && is_array($wcOrderData['meta_data'])) {
                foreach ($wcOrderData['meta_data'] as $meta) {
                    $key = strtolower($meta['key'] ?? '');
                    $val = $meta['value'] ?? null;
                    if (is_string($val) && !empty(trim($val))) {
                        if (in_array($key, ['_bosta_tracking_number', '_bosta_delivery_id', 'bosta_tracking_number', '_tracking_number', 'tracking_number', '_shipping_tracking_number', '_carrier_tracking_no'])) {
                            $trackingNumber = trim($val);
                            if (str_contains($key, 'bosta')) {
                                $courierName = 'بوسطة (Bosta)';
                            }
                        }
                    }
                }
            }

            return WcOrder::create([
                'user_id' => $accountId,
                'wc_order_id' => $wcOrderId,
                'order_date' => $orderDate,
                'party_id' => $party?->id,
                'branch_id' => $branchId,
                'tracking_number' => $trackingNumber,
                'courier_name' => $courierName,
                'status' => WcOrderStatus::PENDING_CONFIRMATION,
                'payment_status' => $isPaidOnline ? WcPaymentStatus::PAID_ONLINE : WcPaymentStatus::PENDING_COD,
                'wc_payment_method' => $paymentMethod,
                'shipping_cost' => $shippingCost,
                'subtotal' => max(0, $subtotal),
                'discount_total' => $discountTotal,
                'total' => $total,
                'customer_name' => $customerName,
                'customer_phone' => $finalPhone,
                'customer_email' => $billing['email'] ?? $party?->wc_email,
                'customer_address' => $finalAddress,
                'governorate' => !empty($state) ? $state : null,
                'city' => !empty($city) ? $city : null,
                'notes' => $wcOrderData['customer_note'] ?? null,
                'wc_coupon_codes' => $coupons,
                'items_snapshot' => $sanitizedLineItems,
            ]);
        });
    }

    /**
     * Confirm order and check stock availability at specified branch
     */
    public function confirmOrder(User $user, WcOrder $order, int $branchId, bool $force = false): WcOrder
    {
        $accountId = $user->getAccountId();
        $branch = Branch::where('user_id', $accountId)->findOrFail($branchId);

        $missingItems = [];
        $lineItems = $order->items_snapshot ?? [];

        foreach ($lineItems as $item) {
            $wcProductId = (int) ($item['product_id'] ?? 0);
            $wcVarId = !empty($item['variation_id']) ? (int) $item['variation_id'] : null;
            $qtyRequired = (float) ($item['quantity'] ?? 1);

            $product = Product::where('user_id', $accountId)
                ->where('wc_product_id', $wcProductId)
                ->first();

            $variant = null;
            if ($product && $wcVarId) {
                $variant = $product->variants()->where('wc_variation_id', $wcVarId)->first();
            }

            if (!$product) {
                $missingItems[] = "الصنف \"{$item['name']}\" غير مسجل بالنظام (يجب استيراد الأصناف أولاً)";
                continue;
            }

            $stock = BranchStock::where('branch_id', $branchId)
                ->where('product_id', $product->id)
                ->where('product_variant_id', $variant?->id)
                ->value('quantity') ?? 0;

            if ($stock < $qtyRequired) {
                $variantLabel = $variant ? " ({$variant->name})" : '';
                $missingItems[] = "الصنف \"{$product->name}{$variantLabel}\" الرصيد المتاح في {$branch->name}: {$stock}، والمطلوب: {$qtyRequired}";
            }
        }

        if (!empty($missingItems) && !$force) {
            throw new PosDomainException(
                message: "لا يمكن تأكيد الطلب لنقص في المخزون:\n" . implode("\n", $missingItems),
                errorCode: 'INSUFFICIENT_ONLINE_STOCK',
                statusCode: 422
            );
        }

        $orderNotes = $order->notes;
        if (!empty($missingItems) && $force) {
            $warningTag = "[تأكيد مع نقص مخزون: " . implode(' | ', $missingItems) . "]";
            $orderNotes = $orderNotes ? "{$orderNotes}\n{$warningTag}" : $warningTag;
        }

        $order->update([
            'branch_id' => $branchId,
            'status' => WcOrderStatus::CONFIRMED,
            'notes' => $orderNotes,
        ]);

        return $order->fresh(['party', 'branch']);
    }

    /**
     * Dispatch order to mandob (transferring stock from warehouse to VAN branch)
     */
    public function dispatchToMandob(User $user, WcOrder $order, int $mandobId): WcOrder
    {
        $accountId = $user->getAccountId();
        $mandob = User::where(function ($q) use ($accountId) {
            $q->where('id', $accountId)->orWhere('owner_id', $accountId);
        })->findOrFail($mandobId);

        // Find mandob's VAN branch
        $vanBranchId = $mandob->branch_id;
        $vanBranch = $vanBranchId ? Branch::where('user_id', $accountId)->where('type', 'VAN')->find($vanBranchId) : null;

        if (!$vanBranch) {
            // Find any active VAN branch
            $vanBranch = Branch::where('user_id', $accountId)->where('type', 'VAN')->where('is_active', true)->first();
        }

        return DB::transaction(function () use ($user, $accountId, $order, $mandob, $vanBranch) {
            // If VAN branch is available and differs from source branch, create stock transfer
            if ($vanBranch && $vanBranch->id !== $order->branch_id) {
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

                if (!empty($transferItems)) {
                    $this->stockTransferService->createTransfer($user, [
                        'from_branch_id' => $order->branch_id,
                        'to_branch_id' => $vanBranch->id,
                        'items' => $transferItems,
                        'notes' => "شحن طلب ووكومرس #{$order->wc_order_id} مع المندوب {$mandob->name}",
                    ]);
                }
            }

            $order->update([
                'mandob_id' => $mandob->id,
                'status' => WcOrderStatus::DISPATCHED,
            ]);

            return $order->fresh(['party', 'branch', 'mandob']);
        });
    }

    /**
     * Dispatch order to external courier company (Bosta, Aramex, etc.)
     */
    public function dispatchToCourier(User $user, WcOrder $order, array $courierData): WcOrder
    {
        $accountId = $user->getAccountId();

        if (in_array($order->status, [WcOrderStatus::DELIVERED, WcOrderStatus::RETURNED, WcOrderStatus::CANCELLED])) {
            throw new PosDomainException("لا يمكن إسناد طلب في حالة '{$order->status->label()}' لشركة شحن.");
        }

        $courierName = trim($courierData['courier_name'] ?? '');
        $trackingNumber = !empty($courierData['tracking_number']) ? trim($courierData['tracking_number']) : $order->tracking_number;
        $courierPartyId = !empty($courierData['courier_party_id']) ? (int) $courierData['courier_party_id'] : null;
        $branchId = !empty($courierData['branch_id']) ? (int) $courierData['branch_id'] : $order->branch_id;

        if (!$courierPartyId && !empty($courierName)) {
            $party = Party::where('user_id', $accountId)
                ->where('type', PartyType::COURIER->value)
                ->where('name', $courierName)
                ->first();
            if ($party) {
                $courierPartyId = $party->id;
            }
        }

        return DB::transaction(function () use ($order, $branchId, $courierPartyId, $courierName, $trackingNumber) {
            $order->update([
                'branch_id' => $branchId,
                'shipping_type' => 'COURIER',
                'courier_party_id' => $courierPartyId,
                'courier_name' => $courierName ?: $order->courier_name,
                'tracking_number' => $trackingNumber,
                'shipped_at' => now(),
                'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            ]);

            return $order->fresh(['party', 'branch', 'mandob', 'courierParty']);
        });
    }

    /**
     * Deliver order, collect payment, and create official Sales Invoice atomically
     */
    public function deliverOrder(User $user, WcOrder $order, array $deliveryData = []): Invoice
    {
        if ($order->status === WcOrderStatus::DELIVERED && $order->invoice_id) {
            return Invoice::findOrFail($order->invoice_id);
        }

        $accountId = $user->getAccountId();

        return DB::transaction(function () use ($user, $accountId, $order, $deliveryData) {
            // Map items for InvoiceService
            $invoiceItems = [];
            foreach ($order->items_snapshot ?? [] as $item) {
                $wcProductId = (int) ($item['product_id'] ?? 0);
                $wcVarId = !empty($item['variation_id']) ? (int) $item['variation_id'] : null;
                $qty = (float) ($item['quantity'] ?? 1);
                $unitPrice = (float) ($item['price'] ?? (isset($item['subtotal']) ? ($item['subtotal'] / max(1, $qty)) : ($item['total'] / max(1, $qty))));

                $product = Product::where('user_id', $accountId)->where('wc_product_id', $wcProductId)->first();
                if (!$product && !empty($item['product_id'])) {
                    $product = Product::where('user_id', $accountId)->find($item['product_id']);
                }
                $variant = $product && $wcVarId ? $product->variants()->where('wc_variation_id', $wcVarId)->first() : null;

                if ($product) {
                    $invoiceItems[] = [
                        'product_id' => $product->id,
                        'product_variant_id' => $variant?->id,
                        'quantity' => $qty,
                        'unit_price' => $unitPrice,
                        'variant_name' => $variant?->name,
                    ];
                }
            }

            $isPaidOnline = $order->payment_status === WcPaymentStatus::PAID_ONLINE;
            $rawCollected = isset($deliveryData['collected_amount'])
                ? (float) $deliveryData['collected_amount']
                : (float) $order->total;

            if ($rawCollected > (float) $order->total) {
                throw new PosDomainException("المبلغ المحصل ({$rawCollected}) لا يمكن أن يتجاوز إجمالي الطلب ({$order->total}).", 'COLLECTED_AMOUNT_EXCEEDS_TOTAL');
            }

            if ($order->courier_party_id) {
                if ($isPaidOnline || $rawCollected <= 0) {
                    $paymentMethod = $deliveryData['payment_method'] ?? 'TRANSFER';
                    $actualCollected = 0.0;
                    $paidAmount = (float) $order->total;
                } else {
                    $paymentMethod = PaymentMethod::COURIER_COD->value;
                    $actualCollected = $rawCollected;
                    $paidAmount = $rawCollected;
                }
            } else {
                $paymentMethod = $deliveryData['payment_method'] ?? ($isPaidOnline ? 'TRANSFER' : 'CASH');
                $actualCollected = $rawCollected;
                $paidAmount = $rawCollected;
            }

            // Use mandob branch or order branch
            $executingBranchId = $order->mandob?->branch_id ?? $order->branch_id;

            $shippingInfo = '';
            if ($order->courier_name) {
                $shippingInfo .= " [شركة شحن: {$order->courier_name}";
                if ($order->tracking_number) {
                    $shippingInfo .= " - بوليصة: {$order->tracking_number}";
                }
                $shippingInfo .= ']';
            } elseif ($order->mandob) {
                $shippingInfo .= " [مندوب: {$order->mandob->name}]";
            }

            $mandob = $order->mandob;
            $mandobTreasury = $mandob?->assignedTreasury;
            $mandobShift = $mandob ? \App\Models\Shift::where('user_id', $mandob->id)->where('status', 'OPEN')->first() : null;

            $invoiceData = [
                'type' => 'SALE',
                'party_id' => $order->party_id,
                'courier_party_id' => $order->courier_party_id,
                'branch_id' => $executingBranchId,
                'items' => $invoiceItems,
                'discount' => $order->discount_total,
                'shipping_amount' => $order->shipping_cost,
                'paid_amount' => $paidAmount,
                'payment_method' => $paymentMethod,
                'wc_order_id' => $order->wc_order_id,
                'notes' => "أوردر ووكومرس #{$order->wc_order_id}{$shippingInfo}" . ($order->notes ? " | {$order->notes}" : ''),
            ];

            // إذا كان الطلب مسنداً لمندوب وكان التحصيل نقداً، تُنسب الفاتورة والخزينة لعهدة المندوب
            if ($mandob && $paymentMethod === 'CASH') {
                $invoiceData['created_by'] = $mandob->id;
                if ($mandobTreasury) {
                    $invoiceData['treasury_id'] = $mandobTreasury->id;
                }
                if ($mandobShift) {
                    $invoiceData['shift_id'] = $mandobShift->id;
                }
            }

            $invoice = $this->invoiceService->createInvoice($user, $invoiceData);

            if ($order->courier_party_id && $actualCollected > 0) {
                $this->courierService->recordDeliveryCollection($user, $invoice, $order, $actualCollected);
            }

            $order->update([
                'invoice_id' => $invoice->id,
                'status' => WcOrderStatus::DELIVERED,
                'payment_status' => WcPaymentStatus::COLLECTED,
            ]);

            return $invoice;
        });

        // إشعار WooCommerce خارج كتلة Transaction لمنع تعليق أقفال قاعدة البيانات أثناء طلبات الشبكة
        try {
            $integration = WooCommerceIntegration::where('user_id', $accountId)->first();
            if ($integration && $integration->is_active) {
                $this->apiClient->updateOrderStatus($integration, $order->wc_order_id, 'completed');
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Failed to notify WooCommerce for completed order #{$order->wc_order_id}: " . $e->getMessage());
        }

        return $invoice;
    }

    /**
     * Mark order as returned
     */
    public function returnOrder(User $user, WcOrder $order, ?string $reason = null): void
    {
        $order->update([
            'status' => WcOrderStatus::RETURNED,
            'notes' => ($order->notes ? $order->notes . ' | ' : '') . "مرتجع: " . ($reason ?? 'تم رفض الاستلام'),
        ]);

        $integration = WooCommerceIntegration::where('user_id', $user->getAccountId())->first();
        if ($integration && $integration->is_active) {
            $this->apiClient->updateOrderStatus($integration, $order->wc_order_id, 'refunded');
        }
    }

    /**
     * Pull recent orders directly from WooCommerce REST API
     */
    public function pullRecentOrders(User $user, int $limit = 30): array
    {
        $accountId = $user->getAccountId();
        $integration = WooCommerceIntegration::where('user_id', $accountId)->first();

        if (!$integration || !$integration->is_active) {
            throw new PosDomainException('ربط ووكومرس غير مفعل أو لم يتم تهيئته بعد.', 'WOOCOMMERCE_INACTIVE', 422);
        }

        $imported = 0;
        $updated = 0;

        foreach (['processing', 'pending', 'on-hold'] as $status) {
            $orders = $this->apiClient->getOrders($integration, $status, 1, $limit);
            foreach ($orders as $orderData) {
                if (empty($orderData['id'])) {
                    continue;
                }

                $wcOrderId = (int) $orderData['id'];
                $existing = WcOrder::where('user_id', $accountId)->where('wc_order_id', $wcOrderId)->first();

                $this->handleIncomingOrder($user, $orderData);

                if ($existing) {
                    $updated++;
                } else {
                    $imported++;
                }
            }
        }

        return [
            'imported' => $imported,
            'updated' => $updated,
            'total' => $imported + $updated,
        ];
    }

    /**
     * Enrich order line items with product images, clean names, and structured attribute badges.
     */
    protected function enrichLineItems(int $accountId, array $rawLineItems): array
    {
        $wcProductIds = [];
        $wcVarIds = [];

        foreach ($rawLineItems as $item) {
            if (!empty($item['product_id'])) {
                $wcProductIds[] = (int) $item['product_id'];
            }
            if (!empty($item['variation_id'])) {
                $wcVarIds[] = (int) $item['variation_id'];
            }
        }

        $wcProductIds = array_unique(array_filter($wcProductIds));
        $wcVarIds = array_unique(array_filter($wcVarIds));

        $productsByWcId = !empty($wcProductIds)
            ? Product::where('user_id', $accountId)->whereIn('wc_product_id', $wcProductIds)->get()->keyBy('wc_product_id')
            : collect();

        $variantsByWcId = !empty($wcVarIds)
            ? ProductVariant::where('user_id', $accountId)->whereIn('wc_variation_id', $wcVarIds)->get()->keyBy('wc_variation_id')
            : collect();

        return array_map(function ($item) use ($productsByWcId, $variantsByWcId) {
            if (isset($item['name']) && is_string($item['name'])) {
                $item['name'] = trim(html_entity_decode(strip_tags($item['name']), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            }

            $wcProductId = (int) ($item['product_id'] ?? 0);
            $wcVarId = !empty($item['variation_id']) ? (int) $item['variation_id'] : null;

            // Extract variation / product image URL
            $imageUrl = null;
            if ($wcVarId && isset($variantsByWcId[$wcVarId])) {
                $imageUrl = $variantsByWcId[$wcVarId]->image_url;
            }
            if (!$imageUrl && $wcProductId && isset($productsByWcId[$wcProductId])) {
                $imageUrl = $productsByWcId[$wcProductId]->image_url;
            }
            if (!$imageUrl && !empty($item['image']['src'])) {
                $imageUrl = (string) $item['image']['src'];
            }
            $item['image_url'] = $imageUrl;

            // Extract variation attributes from meta_data
            $attributes = [];
            if (!empty($item['meta_data']) && is_array($item['meta_data'])) {
                foreach ($item['meta_data'] as $meta) {
                    $key = (string) ($meta['display_key'] ?? $meta['key'] ?? '');
                    $value = (string) ($meta['display_value'] ?? $meta['value'] ?? '');

                    if (str_starts_with(trim($key), '_')) {
                        continue;
                    }

                    $cleanKey = trim(html_entity_decode(strip_tags($key), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                    $cleanVal = trim(html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

                    if ($cleanKey !== '' && $cleanVal !== '') {
                        $attributes[] = [
                            'key' => $cleanKey,
                            'value' => $cleanVal,
                        ];
                    }
                }
            }
            $item['attributes'] = $attributes;

            return $item;
        }, $rawLineItems);
    }
}

