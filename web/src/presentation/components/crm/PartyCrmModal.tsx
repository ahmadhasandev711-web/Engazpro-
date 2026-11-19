import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  FileText,
  AlertTriangle,
  CalendarClock,
  Crown,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CustomerInteractionChannel,
  CustomerTier,
  formatCurrency,
  Party,
} from '@pos-mandob/shared';
import { usePartyCrm, usePartyCrmMutations } from '../../../hooks/usePartyCrm';
import { usePermissions } from '../../../hooks/usePermissions';
import { nativeBackButton } from '../../../platform/nativeBackButton';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Select, Textarea, Input } from '../ui';
import { CustomerRiskBadge } from './CustomerRiskBadge';

interface PartyCrmModalProps {
  partyId: number | null;
  initialParty?: Partial<Party> | null;
  onClose: () => void;
}

const CHANNEL_OPTIONS = [
  { value: CustomerInteractionChannel.CALL, label: 'مكالمة هاتفية' },
  { value: CustomerInteractionChannel.WHATSAPP, label: 'رسالة واتساب' },
  { value: CustomerInteractionChannel.FOLLOW_UP, label: 'موعد متابعة' },
  { value: CustomerInteractionChannel.COMPLAINT, label: 'شكوى أو ملاحظة توصيل' },
  { value: CustomerInteractionChannel.NOTE, label: 'ملاحظة داخلية' },
];

