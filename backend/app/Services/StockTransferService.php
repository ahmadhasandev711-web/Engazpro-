<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\StockMovement;
use App\Models\User;
use App\Enums\StockTransferStatus;
use App\Exceptions\StockTransferDomainException;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class StockTransferService
{
    /**
     * استرجاع قائمة أوامر التحويل مع الفلاتر والتصفح
     */
    public function getTransfers(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = StockTransfer::where('user_id', $user->getAccountId())
            ->with(['fromBranch', 'toBranch', 'creator', 'receiver', 'items.product', 'items.variant']);

        if ($user->isManager() && $user->branch_id) {
            $query->where(function ($q) use ($user) {
                $q->where('from_branch_id', $user->branch_id)
                  ->orWhere('to_branch_id', $user->branch_id);
            });
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['from_branch_id'])) {
            $query->where('from_branch_id', $filters['from_branch_id']);
        }

        if (!empty($filters['to_branch_id'])) {
            $query->where('to_branch_id', $filters['to_branch_id']);
        }

        return $query->orderByDesc('id')->paginate($filters['per_page'] ?? 20);
    }

    /**
     * إنشاء إذن تحويل جديد وخصم المخزون من فرع المصدر فورياً مع تحويل الحالة إلى IN_TRANSIT
     */
    public function createTransfer(User $user, array $data): StockTransfer
    {
        return DB::transaction(function () use ($user, $data) {
            $accountId = $user->getAccountId();
            $fromBranchId = (int) $data['from_branch_id'];
            $toBranchId = (int) $data['to_branch_id'];

            if ($fromBranchId === $toBranchId) {
                throw new StockTransferDomainException('لا يمكن إجراء تحويل لنفس الفرع.', 'SAME_BRANCH_TRANSFER');
            }

            if ($user->isManager() && $user->branch_id && $fromBranchId !== (int) $user->branch_id) {
                throw new StockTransferDomainException('عذراً، لا يمكنك تحويل بضاعة إلا من الفرع المسؤول عنه.', 'UNAUTHORIZED_BRANCH');
            }

            // التحقق من تبعية الفروع لنفس المتجر
            $fromBranch = Branch::where('user_id', $accountId)->findOrFail($fromBranchId);
            $toBranch = Branch::where('user_id', $accountId)->findOrFail($toBranchId);

            if (!$fromBranch->is_active || !$toBranch->is_active) {
                throw new StockTransferDomainException('أحد الفروع المحددة غير نشط حالياً.', 'BRANCH_INACTIVE');
            }

            // توليد رقم الإذن
            $count = StockTransfer::where('user_id', $accountId)->count() + 1;
            $transferNumber = $data['transfer_number'] ?? ('TRF-' . str_pad($count, 5, '0', STR_PAD_LEFT));

            // إنشاء أمر التحويل بحالة في الطريق (IN_TRANSIT)
            $transfer = StockTransfer::create([
                'user_id' => $accountId,
                'transfer_number' => $transferNumber,
                'from_branch_id' => $fromBranchId,
                'to_branch_id' => $toBranchId,
                'status' => StockTransferStatus::IN_TRANSIT,
                'created_by' => $user->id,
                'transferred_at' => now(),
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($data['items'] as $itemData) {
                $productId = (int) $itemData['product_id'];
                $variantId = !empty($itemData['product_variant_id']) ? (int) $itemData['product_variant_id'] : null;
                $qty = (float) $itemData['quantity_sent'];

                if ($qty <= 0) {
                    throw new StockTransferDomainException('كمية التحويل يجب أن تكون أكبر من صفر.', 'INVALID_QUANTITY');
                }

                $product = Product::where('user_id', $accountId)->findOrFail($productId);
                $variant = $variantId ? ProductVariant::where('product_id', $productId)->findOrFail($variantId) : null;

                // فحص الرصيد المتاح في فرع المصدر
                $fromStock = BranchStock::where('branch_id', $fromBranchId)
                    ->where('product_id', $productId)
                    ->where('product_variant_id', $variantId)
                    ->lockForUpdate()
                    ->first();

                $availableQty = (float) ($fromStock?->quantity ?? 0);
                if ($availableQty < $qty) {
                    $itemLabel = $variant ? "{$product->name} ({$variant->name})" : $product->name;
                    throw new StockTransferDomainException("الرصيد غير كافٍ في {$fromBranch->name} للصنف {$itemLabel}. المتاح: {$availableQty}، المطلوب: {$qty}", 'INSUFFICIENT_TRANSFER_STOCK');
                }

                // خصم الرصيد من فرع المصدر
                $fromStock->quantity -= $qty;
                $fromStock->save();

                // تسجيل حركة المخزون خروج (OUT) من فرع المصدر
                StockMovement::create([
                    'user_id' => $accountId,
                    'branch_id' => $fromBranchId,
                    'product_id' => $productId,
                    'product_variant_id' => $variantId,
                    'type' => 'OUT',
                    'source_type' => 'TRANSFER_OUT',
                    'source_id' => $transfer->id,
                    'quantity' => $qty,
                    'balance_after' => $fromStock->quantity,
                    'notes' => "تحويل بضاعة إلى {$toBranch->name} بموجب إذن {$transferNumber}",
                ]);

                // تسجيل بند التحويل
                StockTransferItem::create([
                    'stock_transfer_id' => $transfer->id,
                    'product_id' => $productId,
                    'product_variant_id' => $variantId,
                    'quantity_sent' => $qty,
                    'quantity_received' => null,
                    'unit_name' => $itemData['unit_name'] ?? $product->unit,
                    'notes' => $itemData['notes'] ?? null,
                ]);
            }

            return $transfer->load(['items.product', 'items.variant', 'fromBranch', 'toBranch']);
        });
    }

    /**
     * قفل سجل رصيد الفرع تشاؤمياً بشكل صحيح لمنع تضارب التزامن
     */
    private function lockBranchStock(int $branchId, int $productId, ?int $variantId, ?int $minQuantity = null): BranchStock
    {
        $stock = BranchStock::where('branch_id', $branchId)
            ->where('product_id', $productId)
            ->where('product_variant_id', $variantId)
            ->lockForUpdate()
            ->first();

        if ($stock) {
            return $stock;
        }

        BranchStock::firstOrCreate([
            'branch_id' => $branchId,
            'product_id' => $productId,
            'product_variant_id' => $variantId,
        ], [
            'quantity' => 0,
            'min_quantity' => $minQuantity,
        ]);

        return BranchStock::where('branch_id', $branchId)
            ->where('product_id', $productId)
            ->where('product_variant_id', $variantId)
            ->lockForUpdate()
            ->firstOrFail();
    }

    /**
     * تأكيد استلام أمر التحويل في فرع الوجهة وتغذية أرصدته
     */
    public function receiveTransfer(User $user, StockTransfer $transfer, array $data = []): StockTransfer
    {
        return DB::transaction(function () use ($user, $transfer, $data) {
            $lockedTransfer = StockTransfer::where('id', $transfer->id)->lockForUpdate()->firstOrFail();
            if ($lockedTransfer->status !== StockTransferStatus::IN_TRANSIT) {
                throw new StockTransferDomainException('لا يمكن تأكيد استلام إذن غير موجود بحالة "في الطريق".', 'INVALID_TRANSFER_STATUS');
            }

            $accountId = $user->getAccountId();
            $toBranchId = $lockedTransfer->to_branch_id;

            foreach ($lockedTransfer->items as $item) {
                $qtyReceived = isset($data['items'][$item->id]['quantity_received'])
                    ? (float) $data['items'][$item->id]['quantity_received']
                    : (float) $item->quantity_sent;

                if ($qtyReceived < 0) {
                    throw new StockTransferDomainException('الكمية المستلمة لا يمكن أن تكون سالبة.', 'INVALID_QUANTITY');
                }

                if ($qtyReceived > (float) $item->quantity_sent) {
                    throw new StockTransferDomainException("الكمية المستلمة ({$qtyReceived}) لا يمكن أن تتجاوز الكمية المرسلة ({$item->quantity_sent}) للصنف.", 'EXCESSIVE_QUANTITY');
                }

                $item->update([
                    'quantity_received' => $qtyReceived,
                ]);

                // إضافة الرصيد إلى فرع الوجهة مع القفل التشاؤمي الفعلي
                $toStock = $this->lockBranchStock(
                    $toBranchId,
                    $item->product_id,
                    $item->product_variant_id,
                    $item->variant?->min_quantity ?? $item->product?->min_quantity
                );

                $toStock->quantity += $qtyReceived;
                $toStock->save();

                // تسجيل حركة المخزون دخول (IN) في فرع الوجهة
                StockMovement::create([
                    'user_id' => $accountId,
                    'branch_id' => $toBranchId,
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'type' => 'IN',
                    'source_type' => 'TRANSFER_IN',
                    'source_id' => $lockedTransfer->id,
                    'quantity' => $qtyReceived,
                    'balance_after' => $toStock->quantity,
                    'notes' => "استلام تحويل بضاعة من {$lockedTransfer->fromBranch->name} بموجب إذن {$lockedTransfer->transfer_number}",
                ]);
            }

            $lockedTransfer->update([
                'status' => StockTransferStatus::RECEIVED,
                'received_by' => $user->id,
                'received_at' => now(),
            ]);

            return $lockedTransfer->fresh(['items.product', 'items.variant', 'fromBranch', 'toBranch', 'receiver']);
        });
    }

    /**
     * إلغاء أمر التحويل وإرجاع البضاعة لفرع المصدر
     */
    public function cancelTransfer(User $user, StockTransfer $transfer, ?string $reason = null): StockTransfer
    {
        return DB::transaction(function () use ($user, $transfer, $reason) {
            $lockedTransfer = StockTransfer::where('id', $transfer->id)->lockForUpdate()->firstOrFail();
            if ($lockedTransfer->status !== StockTransferStatus::IN_TRANSIT && $lockedTransfer->status !== StockTransferStatus::PENDING) {
                throw new StockTransferDomainException('لا يمكن إلغاء إذن تم استلامه بالفعل.', 'TRANSFER_ALREADY_RECEIVED');
            }

            $accountId = $user->getAccountId();
            $fromBranchId = $lockedTransfer->from_branch_id;

            // إعادة الكميات المحولة لفرع المصدر مع القفل التشاؤمي الفعلي
            foreach ($lockedTransfer->items as $item) {
                $qty = (float) $item->quantity_sent;

                $fromStock = $this->lockBranchStock(
                    $fromBranchId,
                    $item->product_id,
                    $item->product_variant_id
                );

                $fromStock->quantity += $qty;
                $fromStock->save();

                StockMovement::create([
                    'user_id' => $accountId,
                    'branch_id' => $fromBranchId,
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'type' => 'IN',
                    'source_type' => 'ADJUSTMENT',
                    'source_id' => $lockedTransfer->id,
                    'quantity' => $qty,
                    'balance_after' => $fromStock->quantity,
                    'notes' => "إلغاء أمر تحويل المخزون رقم {$lockedTransfer->transfer_number}: " . ($reason ?? 'إلغاء بواسطة المستخدم'),
                ]);
            }

            $lockedTransfer->update([
                'status' => StockTransferStatus::CANCELLED,
                'notes' => ($lockedTransfer->notes ? $lockedTransfer->notes . ' | ' : '') . "تم الإلغاء: " . ($reason ?? 'طلب إلغاء'),
            ]);

            return $lockedTransfer->fresh(['items.product', 'items.variant', 'fromBranch', 'toBranch']);
        });
    }
}
