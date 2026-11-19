import React, { useEffect } from 'react';
import { Building2, CheckCircle2, Layers, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { useProductBranchAvailability } from '../../../hooks/useBranchAvailability';
import { nativeBackButton } from '../../../platform/nativeBackButton';
import { Badge, Button } from '../ui';

interface ProductBranchAvailabilityModalProps {
  productId: number | null;
  productName?: string;
  onClose: () => void;
}

/**
 * Shared read-only modal displaying live available stock across fixed branches/warehouses (excluding VANs).
 * Safely shows quantities only (zero purchase cost / financial leakage) across Products & POS screens.
 */
export const ProductBranchAvailabilityModal: React.FC<ProductBranchAvailabilityModalProps> = ({
  productId,
  productName,
  onClose,
}) => {
  const { data, isLoading, isFetching, refetch } = useProductBranchAvailability(productId);

  useEffect(() => {
    if (!productId) return undefined;
    return nativeBackButton.register(() => {
      onClose();
      return true;
    });
  }, [productId, onClose]);

  if (!productId) return null;

  const branches = data?.branches || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-panel border border-line rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        <div className="w-12 h-1.5 bg-line rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        <div className="flex items-center justify-between gap-3 border-b border-line pb-3.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-brand-soft text-brand border border-brand/20 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-ink truncate">
                توافر الصنف في الفروع والمخازن الثابتة
              </h3>
              <p className="text-xs text-muted font-bold truncate">
                {data?.product_name || productName || `صنف #${productId}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="تحديث الأرصدة"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-brand' : ''}`} />
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-muted hover:text-ink rounded-xl hover:bg-surface-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="py-4 overflow-y-auto flex-1 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-xs font-bold text-muted flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand" />
              <span>جاري فحص الأرصدة عبر الفروع...</span>
            </div>
          ) : branches.length === 0 ? (
            <div className="py-10 text-center text-xs font-bold text-muted">
              لا توجد فروع أو مخازن ثابتة نشطة حالياً.
            </div>
          ) : (
            branches.map((branch) => {
              const hasStock = branch.available_quantity > 0;
              return (
                <div
                  key={branch.id}
                  className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                    branch.is_user_branch
                      ? 'bg-brand-soft/45 border-brand/30'
                      : 'bg-surface-2/60 border-line'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-ink">{branch.name}</span>
                      <Badge tone="neutral">{branch.type_label}</Badge>
                      {branch.is_main && <Badge tone="info">رئيسي</Badge>}
                      {branch.is_user_branch && <Badge tone="brand">فرعك الحالي</Badge>}
                    </div>

                    <div className="flex items-center gap-2">
                      {hasStock ? (
                        <Badge tone="ok" className="tabular-nums font-black px-3 py-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>متاح للبيع: {branch.available_quantity}</span>
                        </Badge>
                      ) : (
                        <Badge tone="bad" className="tabular-nums font-bold px-3 py-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>غير متوفر (0)</span>
                        </Badge>
                      )}
                    </div>
                  </div>

                  {branch.reserved_quantity > 0 && (
                    <div className="text-2xs text-muted font-semibold flex items-center gap-3 tabular-nums">
                      <span>الرصيد الفعلي: {branch.physical_quantity}</span>
                      <span>•</span>
                      <span className="text-warn font-bold">
                        محجوز لأوردرات المتجر: {branch.reserved_quantity}
                      </span>
                    </div>
                  )}

                  {data?.has_variants && branch.variants.length > 0 && (
                    <div className="pt-2 border-t border-line/80 space-y-1.5">
                      <div className="text-2xs font-black text-muted flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>تفصيل المقاسات والألوان:</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {branch.variants.map((variant) => (
                          <div
                            key={variant.id}
                            className={`px-2.5 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                              variant.available_quantity > 0
                                ? 'bg-panel border-line text-ink'
                                : 'bg-canvas border-line/60 text-muted opacity-70'
                            }`}
                          >
                            <span className="font-bold truncate">{variant.name}</span>
                            <span
                              className={`font-black tabular-nums shrink-0 ${
                                variant.available_quantity > 0 ? 'text-ok' : 'text-bad'
                              }`}
                            >
                              {variant.available_quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-line flex items-center justify-between gap-3 text-2xs text-muted shrink-0">
          <span>يتم خصم الكميات المحجوزة للأونلاين تلقائياً وعرض الفروع والمخازن الثابتة فقط.</span>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
};
