import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Building2, CheckCircle2, RefreshCw, X } from 'lucide-react';
import {
  useOrderBranchAvailability,
  useTransferOnlineOrderBranch,
} from '../../../hooks/useBranchAvailability';
import { nativeBackButton } from '../../../platform/nativeBackButton';
import { Badge, Button, Input } from '../ui';
import { getOrderDisplayRef } from './helpers';

interface TransferOrderBranchModalProps {
  order: any | null;
  orderQueryKey?: string;
  onClose: () => void;
  onTransferred?: (updatedOrder: any, message: string) => void;
}

/**
 * Allows Supervisor / Manager / Owner to re-route an online order to another fixed branch/warehouse
 * with automatic multi-branch stock evaluation and zero owner bottleneck.
 */
export const TransferOrderBranchModal: React.FC<TransferOrderBranchModalProps> = ({
  order,
  orderQueryKey = 'online-orders',
  onClose,
  onTransferred,
}) => {
  const { data, isLoading } = useOrderBranchAvailability(order?.id ?? null);
  const transferMutation = useTransferOnlineOrderBranch(orderQueryKey);
  const [targetBranchId, setTargetBranchId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setTargetBranchId(null);
    setReason('');
    setErrorMsg(null);
  }, [order?.id]);

  useEffect(() => {
    if (!order) return undefined;
    return nativeBackButton.register(() => {
      onClose();
      return true;
    });
  }, [order, onClose]);

  if (!order) return null;

  const candidateBranches = (data?.branches || []).filter((b) => !b.is_current);

  const handleConfirmTransfer = async () => {
    if (!targetBranchId) return;
    setErrorMsg(null);
    try {
      const res = await transferMutation.mutateAsync({
        orderId: order.id,
        targetBranchId,
        reason: reason.trim() || undefined,
      });
      if (onTransferred) {
        onTransferred(res?.data, res?.message || 'تم تحويل الطلب إلى الفرع المختار بنجاح');
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'تعذر تحويل الطلب إلى الفرع المختار');
    }
  };

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
        className="bg-panel border border-line rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        <div className="w-12 h-1.5 bg-line rounded-full mx-auto mb-1 sm:hidden shrink-0" />

        <div className="flex items-center justify-between border-b border-line pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-ink tabular-nums">
                تحويل الطلب {getOrderDisplayRef(order)} لفرع آخر
              </h3>
              <p className="text-2xs text-muted">
                سينتقل الطلب بحالة &quot;بانتظار التأكيد&quot; ليقبله ويجهزه الفرع المستلم مباشرة.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-muted hover:text-ink rounded-xl hover:bg-surface-2 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-bad-soft border border-bad/25 text-bad text-xs font-bold flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5">
          <div className="text-xs font-black text-ink">اختر الفرع أو المخزن الثابت المستلم:</div>

          {isLoading ? (
            <div className="py-10 text-center text-xs font-bold text-muted flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand" />
              <span>جاري فحص توافر أصناف الطلب في باقي الفروع...</span>
            </div>
          ) : candidateBranches.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-muted border border-line rounded-2xl bg-surface-2/50">
              لا توجد فروع أو مخازن ثابتة أخرى متاحة للتحويل.
            </div>
          ) : (
            candidateBranches.map((branch) => {
              const selected = targetBranchId === branch.id;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => setTargetBranchId(branch.id)}
                  className={`w-full text-right p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    selected
                      ? 'bg-brand-soft border-brand ring-2 ring-brand/15'
                      : 'bg-surface-2/60 border-line hover:border-line-2'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-4 h-4 ${selected ? 'text-brand' : 'text-muted'}`} />
                      <span className="font-black text-xs sm:text-sm text-ink">{branch.name}</span>
                      <Badge tone="neutral">{branch.type_label}</Badge>
                    </div>

                    {branch.can_fulfill_all ? (
                      <Badge tone="ok" className="font-black">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>متوفر بالكامل</span>
                      </Badge>
                    ) : (
                      <Badge tone="warn" className="font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>نقص في بعض الأصناف</span>
                      </Badge>
                    )}
                  </div>

                  {!branch.can_fulfill_all && branch.shortages.length > 0 && (
                    <div className="text-2xs text-warn font-semibold space-y-0.5 pr-6">
                      {branch.shortages.map((s) => (
                        <div key={s}>• {s}</div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <Input
          label="سبب التحويل (اختياري):"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="مثال: نفاد مقاس XL في فرعنا الحالي وتوفره بالفرع المستلم..."
        />

        <div className="flex items-center gap-2 pt-1 shrink-0">
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!targetBranchId || transferMutation.isPending}
            isLoading={transferMutation.isPending}
            onClick={handleConfirmTransfer}
            className="flex-1 min-h-[44px] font-black text-xs"
          >
            تأكيد تحويل الطلب
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onClose}
            className="min-h-[44px] font-bold text-xs"
          >
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  );
};
