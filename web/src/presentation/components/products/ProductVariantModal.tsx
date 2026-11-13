import React, { useState, useEffect, useMemo } from 'react';
import { X, Layers, Calendar, Check, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

export interface VariantSelectionPayload {
  product: any;
  variant?: any;
  batch?: any;
  unit_name?: string;
  is_sub_unit?: boolean;
  unit_price: number;
  quantity: number;
}

interface ProductVariantModalProps {
  product: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (payload: VariantSelectionPayload) => void;
  mode?: 'sale' | 'purchase';
}

export const ProductVariantModal: React.FC<ProductVariantModalProps> = ({
  product,
  isOpen,
  onClose,
  onSelect,
  mode = 'sale',
}) => {
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [useSubUnit, setUseSubUnit] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<number>(1);

  const hasVariants = Boolean(product?.has_variants || product?.variants?.length);
  const hasExpiry = Boolean(product?.has_expiry || product?.batches?.length);
  const hasSubUnit = Boolean(product?.sub_unit && product?.sub_unit_factor && Number(product?.sub_unit_factor) > 0);

  // Initialize defaults on product open
  useEffect(() => {
    if (product) {
      if (product.variants?.length > 0) {
        setSelectedVariantId(product.variants[0].id);
      } else {
        setSelectedVariantId(null);
      }

      if (product.batches?.length > 0) {
        // Auto-select the earliest non-expired batch with quantity > 0
        const sortedBatches = [...product.batches]
          .filter((b: any) => Number(b.quantity) > 0)
          .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

        if (sortedBatches.length > 0) {
          setSelectedBatchId(sortedBatches[0].id);
        } else {
          setSelectedBatchId(product.batches[0].id);
        }
      } else {
        setSelectedBatchId(null);
      }

      setUseSubUnit(false);
      setQuantity(1);
    }
  }, [product]);

  const selectedVariant = useMemo(() => {
    if (!product?.variants) return null;
    return product.variants.find((v: any) => v.id === selectedVariantId) || null;
  }, [product, selectedVariantId]);

  const selectedBatch = useMemo(() => {
    if (!product?.batches) return null;
    return product.batches.find((b: any) => b.id === selectedBatchId) || null;
  }, [product, selectedBatchId]);

  // Calculate effective unit price based on sub-unit or variant/batch
  const effectiveUnitPrice = useMemo(() => {
    if (!product) return 0;
    if (mode === 'purchase') {
      if (useSubUnit && product.sub_unit_factor && Number(product.sub_unit_factor) > 0) {
        const baseCost = Number(product.purchase_price || 0);
        return baseCost / Number(product.sub_unit_factor);
      }
      if (selectedVariant?.purchase_price !== undefined && selectedVariant?.purchase_price !== null && Number(selectedVariant.purchase_price) > 0) {
        return Number(selectedVariant.purchase_price);
      }
      return Number(product.purchase_price || 0);
    }
    if (useSubUnit && product.sub_unit_price) {
      return Number(product.sub_unit_price);
    }
    if (selectedVariant?.sale_price) {
      return Number(selectedVariant.sale_price);
    }
    return Number(product.sale_price || 0);
  }, [product, useSubUnit, selectedVariant, selectedBatch, mode]);

  if (!isOpen || !product) return null;

  const handleConfirm = () => {
    onSelect({
      product,
      variant: selectedVariant || undefined,
      batch: selectedBatch || undefined,
      unit_name: useSubUnit ? product.sub_unit : product.unit || 'قطعة',
      is_sub_unit: useSubUnit,
      unit_price: effectiveUnitPrice,
      quantity: Math.max(1, quantity),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div className="bg-panel rounded-3xl border border-line shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between bg-surface-2/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-brand-soft text-brand flex items-center justify-center font-black flex-shrink-0 border border-brand/20">
              <Layers className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="text-base font-black text-ink truncate">{product.name}</h3>
              <p className="text-xs text-muted tabular-nums">
                كود: {product.code || '—'} {product.barcode ? `| باركود: ${product.barcode}` : ''}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            className="min-w-[44px] px-0 text-muted hover:text-ink"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Multi-Unit Toggle (Base Unit vs Sub-Unit) */}
          {hasSubUnit && (
            <div className="space-y-2">
              <label className="text-xs font-black text-ink block">وحدة البيع المطلوبة:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUseSubUnit(false)}
                  className={cn(
                    'min-h-[44px] p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer',
                    !useSubUnit
                      ? 'border-brand bg-brand-soft ring-2 ring-brand/20'
                      : 'border-line bg-panel hover:border-line-2'
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-black text-ink">{product.unit || 'قطعة'} (أساسية)</span>
                    {!useSubUnit && <Check className="w-4 h-4 text-brand" />}
                  </div>
                  <span className="text-sm font-black text-brand-ink tabular-nums">
                    {formatCurrency(Number(product.sale_price || 0))}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setUseSubUnit(true)}
                  className={cn(
                    'min-h-[44px] p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer',
                    useSubUnit
                      ? 'border-brand bg-brand-soft ring-2 ring-brand/20'
                      : 'border-line bg-panel hover:border-line-2'
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-black text-ink">
                      {product.sub_unit} ({product.sub_unit_factor} {product.unit || 'قطعة'})
                    </span>
                    {useSubUnit && <Check className="w-4 h-4 text-brand" />}
                  </div>
                  <span className="text-sm font-black text-brand-ink tabular-nums">
                    {formatCurrency(Number(product.sub_unit_price || 0))}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Variants Grid (Clothing / Shoes) */}
          {hasVariants && (
            <div className="space-y-2">
              <label className="text-xs font-black text-ink block">
                اختر المقاس أو اللون ({product.variants?.length} متغير):
              </label>
              <div className="grid grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {product.variants?.map((v: any) => {
                  const isSelected = v.id === selectedVariantId;
                  const isAvailable = Number(v.quantity) > 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={cn(
                        'min-h-[44px] p-3 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer',
                        isSelected
                          ? 'border-brand bg-brand-soft ring-2 ring-brand/20'
                          : 'border-line bg-panel hover:border-line-2'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-ink truncate">{v.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-brand flex-shrink-0" />}
                      </div>

                      <div className="flex items-center justify-between text-2xs text-muted">
                        <span className="tabular-nums font-bold text-brand-ink">
                          {formatCurrency(
                            Number(
                              mode === 'purchase'
                                ? (v.purchase_price ?? product.purchase_price ?? 0)
                                : (v.sale_price || product.sale_price || 0)
                            )
                          )}
                        </span>
                        <span className={cn('tabular-nums font-bold', mode === 'purchase' || isAvailable ? 'text-muted' : 'text-bad')}>
                          {mode === 'purchase' ? `الرصيد: ${v.quantity}` : isAvailable ? `${v.quantity} متاح` : 'نفد'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Batches & Expiry Dates */}
          {hasExpiry && product.batches?.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-black text-ink block">
                تشغيلات الصلاحية المتوفرة (FEFO):
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {product.batches?.map((b: any) => {
                  const isSelected = b.id === selectedBatchId;
                  const isExpired = b.is_expired;
                  const isNear = b.is_near_expiry;

                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBatchId(b.id)}
                      className={cn(
                        'w-full min-h-[44px] p-3 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer',
                        isSelected
                          ? 'border-ok bg-ok-soft ring-2 ring-ok/20'
                          : 'border-line bg-panel hover:border-line-2'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-muted" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-ink">
                              تشغيلة: {b.batch_number}
                            </span>
                            {isExpired && (
                              <Badge tone="bad" className="text-2xs rounded-md px-1.5 py-0.5">
                                منتهي
                              </Badge>
                            )}
                            {isNear && !isExpired && (
                              <Badge tone="warn" className="text-2xs rounded-md px-1.5 py-0.5">
                                قريب الانتهاء
                              </Badge>
                            )}
                          </div>
                          <span className="text-2xs text-muted tabular-nums">
                            انتهاء: {b.expiry_date} | رصيد: {b.quantity}
                          </span>
                        </div>
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-ok" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Controls */}
          <div className="p-4 bg-surface-2 rounded-2xl border border-line flex items-center justify-between">
            <span className="text-xs font-black text-ink">الكمية المطلوبة:</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="min-w-[44px] px-0 bg-panel font-black text-sm"
              >
                -
              </Button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-16 min-h-[44px] text-center tabular-nums font-black text-sm bg-panel text-ink border border-line rounded-xl py-1 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setQuantity((q) => q + 1)}
                className="min-w-[44px] px-0 bg-panel font-black text-sm"
              >
                +
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-line bg-surface-2/60 flex items-center justify-between gap-3">
          <div>
            <span className="text-2xs text-muted font-medium block">الإجمالي:</span>
            <span className="text-lg font-black text-ink tabular-nums">
              {formatCurrency(effectiveUnitPrice * quantity)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleConfirm}
              leftIcon={<ShoppingCart className="w-4 h-4" />}
              className="text-xs font-black"
            >
              {mode === 'purchase' ? 'إضافة للفاتورة' : 'إضافة للسلة'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
