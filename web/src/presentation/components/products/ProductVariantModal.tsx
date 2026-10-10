import React, { useState, useEffect, useMemo } from 'react';
import { X, Layers, Calendar, Check, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black flex-shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="text-base font-black text-slate-900 truncate">{product.name}</h3>
              <p className="text-xs text-slate-400 font-mono">
                كود: {product.code || '—'} {product.barcode ? `| باركود: ${product.barcode}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Multi-Unit Toggle (Base Unit vs Sub-Unit) */}
          {hasSubUnit && (
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block">وحدة البيع المطلوبة:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUseSubUnit(false)}
                  className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                    !useSubUnit
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-black text-slate-900">{product.unit || 'قطعة'} (أساسية)</span>
                    {!useSubUnit && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <span className="text-sm font-black text-indigo-600 font-mono">
                    {formatCurrency(Number(product.sale_price || 0))}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setUseSubUnit(true)}
                  className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                    useSubUnit
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-black text-slate-900">
                      {product.sub_unit} ({product.sub_unit_factor} {product.unit || 'قطعة'})
                    </span>
                    {useSubUnit && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <span className="text-sm font-black text-indigo-600 font-mono">
                    {formatCurrency(Number(product.sub_unit_price || 0))}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Variants Grid (Clothing / Shoes) */}
          {hasVariants && (
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block">
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
                      className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-slate-800 truncate">{v.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono font-bold text-indigo-600">
                          {formatCurrency(
                            Number(
                              mode === 'purchase'
                                ? (v.purchase_price ?? product.purchase_price ?? 0)
                                : (v.sale_price || product.sale_price || 0)
                            )
                          )}
                        </span>
                        <span className={`font-mono font-bold ${mode === 'purchase' ? 'text-slate-600' : isAvailable ? 'text-slate-600' : 'text-rose-500'}`}>
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
              <label className="text-xs font-black text-slate-700 block">
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
                      className={`w-full p-3 rounded-2xl border text-right transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800">
                              تشغيلة: {b.batch_number}
                            </span>
                            {isExpired && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold">
                                منتهي
                              </span>
                            )}
                            {isNear && !isExpired && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 font-bold">
                                قريب الانتهاء
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            انتهاء: {b.expiry_date} | رصيد: {b.quantity}
                          </span>
                        </div>
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Controls */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black text-slate-700">الكمية المطلوبة:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-black text-slate-700 text-sm shadow-xs"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-14 text-center font-mono font-black text-sm bg-white border border-slate-200 rounded-xl py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-black text-slate-700 text-sm shadow-xs"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">الإجمالي:</span>
            <span className="text-lg font-black text-slate-900 font-mono">
              {formatCurrency(effectiveUnitPrice * quantity)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{mode === 'purchase' ? 'إضافة للفاتورة' : 'إضافة للسلة'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
