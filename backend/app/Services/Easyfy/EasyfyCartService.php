<?php

namespace App\Services\Easyfy;

use App\Enums\Easyfy\EasyfyStockMode;
use App\Exceptions\PosDomainException;
use App\Models\Easyfy\EasyfyCart;
use App\Models\Easyfy\EasyfyCartItem;
use App\Models\Easyfy\EasyfyOrder;
use App\Models\Easyfy\EasyfyProduct;
use App\Models\Easyfy\EasyfyProductVariant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class EasyfyCartService
{
    public function __construct(private readonly EasyfyMediaService $mediaService) {}

    public function getCartWithRelations(User $user): EasyfyCart
    {
        $cart = $this->findOrCreateCart($user);

        return $cart->load(['items.product.images', 'items.variant.priceTiers']);
    }

    public function addItem(User $user, array $data): EasyfyCart
    {
        return DB::transaction(function () use ($user, $data) {
            $cart = $this->findOrCreateCart($user);
            $variant = $this->loadSellableVariant((int) $data['variant_id']);
            $qty = max(1, (int) $data['quantity']);
            $note = isset($data['custom_note']) ? trim((string) $data['custom_note']) : null;
            $existing = $this->findMatchingCartItem($cart->id, $variant->id, $note);
            $targetQty = $existing ? ($existing->quantity + $qty) : $qty;
            $this->assertVariantSellableQty($variant, $targetQty);
            if ($existing) {
                $existing->update(['quantity' => $targetQty]);
            } else {
                EasyfyCartItem::create([
                    'cart_id' => $cart->id, 'product_id' => $variant->product_id,
                    'variant_id' => $variant->id, 'quantity' => $targetQty, 'custom_note' => $note ?: null,
                ]);
            }

            return $this->getCartWithRelations($user);
        });
    }

    public function updateItem(User $user, int $itemId, array $data): EasyfyCart
    {
        return DB::transaction(function () use ($user, $itemId, $data) {
            $item = $this->findOwnedCartItem($user, $itemId);
            $qty = (int) $data['quantity'];
            if ($qty <= 0) {
                $this->mediaService->deletePrivateFile($item->artwork_path);
                $item->delete();

                return $this->getCartWithRelations($user);
            }
            $variant = $this->loadSellableVariant($item->variant_id);
            $this->assertVariantSellableQty($variant, $qty);
            $item->update([
                'quantity' => $qty,
                'custom_note' => array_key_exists('custom_note', $data) ? $data['custom_note'] : $item->custom_note,
            ]);

            return $this->getCartWithRelations($user);
        });
    }

    public function removeItem(User $user, int $itemId): EasyfyCart
    {
        $item = $this->findOwnedCartItem($user, $itemId);
        $this->mediaService->deletePrivateFile($item->artwork_path);
        $item->delete();

        return $this->getCartWithRelations($user);
    }

    public function attachItemArtwork(User $user, int $itemId, UploadedFile $file): EasyfyCart
    {
        $item = $this->findOwnedCartItem($user, $itemId);
        if (!$item->product?->allow_artwork_upload) {
            throw new PosDomainException('هذا الصنف لا يقبل إرفاق ملف تصميم.', 'ARTWORK_NOT_ALLOWED', 422);
        }
        $path = $this->mediaService->storePrivateFile($file, 'artworks', ['jpg', 'jpeg', 'png', 'webp', 'pdf']);
        $this->mediaService->deletePrivateFile($item->artwork_path);
        $item->update(['artwork_path' => $path]);

        return $this->getCartWithRelations($user);
    }

    public function clearCart(EasyfyCart $cart): void
    {
        $cart->items()->delete();
        $cart->update(['coupon_code' => null]);
    }

    public function reorderFromOrder(User $user, int $orderId): array
    {
        $order = EasyfyOrder::where('account_id', $user->getAccountId())->with('items')->findOrFail($orderId);
        $skipped = [];

        DB::transaction(function () use ($user, $order, &$skipped) {
            foreach ($order->items as $orderItem) {
                if (!$orderItem->variant_id || !$this->tryAddReorderLine($user, $orderItem->variant_id, $orderItem->quantity, $orderItem->custom_note)) {
                    $skipped[] = "{$orderItem->product_name} ({$orderItem->variant_label})";
                }
            }
        });

        return ['cart' => $this->getCartWithRelations($user), 'skipped_items' => $skipped];
    }

    private function tryAddReorderLine(User $user, int $variantId, int $qty, ?string $note): bool
    {
        $variant = EasyfyProductVariant::with('product')->find($variantId);
        if (!$variant || !$variant->is_active || !$variant->product || !$variant->product->is_active) {
            return false;
        }
        if ($variant->product->stock_mode === EasyfyStockMode::TRACKED && $variant->stock_quantity < $qty) {
            return false;
        }
        $this->addItem($user, ['variant_id' => $variantId, 'quantity' => $qty, 'custom_note' => $note]);

        return true;
    }

    private function findOrCreateCart(User $user): EasyfyCart
    {
        return EasyfyCart::firstOrCreate([
            'account_id' => $user->getAccountId(),
            'user_id' => $user->id,
        ]);
    }

    private function findOwnedCartItem(User $user, int $itemId): EasyfyCartItem
    {
        $cart = $this->findOrCreateCart($user);

        return EasyfyCartItem::with('product')->where('cart_id', $cart->id)->findOrFail($itemId);
    }

    private function findMatchingCartItem(int $cartId, int $variantId, ?string $note): ?EasyfyCartItem
    {
        if ($note !== null && $note !== '') {
            return null;
        }

        return EasyfyCartItem::where('cart_id', $cartId)
            ->where('variant_id', $variantId)
            ->whereNull('custom_note')
            ->whereNull('artwork_path')
            ->first();
    }

    private function loadSellableVariant(int $variantId): EasyfyProductVariant
    {
        $variant = EasyfyProductVariant::with('product')->where('is_active', true)->findOrFail($variantId);
        $product = $variant->product;
        if (!$product instanceof EasyfyProduct || !$product->is_active) {
            throw new PosDomainException('هذا الصنف غير متاح للطلب حالياً.', 'EASYFY_PRODUCT_INACTIVE', 422);
        }

        return $variant;
    }

    private function assertVariantSellableQty(EasyfyProductVariant $variant, int $qty): void
    {
        $minQty = max($variant->min_order_qty, $variant->product->min_order_qty);
        if ($qty < $minQty) {
            throw new PosDomainException("الحد الأدنى لطلب هذا الصنف هو {$minQty}.", 'EASYFY_MIN_QTY_NOT_MET', 422);
        }
        if ($variant->product->stock_mode === EasyfyStockMode::TRACKED && $qty > $variant->stock_quantity) {
            throw new PosDomainException("الكمية المتوفرة حالياً في المخزون هي {$variant->stock_quantity} فقط.", 'EASYFY_INSUFFICIENT_STOCK', 422);
        }
    }
}
