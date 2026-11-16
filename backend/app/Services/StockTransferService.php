<?php

namespace App\Services;

use App\Enums\DocumentType;
use App\Enums\StockMovementSource;
use App\Enums\StockMovementType;
use App\Enums\StockTransferStatus;
use App\Exceptions\StockTransferDomainException;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\User;
use App\Services\DocumentSequenceService;
use App\Support\Quantity;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class StockTransferService
{
    public function __construct(
        protected ?DocumentSequenceService $sequenceService = null
    ) {
        $this->sequenceService ??= app(DocumentSequenceService::class);
    }
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

        $perPage = min(max(1, (int) ($filters['per_page'] ?? config('pos.pagination.default', 20))), (int) config('pos.pagination.max', 100));

        return $query->orderByDesc('id')->paginate($perPage);
    }

    /**
     * إنشاء إذن تحويل جديد وخصم المخزون من فرع المصدر فورياً مع تحويل الحالة إلى IN_TRANSIT
     */
    public function createTransfer(User $user, array $data): StockTransfer
    {
        return DB::transaction(function () use ($user, $data) {
            $accountId = $user->getAccountId();
            [$fromBranch, $toBranch] = $this->resolveTransferBranches($user, $accountId, (int) $data['from_branch_id'], (int) $data['to_branch_id']);
            $seq = $this->sequenceService->next($accountId, DocumentType::TRANSFER);
            $transferNumber = $data['transfer_number'] ?? ('TRF-' . str_pad((string) $seq, 5, '0', STR_PAD_LEFT));

            $transfer = StockTransfer::create([
                'user_id' => $accountId, 'transfer_number' => $transferNumber, 'from_branch_id' => $fromBranch->id, 'to_branch_id' => $toBranch->id,
                'status' => StockTransferStatus::IN_TRANSIT, 'created_by' => $user->id, 'transferred_at' => now(), 'notes' => $data['notes'] ?? null,
            ]);

            foreach ($data['items'] as $itemData) {
                $this->processOutgoingTransferItem($accountId, $transfer, $fromBranch, $toBranch, $itemData);
            }

            return $transfer->load(['items.product', 'items.variant', 'fromBranch', 'toBranch']);
        });
    }

    private function resolveTransferBranches(User $user, int $accountId, int $fromBranchId, int $toBranchId): array
    {
        if ($fromBranchId === $toBranchId) {
            throw new StockTransferDomainException('لا يمكن إجراء تحويل لنفس الفرع.', 'SAME_BRANCH_TRANSFER');
        }
        if ($user->isManager() && $user->branch_id && $fromBranchId !== (int) $user->branch_id) {
            throw new StockTransferDomainException('عذراً، لا يمكنك تحويل بضاعة إلا من الفرع المسؤول عنه.', 'UNAUTHORIZED_BRANCH');
        }

        $fromBranch = Branch::where('user_id', $accountId)->findOrFail($fromBranchId);
        $toBranch = Branch::where('user_id', $accountId)->findOrFail($toBranchId);
        if (!$fromBranch->is_active || !$toBranch->is_active) {
            throw new StockTransferDomainException('أحد الفروع المحددة غير نشط حالياً.', 'BRANCH_INACTIVE');
        }

        return [$fromBranch, $toBranch];
    }

    private function processOutgoingTransferItem(int $accountId, StockTransfer $transfer, Branch $fromBranch, Branch $toBranch, array $itemData): void
    {
        $productId = (int) $itemData['product_id'];
        $variantId = !empty($itemData['product_variant_id']) ? (int) $itemData['product_variant_id'] : null;
        $qty = Quantity::of($itemData['quantity_sent'])->toFloat();
        if ($qty <= 0) {
            throw new StockTransferDomainException('كمية التحويل يجب أن تكون أكبر من صفر.', 'INVALID_QUANTITY');
        }

        $product = Product::where('user_id', $accountId)->findOrFail($productId);
        $variant = $variantId ? ProductVariant::where('product_id', $productId)->findOrFail($variantId) : null;
        $fromStock = BranchStock::where('branch_id', $fromBranch->id)->where('product_id', $productId)->where('product_variant_id', $variantId)->lockForUpdate()->first();
        $availableQty = Quantity::of($fromStock?->quantity ?? 0)->toFloat();
        if ($availableQty < $qty) {
            throw new StockTransferDomainException("الرصيد غير كافٍ في {$fromBranch->name} للصنف " . ($variant ? "{$product->name} ({$variant->name})" : $product->name) . ". المتاح: {$availableQty}، المطلوب: {$qty}", 'INSUFFICIENT_TRANSFER_STOCK');
        }

        $fromStock->quantity -= $qty;
        $fromStock->save();
        StockMovement::create([
            'user_id' => $accountId, 'branch_id' => $fromBranch->id, 'product_id' => $productId, 'product_variant_id' => $variantId,
            'type' => StockMovementType::OUT->value, 'source_type' => 'TRANSFER_OUT', 'source_id' => $transfer->id,
            'quantity' => $qty, 'balance_after' => $fromStock->quantity, 'notes' => "تحويل بضاعة إلى {$toBranch->name} بموجب إذن {$transfer->transfer_number}",
        ]);
        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id, 'product_id' => $productId, 'product_variant_id' => $variantId,
            'quantity_sent' => $qty, 'quantity_received' => null, 'unit_name' => $itemData['unit_name'] ?? $product->unit, 'notes' => $itemData['notes'] ?? null,
        ]);
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

            foreach ($lockedTransfer->items as $item) {
                $this->receiveTransferItem($user, $lockedTransfer, $item, $data);
            }

            $lockedTransfer->update(['status' => StockTransferStatus::RECEIVED, 'received_by' => $user->id, 'received_at' => now()]);

            return $lockedTransfer->fresh(['items.product', 'items.variant', 'fromBranch', 'toBranch', 'receiver']);
        });
    }

    private function receiveTransferItem(User $user, StockTransfer $transfer, StockTransferItem $item, array $data): void
    {
        $qtyReceived = isset($data['items'][$item->id]['quantity_received'])
            ? Quantity::of($data['items'][$item->id]['quantity_received'])->toFloat()
            : Quantity::of($item->quantity_sent)->toFloat();

        if ($qtyReceived < 0) {
            throw new StockTransferDomainException('الكمية المستلمة لا يمكن أن تكون سالبة.', 'INVALID_QUANTITY');
        }
        if ($qtyReceived > Quantity::of($item->quantity_sent)->toFloat()) {
            throw new StockTransferDomainException("الكمية المستلمة ({$qtyReceived}) لا يمكن أن تتجاوز الكمية المرسلة ({$item->quantity_sent}) للصنف.", 'EXCESSIVE_QUANTITY');
        }

        $item->update(['quantity_received' => $qtyReceived]);
        $toStock = $this->lockBranchStock($transfer->to_branch_id, $item->product_id, $item->product_variant_id, $item->variant?->min_quantity ?? $item->product?->min_quantity);
        $toStock->increment('quantity', $qtyReceived);

        StockMovement::create([
            'user_id' => $user->getAccountId(), 'branch_id' => $transfer->to_branch_id, 'product_id' => $item->product_id,
            'product_variant_id' => $item->product_variant_id, 'type' => StockMovementType::IN->value, 'source_type' => 'TRANSFER_IN',
            'source_id' => $transfer->id, 'quantity' => $qtyReceived, 'balance_after' => $toStock->fresh()->quantity,
            'notes' => "استلام تحويل بضاعة من {$transfer->fromBranch->name} بموجب إذن {$transfer->transfer_number}",
        ]);
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

            foreach ($lockedTransfer->items as $item) {
                $this->revertCancelledTransferItem($user, $lockedTransfer, $item, $reason);
            }

            $lockedTransfer->update([
                'status' => StockTransferStatus::CANCELLED,
                'notes' => ($lockedTransfer->notes ? $lockedTransfer->notes . ' | ' : '') . "تم الإلغاء: " . ($reason ?? 'طلب إلغاء'),
            ]);

            return $lockedTransfer->fresh(['items.product', 'items.variant', 'fromBranch', 'toBranch']);
        });
    }

    private function revertCancelledTransferItem(User $user, StockTransfer $transfer, StockTransferItem $item, ?string $reason): void
    {
        $qty = Quantity::of($item->quantity_sent)->toFloat();
        $fromStock = $this->lockBranchStock($transfer->from_branch_id, $item->product_id, $item->product_variant_id);
        $fromStock->increment('quantity', $qty);

        StockMovement::create([
            'user_id' => $user->getAccountId(),
            'branch_id' => $transfer->from_branch_id,
            'product_id' => $item->product_id,
            'product_variant_id' => $item->product_variant_id,
            'type' => StockMovementType::IN->value,
            'source_type' => StockMovementSource::ADJUSTMENT->value,
            'source_id' => $transfer->id,
            'quantity' => $qty,
            'balance_after' => $fromStock->fresh()->quantity,
            'notes' => "إلغاء أمر تحويل المخزون رقم {$transfer->transfer_number}: " . ($reason ?? 'إلغاء بواسطة المستخدم'),
        ]);
    }
}