export const PartyCrmModal: React.FC<PartyCrmModalProps> = ({
  partyId,
  initialParty,
  onClose,
}) => {
  const toast = useToast();
  const { canManageCustomerTier } = usePermissions();
  const { data, isLoading } = usePartyCrm(partyId, Boolean(partyId));
  const { addInteraction, deleteInteraction, updateTier } = usePartyCrmMutations(partyId);

  const [channel, setChannel] = useState<CustomerInteractionChannel>(CustomerInteractionChannel.CALL);
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');

  useEffect(() => {
    if (!partyId) return;
    return nativeBackButton.register(() => {
      onClose();
      return true;
    });
  }, [partyId, onClose]);

  if (!partyId) return null;

  const party = data?.party || initialParty;
  const metrics = data?.party?.crm_metrics || initialParty?.crm_metrics;
  const interactions = data?.interactions || [];
  const canManageTier = canManageCustomerTier;

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;
    try {
      await addInteraction.mutateAsync({
        channel,
        notes: notes.trim(),
        follow_up_at: followUpAt || null,
      });
      setNotes('');
      setFollowUpAt('');
      toast.success('تم حفظ التفاعل في سجل العميل');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'تعذر حفظ التفاعل');
    }
  };

  const handleTierChange = async (tier: CustomerTier | null) => {
    try {
      await updateTier.mutateAsync(tier);
      toast.success(tier ? 'تم تحديث تصنيف العميل يدوياً' : 'تمت العودة للتصنيف التلقائي');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'تعذر تحديث التصنيف');
    }
  };

  const channelIcon = (ch: CustomerInteractionChannel) => {
    switch (ch) {
      case CustomerInteractionChannel.CALL:
        return <Phone className="w-3.5 h-3.5 text-brand" />;
      case CustomerInteractionChannel.WHATSAPP:
        return <MessageSquare className="w-3.5 h-3.5 text-ok" />;
      case CustomerInteractionChannel.COMPLAINT:
        return <AlertTriangle className="w-3.5 h-3.5 text-bad" />;
      case CustomerInteractionChannel.FOLLOW_UP:
        return <CalendarClock className="w-3.5 h-3.5 text-warn" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-muted" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
      dir="rtl"
    >
      <div className="bg-panel text-ink border border-line rounded-t-[2.5rem] sm:rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
        <div className="w-12 h-1.5 bg-line-2 rounded-full mx-auto sm:hidden shrink-0" />

        <div className="flex items-start justify-between gap-3 border-b border-line pb-3 shrink-0">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base sm:text-lg font-black text-ink truncate">
              ملف العميل وCRM: {party?.name || 'عميل'}
            </h3>
            <CustomerRiskBadge metrics={metrics} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted hover:text-ink rounded-xl hover:bg-surface-2 cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-4 flex-1 pr-0.5">
          <CustomerRiskBadge metrics={metrics} variant="banner" />

          {metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-surface-2 rounded-2xl border border-line text-center">
                <p className="text-2xs text-muted font-bold">طلبات ناجحة</p>
                <p className="text-base font-black text-ok tabular-nums">{metrics.delivered_orders_count}</p>
              </div>
              <div className="p-3 bg-surface-2 rounded-2xl border border-line text-center">
                <p className="text-2xs text-muted font-bold">ملغاة / مرتجعة</p>
                <p className="text-base font-black text-bad tabular-nums">{metrics.cancelled_or_returned_count}</p>
              </div>
              <div className="p-3 bg-surface-2 rounded-2xl border border-line text-center">
                <p className="text-2xs text-muted font-bold">نسبة الإلغاء</p>
                <p className="text-base font-black text-ink tabular-nums">{metrics.cancellation_rate}%</p>
              </div>
              <div className="p-3 bg-surface-2 rounded-2xl border border-line text-center">
                <p className="text-2xs text-muted font-bold">إجمالي المشتريات</p>
                <p className="text-sm font-black text-brand tabular-nums" dir="ltr">
                  {formatCurrency(metrics.total_spent)}
                </p>
              </div>
            </div>
          )}

          {canManageTier && (
            <div className="p-3 bg-surface-2/60 border border-line rounded-2xl flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-ink">تصنيف العميل اليدوي:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant={party?.crm_tier_override === CustomerTier.VIP ? 'primary' : 'secondary'}
                  onClick={() => handleTierChange(CustomerTier.VIP)}
                  disabled={updateTier.isPending}
                  leftIcon={<Crown className="w-3.5 h-3.5" />}
                  className="text-xs font-bold"
                >
                  تثبيت VIP
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={party?.crm_tier_override === CustomerTier.BLACKLISTED ? 'danger' : 'secondary'}
                  onClick={() => handleTierChange(CustomerTier.BLACKLISTED)}
                  disabled={updateTier.isPending}
                  leftIcon={<ShieldAlert className="w-3.5 h-3.5" />}
                  className="text-xs font-bold"
                >
                  حظر العميل
                </Button>
                {party?.crm_tier_override && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTierChange(null)}
                    disabled={updateTier.isPending}
                    leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                    className="text-xs font-bold text-brand"
                  >
                    إرجاع تلقائي
                  </Button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleAddInteraction} className="p-3.5 bg-surface-2/50 border border-line rounded-2xl space-y-3">
            <h4 className="text-xs font-black text-ink">تسجيل تفاعل أو ملاحظة متابعة جديدة</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="نوع التفاعل"
                value={channel}
                onChange={(e) => setChannel(e.target.value as CustomerInteractionChannel)}
                options={CHANNEL_OPTIONS}
                className="text-xs font-bold"
              />
              <Input
                label="موعد متابعة قادم (اختياري)"
                type="datetime-local"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
                dir="ltr"
              />
            </div>
            <Textarea
              label="تفاصيل المكالمة أو الملاحظة"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: طلب العميل التأكيد قبل الشحن بيوم، أو يفضل التوصيل مساءً..."
              required
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={addInteraction.isPending}
                disabled={addInteraction.isPending || !notes.trim()}
                className="font-bold text-xs"
              >
                حفظ في سجل CRM
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            <h4 className="text-xs font-black text-ink">سجل التفاعلات والملاحظات ({interactions.length})</h4>
            {isLoading ? (
              <p className="text-xs text-muted py-4 text-center">جاري تحميل السجل...</p>
            ) : interactions.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center bg-surface-2/40 rounded-2xl border border-line">
                لا توجد تفاعلات مسجلة لهذا العميل حتى الآن.
              </p>
            ) : (
              <div className="space-y-2">
                {interactions.map((item) => (
                  <div key={item.id} className="p-3 bg-panel border border-line rounded-2xl flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone="neutral" className="text-2xs inline-flex items-center gap-1 font-bold">
                          {channelIcon(item.channel)}
                          <span>{item.channel_label}</span>
                        </Badge>
                        {item.creator_name && (
                          <span className="text-2xs text-muted font-bold">بواسطة: {item.creator_name}</span>
                        )}
                        <span className="text-2xs text-muted tabular-nums" dir="ltr">
                          {new Date(item.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>
                      <p className="text-xs text-ink font-medium leading-relaxed whitespace-pre-line">{item.notes}</p>
                      {item.follow_up_at && (
                        <p className="text-2xs text-warn font-bold inline-flex items-center gap-1 tabular-nums">
                          <CalendarClock className="w-3 h-3" />
                          <span>متابعة: {new Date(item.follow_up_at).toLocaleString('ar-EG')}</span>
                        </p>
                      )}
                    </div>
                    {canManageTier && (
                      <button
                        type="button"
                        onClick={() => deleteInteraction.mutate(item.id)}
                        className="p-1.5 text-muted hover:text-bad rounded-lg cursor-pointer shrink-0"
                        title="حذف السجل"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
