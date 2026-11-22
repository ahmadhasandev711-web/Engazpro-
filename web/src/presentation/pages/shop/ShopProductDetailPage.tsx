import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Upload,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  EasyfyProductVariant,
  EasyfyStockMode,
  formatCurrency,
} from '@pos-mandob/shared';
import {
  useAddToEasyfyCart,
  useEasyfyProductDetail,
  useUploadEasyfyCartArtwork,
} from '../../../hooks/useEasyfyShop';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../utils/cn';
import { STOCK_MODE_META } from '../../components/admin/easyfy/easyfyUiMeta';
import { ShopTopBar } from '../../components/shop/ShopTopBar';
import { Badge, Button, Card, EmptyState, Textarea } from '../../components/ui';

function resolveTierPrice(variant: EasyfyProductVariant, qty: number): number {
  const tiers = [...(variant.price_tiers ?? [])].sort((a, b) => b.min_qty - a.min_qty);
  const matched = tiers.find((t) => qty >= t.min_qty);
  return matched ? Number(matched.unit_price) : Number(variant.selling_price);
}

export const ShopProductDetailPage: React.FC = () => {
  const { slugOrId } = useParams<{ slugOrId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: product, isLoading, isError } = useEasyfyProductDetail(slugOrId);
  const addToCartMutation = useAddToEasyfyCart();
  const uploadArtworkMutation = useUploadEasyfyCartArtwork();

  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [customNote, setCustomNote] = useState<string>('');
  const [artworkFile, setArtworkFile] = useState<File | null>(null);

  const variants = useMemo(
    () => (product?.variants ?? []).filter((v) => v.is_active),
    [product]
  );

  const activeVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? variants[0] ?? null,
    [variants, selectedVariantId]
  );

  useEffect(() => {
    if (!product) return;
    const first = (product.variants ?? []).find((v) => v.is_active) ?? product.variants?.[0];
    if (first) {
      setSelectedVariantId(first.id);
      setQuantity(Math.max(1, Number(first.min_order_qty || product.min_order_qty || 1)));
    }
    setSelectedImageIdx(0);
  }, [product]);

  const handleSelectVariant = (v: EasyfyProductVariant) => {
    setSelectedVariantId(v.id);
    const minQ = Math.max(1, Number(v.min_order_qty || product?.min_order_qty || 1));
    setQuantity((q) => Math.max(minQ, q));
  };

  if (isLoading) {
    return (
      <div className="space-y-5" dir="rtl">
        <ShopTopBar />
        <div className="h-96 rounded-2xl bg-surface-2 animate-pulse" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="space-y-5" dir="rtl">
        <ShopTopBar />
        <EmptyState
          icon={<Package className="w-9 h-9 text-muted" />}
          title="المنتج غير متوفر حالياً"
          description="ربما تم إيقاف هذا الصنف أو نقله."
          action={
            <Button size="sm" onClick={() => navigate('/shop')}>
              العودة للكتالوج
            </Button>
          }
        />
      </div>
    );
  }

  const images = product.images ?? [];
  const activeImage = images[selectedImageIdx]?.image_path ?? images[0]?.image_path ?? null;
  const modeMeta = STOCK_MODE_META[product.stock_mode] ?? {
    label: String(product.stock_mode),
    tone: 'neutral' as const,
  };

  const isTracked = product.stock_mode === EasyfyStockMode.TRACKED;
  const minQty = Math.max(1, Number(activeVariant?.min_order_qty || product.min_order_qty || 1));
  const maxQty = isTracked ? Math.max(0, Number(activeVariant?.stock_quantity ?? 0)) : 100000;
  const outOfStock = !activeVariant || (isTracked && maxQty < minQty);

  const unitPrice = activeVariant ? resolveTierPrice(activeVariant, quantity) : 0;
  const lineTotal = unitPrice * quantity;
  const sortedTiers = [...(activeVariant?.price_tiers ?? [])].sort((a, b) => a.min_qty - b.min_qty);

  const handleAdd = async (goToCart: boolean) => {
    if (!activeVariant || outOfStock) return;
    try {
      const updatedCart = await addToCartMutation.mutateAsync({
        variant_id: activeVariant.id,
        quantity,
        custom_note: customNote.trim() || null,
      });
      if (artworkFile && product.allow_artwork_upload) {
        const addedItem = updatedCart.items.find((it) => it.variant_id === activeVariant.id);
        if (addedItem) {
          await uploadArtworkMutation.mutateAsync({ itemId: addedItem.id, file: artworkFile });
        }
      }
      toast.success('تمت إضافة الصنف إلى سلة المشتريات بنجاح.');
      setArtworkFile(null);
      if (goToCart) navigate('/shop/cart');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر إضافة الصنف إلى السلة');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <ShopTopBar />

      <Link
        to="/shop"
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-muted hover:text-brand-ink transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        <span>العودة إلى الكتالوج</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Image Gallery */}
        <Card className="p-4 lg:col-span-5 space-y-3">
          <div className="aspect-square rounded-xl bg-surface-2 overflow-hidden border border-line flex items-center justify-center">
            {activeImage ? (
              <img src={activeImage} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-16 h-16 text-muted opacity-40" />
            )}
          </div>
          {images.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  className={cn(
                    'w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all',
                    selectedImageIdx === idx ? 'border-brand' : 'border-line opacity-75 hover:opacity-100'
                  )}
                >
                  <img src={img.image_path} alt={product.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Product Info, Variants & Wholesale Tiers */}
        <Card className="p-5 sm:p-6 lg:col-span-7 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {product.category && <Badge tone="neutral">{product.category.name}</Badge>}
              <Badge tone={modeMeta.tone}>{modeMeta.label}</Badge>
              {product.lead_time_days && (
                <Badge tone="info">
                  <Clock className="w-3 h-3" />
                  <span>التجهيز خلال {product.lead_time_days} أيام</span>
                </Badge>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-ink">{product.name}</h1>
            {product.short_description && (
              <p className="text-sm text-muted">{product.short_description}</p>
            )}
          </div>

          {/* Live Price Display */}
          {activeVariant && (
            <div className="p-4 rounded-xl bg-canvas border border-line flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-bold text-muted">سعر الوحدة حسب الكمية المحددة:</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black text-brand tabular-nums">
                    {formatCurrency(unitPrice)}
                  </span>
                  {activeVariant.compare_at_price && activeVariant.compare_at_price > unitPrice && (
                    <span className="text-sm text-muted line-through tabular-nums">
                      {formatCurrency(activeVariant.compare_at_price)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-muted">إجمالي البند ({quantity} وحدة)</p>
                <p className="text-lg font-black text-ink tabular-nums">{formatCurrency(lineTotal)}</p>
              </div>
            </div>
          )}

          {/* Variants Selector */}
          <div className="space-y-2.5">
            <p className="text-xs font-black text-ink">اختر المقاس / الباكيت:</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => {
                const isSelected = activeVariant?.id === v.id;
                const vDisabled = isTracked && v.stock_quantity < Math.max(1, v.min_order_qty || minQty);
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={vDisabled}
                    onClick={() => handleSelectVariant(v)}
                    className={cn(
                      'px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all text-right',
                      isSelected
                        ? 'bg-brand text-on-brand border-brand shadow-xs'
                        : 'bg-panel text-ink border-line hover:border-brand/50',
                      vDisabled && 'opacity-45 cursor-not-allowed line-through'
                    )}
                  >
                    <span>{v.label}</span>
                    <span className={cn('mr-2 tabular-nums', isSelected ? 'text-on-brand/90' : 'text-muted')}>
                      ({formatCurrency(v.selling_price)})
                    </span>
                  </button>
                );
              })}
            </div>
            {activeVariant && isTracked && (
              <p className="text-xs text-muted font-bold">
                المتوفر بالمخزون: <span className="text-ink">{activeVariant.stock_quantity}</span>
                {activeVariant.sku ? ` • SKU: ${activeVariant.sku}` : ''}
              </p>
            )}
          </div>

          {/* Wholesale Price Tiers Table */}
          {sortedTiers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black text-ok">خصومات الجملة التلقائية حسب الكمية:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sortedTiers.map((tier, idx) => {
                  const isActiveTier = unitPrice === Number(tier.unit_price) && quantity >= tier.min_qty;
                  return (
                    <div
                      key={tier.id ?? idx}
                      className={cn(
                        'p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2',
                        isActiveTier
                          ? 'bg-ok-soft border-ok/40 text-ok font-black'
                          : 'bg-canvas border-line text-ink font-bold'
                      )}
                    >
                      <span>{tier.min_qty}+ قطعة</span>
                      <span className="tabular-nums">{formatCurrency(tier.unit_price)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Note & Logo Artwork for MADE_TO_ORDER */}
          {product.allow_custom_note && (
            <Textarea
              label={product.custom_note_label || 'مواصفات الطباعة / المقاس المطلوب'}
              placeholder="اكتب ملاحظات اللون، اسم المتجر على الشنطة، أو أي تفاصيل إضافية..."
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
            />
          )}

          {product.allow_artwork_upload && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-ink">رفع اللوجو أو التصميم للطباعة (اختياري):</p>
              <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-dashed border-line-2 bg-canvas hover:border-brand cursor-pointer transition-colors">
                <span className="text-xs font-bold text-ink flex items-center gap-2 truncate">
                  {artworkFile ? (
                    <>
                      <Check className="w-4 h-4 text-ok shrink-0" />
                      <span className="truncate">{artworkFile.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-brand shrink-0" />
                      <span>اختر ملف صورة (PNG / JPG / WEBP) أو PDF</span>
                    </>
                  )}
                </span>
                <span className="text-[11px] text-muted shrink-0">حتى 10MB</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => setArtworkFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          {/* Quantity Stepper & Actions */}
          <div className="pt-3 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="inline-flex items-center border border-line rounded-xl bg-canvas self-start">
              <button
                type="button"
                disabled={quantity <= minQty}
                onClick={() => setQuantity((q) => Math.max(minQty, q - 1))}
                className="w-11 h-11 flex items-center justify-center text-ink hover:bg-surface-2 rounded-r-xl disabled:opacity-40"
                aria-label="إنقاص الكمية"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min={minQty}
                max={maxQty}
                value={quantity}
                onChange={(e) => {
                  const val = Math.max(minQty, Number(e.target.value || minQty));
                  setQuantity(isTracked ? Math.min(maxQty, val) : val);
                }}
                className="w-16 text-center bg-transparent font-black text-sm text-ink outline-none tabular-nums"
              />
              <button
                type="button"
                disabled={isTracked && quantity >= maxQty}
                onClick={() => setQuantity((q) => (isTracked ? Math.min(maxQty, q + 1) : q + 1))}
                className="w-11 h-11 flex items-center justify-center text-ink hover:bg-surface-2 rounded-l-xl disabled:opacity-40"
                aria-label="زيادة الكمية"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <Button
                className="flex-1"
                disabled={outOfStock}
                isLoading={addToCartMutation.isPending || uploadArtworkMutation.isPending}
                onClick={() => handleAdd(false)}
                leftIcon={<ShoppingCart className="w-4 h-4" />}
              >
                {outOfStock ? 'غير متوفر حالياً' : 'إضافة إلى السلة'}
              </Button>
              <Button
                variant="secondary"
                disabled={outOfStock}
                isLoading={addToCartMutation.isPending || uploadArtworkMutation.isPending}
                onClick={() => handleAdd(true)}
              >
                أضف وانتقل للسلة
              </Button>
            </div>
          </div>

          {product.description && (
            <div className="pt-4 border-t border-line space-y-1.5">
              <h2 className="text-xs font-black text-ink">وصف ومواصفات إضافية</h2>
              <p className="text-xs sm:text-sm text-muted whitespace-pre-line leading-relaxed">
                {product.description}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
