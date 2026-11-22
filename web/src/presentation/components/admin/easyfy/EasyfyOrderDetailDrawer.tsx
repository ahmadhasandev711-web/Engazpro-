import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  DollarSign,
  MapPin,
  Phone,
  ShieldCheck,
  Store,
  Truck,
  User as UserIcon,
  X,
  XCircle,
} from 'lucide-react';
import {
  EasyfyPaymentMethod,
  EasyfyPaymentStatus,
  formatCurrency,
} from '@pos-mandob/shared';
import {
  useAdminEasyfyOrderDetail,
  useRejectEasyfyPayment,
  useUpdateEasyfyOrderCosts,
  useUpdateEasyfyOrderStatus,
  useVerifyEasyfyPayment,
} from '../../../../hooks/useAdminEasyfy';
import { useToast } from '../../../context/ToastContext';
import { Badge, Button, Card, Input, Select, Textarea } from '../../ui';
import { AuthenticatedMediaPreview } from './AuthenticatedMediaPreview';
import {
  ALLOWED_STATUS_TRANSITIONS,
  ORDER_STATUS_META,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_META,
  STOCK_MODE_META,
} from './easyfyUiMeta';

interface EasyfyOrderDetailDrawerProps {
  orderId: number;
  onClose: () => void;
}

export const EasyfyOrderDetailDrawer: React.FC<EasyfyOrderDetailDrawerProps> = ({
  orderId,
  onClose,
}) => {
  const toast = useToast();
  const { data: order, isLoading } = useAdminEasyfyOrderDetail(orderId);
  const verifyPaymentMutation = useVerifyEasyfyPayment();
  const rejectPaymentMutation = useRejectEasyfyPayment();
  const updateStatusMutation = useUpdateEasyfyOrderStatus();
  const updateCostsMutation = useUpdateEasyfyOrderCosts();

  const [rejectReason, setRejectReason] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [courierName, setCourierName] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  const [costMap, setCostMap] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!order) return;
    const allowed = ALLOWED_STATUS_TRANSITIONS[order.status] ?? [];
    setTargetStatus(allowed[0] ?? '');
    setCourierName(order.courier_name ?? '');
    setTrackingNumber(order.tracking_number ?? '');
    setAdminNotes(order.admin_notes ?? '');
    const initialCosts: Record<number, string> = {};
    (order.items ?? []).forEach((it) => {
      initialCosts[it.id] = String(it.unit_cost ?? 0);
    });
    setCostMap(initialCosts);
  }, [order]);

  const handleVerifyPayment = async () => {
    try {
      await verifyPaymentMutation.mutateAsync({ orderId });
      toast.success('تم تأكيد استلام التحويل المالي بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر تأكيد التحويل');
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectReason.trim()) {
      toast.error('يرجى كتابة سبب رفض إثبات التحويل أولاً.');
      return;
    }
    try {
      await rejectPaymentMutation.mutateAsync({ orderId, reason: rejectReason.trim() });
      setRejectReason('');
      toast.success('تم رفض الإثبات وسيظهر السبب للتاجر لإعادة الرفع.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر رفض الإثبات');
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStatus) return;
    try {
      await updateStatusMutation.mutateAsync({
        orderId,
        status: targetStatus,
        courier_name: courierName || undefined,
        tracking_number: trackingNumber || undefined,
        admin_notes: adminNotes || undefined,
        note: statusNote || undefined,
      });
      setStatusNote('');
      toast.success('تم تحديث حالة الطلب بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر تحديث حالة الطلب');
    }
  };

  const handleSaveCosts = async () => {
    if (!order?.items?.length) return;
    const items = order.items.map((it) => ({
      order_item_id: it.id,
      unit_cost: Math.max(0, Number(costMap[it.id] ?? 0)),
    }));
    try {
      await updateCostsMutation.mutateAsync({ orderId, items });
      toast.success('تم تحديث التكاليف وإعادة حساب صافي الربح بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حفظ التكاليف');
    }
  };

  const statusMeta = order ? ORDER_STATUS_META[order.status] ?? { label: String(order.status), tone: 'neutral' as const } : null;
  const payMeta = order
    ? PAYMENT_STATUS_META[order.payment_verification_status] ?? {
        label: String(order.payment_verification_status),
        tone: 'neutral' as const,
      }
    : null;
  const allowedNext = order ? ALLOWED_STATUS_TRANSITIONS[order.status] ?? [] : [];
  const isTransferOrder =
    order && order.payment_method !== EasyfyPaymentMethod.CASH_ON_DELIVERY;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex justify-end"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-3xl h-full bg-panel border-r border-line shadow-2xl overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-panel border-b border-line px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="font-black text-lg text-ink">
              {order ? `طلب ${order.order_number}` : 'جاري تحميل الطلب...'}
            </h2>
            {statusMeta && <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>}
            {payMeta && <Badge tone={payMeta.tone}>{payMeta.label}</Badge>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-line flex items-center justify-center text-muted hover:text-ink"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading || !order ? (
          <div className="p-6 space-y-4">
            <div className="h-24 rounded-xl bg-surface-2 animate-pulse" />
            <div className="h-44 rounded-xl bg-surface-2 animate-pulse" />
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Dual Identity & Shipping Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 space-y-2 bg-canvas">
                <div className="flex items-center gap-2 text-xs font-extrabold text-brand-ink">
                  <Store className="w-4 h-4" />
                  <span>الهوية المزدوجة للمتجر والعميل</span>
                </div>
                <p className="text-sm font-black text-ink">
                  {order.store_name || 'متجر'} {order.store_code ? `(${order.store_code})` : ''}
                </p>
                <div className="text-xs text-muted space-y-1">
                  <p className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                    <span>المالك: {order.owner_name || '-'} ({order.owner_phone || '-'})</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-info" />
                    <span>
                      منفذ الطلب: {order.ordered_by_name || '-'} ({order.ordered_by_role || '-'}) •{' '}
                      {order.ordered_by_phone || '-'}
                    </span>
                  </p>
                </div>
              </Card>

              <Card className="p-4 space-y-2 bg-canvas">
                <div className="flex items-center gap-2 text-xs font-extrabold text-info">
                  <MapPin className="w-4 h-4" />
                  <span>عنوان التوصيل والمستلم</span>
                </div>
                <p className="text-sm font-black text-ink">{order.recipient_name}</p>
                <p className="text-xs text-muted flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{order.recipient_phone}</span>
                </p>
                <p className="text-xs text-ink">
                  <span className="font-bold">{order.governorate}:</span> {order.shipping_address}
                </p>
                {order.customer_notes && (
                  <p className="text-xs text-warn bg-warn-soft px-2.5 py-1.5 rounded-lg border border-warn/20">
                    ملاحظة العميل: {order.customer_notes}
                  </p>
                )}
              </Card>
            </div>

            {/* Financial Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <Card className="p-3 text-center">
                <p className="text-[11px] text-muted font-bold">المنتجات</p>
                <p className="text-sm font-black text-ink tabular-nums mt-0.5">{formatCurrency(order.subtotal)}</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-[11px] text-muted font-bold">الخصم</p>
                <p className="text-sm font-black text-warn tabular-nums mt-0.5">{formatCurrency(order.discount_amount)}</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-[11px] text-muted font-bold">الشحن</p>
                <p className="text-sm font-black text-ink tabular-nums mt-0.5">{formatCurrency(order.shipping_fee)}</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-[11px] text-muted font-bold">الإجمالي</p>
                <p className="text-sm font-black text-brand tabular-nums mt-0.5">{formatCurrency(order.total_amount)}</p>
              </Card>
              <Card className="p-3 text-center border-ok/30 bg-ok-soft/40 col-span-2 sm:col-span-1">
                <p className="text-[11px] text-ok font-bold">صافي ربحك</p>
                <p className="text-sm font-black text-ok tabular-nums mt-0.5">{formatCurrency(order.gross_profit ?? 0)}</p>
              </Card>
            </div>

            {/* Payment Proof Review Panel */}
            {isTransferOrder && (
              <Card className="p-4 space-y-4 border-brand/20">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-sm font-black text-ink">
                      مراجعة التحويل المالي ({PAYMENT_METHOD_LABEL[order.payment_method] || order.payment_method})
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      الرقم المرجعي: <span className="font-bold text-ink">{order.transfer_reference || 'غير مسجل'}</span>
                    </p>
                  </div>
                  {payMeta && <Badge tone={payMeta.tone}>{payMeta.label}</Badge>}
                </div>

                {order.has_payment_proof ? (
                  <AuthenticatedMediaPreview
                    endpoint={`/admin/easyfy/orders/${order.id}/payment-proof`}
                    alt={`إثبات تحويل ${order.order_number}`}
                  />
                ) : (
                  <p className="text-xs text-bad font-bold">لم يرفع العميل صورة التحويل بعد.</p>
                )}

                {order.payment_rejection_reason && (
                  <p className="text-xs text-bad bg-bad-soft px-3 py-2 rounded-xl border border-bad/20">
                    سبب الرفض السابق: {order.payment_rejection_reason}
                  </p>
                )}

                {order.payment_verification_status !== EasyfyPaymentStatus.VERIFIED && (
                  <div className="pt-2 border-t border-line space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        isLoading={verifyPaymentMutation.isPending}
                        onClick={handleVerifyPayment}
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      >
                        تأكيد استلام التحويل
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                      <Input
                        label="رفض الإثبات مع توضيح السبب للتاجر"
                        placeholder="مثال: الصورة مقطوعة أو الرقم المرجعي غير مطابق"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        isLoading={rejectPaymentMutation.isPending}
                        onClick={handleRejectPayment}
                        leftIcon={<XCircle className="w-4 h-4" />}
                      >
                        رفض الإثبات
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Order Items & Cost/Profit Editor */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-ok" />
                  <h3 className="text-sm font-black text-ink">أصناف الطلب وتكلفة الشراء الفعلي</h3>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  isLoading={updateCostsMutation.isPending}
                  onClick={handleSaveCosts}
                >
                  حفظ التكاليف وحساب الربح
                </Button>
              </div>

              <div className="space-y-3">
                {(order.items ?? []).map((item) => {
                  const modeMeta = STOCK_MODE_META[item.stock_mode] || { label: String(item.stock_mode), tone: 'neutral' as const };
                  const draftCost = Number(costMap[item.id] ?? item.unit_cost ?? 0);
                  const liveLineProfit = item.line_total - draftCost * item.quantity;
                  return (
                    <div key={item.id} className="p-3.5 rounded-xl border border-line bg-canvas space-y-2.5">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-ink">
                            {item.product_name} — <span className="text-brand-ink">{item.variant_label}</span>
                          </p>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted">
                            <Badge tone={modeMeta.tone}>{modeMeta.label}</Badge>
                            {item.sku && <span>SKU: {item.sku}</span>}
                            <span>الكمية: {item.quantity}</span>
                            <span>سعر الوحدة: {formatCurrency(item.unit_price)}</span>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-ink tabular-nums">{formatCurrency(item.line_total)}</p>
                          <p className="text-xs font-bold text-ok tabular-nums">
                            الربح المقدر: {formatCurrency(liveLineProfit)}
                          </p>
                        </div>
                      </div>

                      {item.custom_note && (
                        <p className="text-xs bg-brand-soft text-brand-ink px-3 py-1.5 rounded-lg border border-brand/20">
                          مواصفات الطباعة/الطلب: {item.custom_note}
                        </p>
                      )}

                      {item.has_artwork && (
                        <div className="pt-1">
                          <p className="text-xs font-bold text-muted mb-1">تصميم / لوجو العميل المرفق:</p>
                          <AuthenticatedMediaPreview
                            endpoint={`/admin/easyfy/orders/${order.id}/items/${item.id}/artwork`}
                            alt={`تصميم ${item.product_name}`}
                            compact
                          />
                        </div>
                      )}

                      <div className="max-w-xs">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          label="تكلفة الوحدة الفعلية عليك (ج.م)"
                          value={costMap[item.id] ?? '0'}
                          onChange={(e) =>
                            setCostMap((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Fulfillment & Shipping Transition */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-black text-ink">تحديث حالة التنفيذ والشحن</h3>
              </div>

              {allowedNext.length === 0 ? (
                <p className="text-xs text-muted bg-surface-2 px-3 py-2.5 rounded-xl">
                  هذا الطلب في حالة نهائية ({statusMeta?.label}) ولا يمكن تعديل حالته.
                </p>
              ) : (
                <form onSubmit={handleUpdateStatus} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Select
                      label="الحالة الجديدة"
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value)}
                      options={allowedNext.map((st) => ({
                        value: st,
                        label: ORDER_STATUS_META[st]?.label || st,
                      }))}
                    />
                    <Input
                      label="شركة الشحن"
                      placeholder="أرامكس / بوسطة / مندوب خاص"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                    />
                    <Input
                      label="رقم البوليصة (Tracking)"
                      placeholder="TRK-0001"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="ملاحظة سجل الحالة (تظهر للعميل)"
                      placeholder="تم تسليم الشحنة لشركة الشحن"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                    />
                    <Textarea
                      label="ملاحظات داخلية للإدارة"
                      rows={2}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                    />
                  </div>
                  <Button type="submit" isLoading={updateStatusMutation.isPending}>
                    حفظ وتحديث حالة الطلب
                  </Button>
                </form>
              )}

              {(order.status_histories ?? []).length > 0 && (
                <div className="pt-3 border-t border-line space-y-2">
                  <p className="text-xs font-bold text-muted flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>سجل تغييرات الطلب</span>
                  </p>
                  <div className="space-y-2">
                    {order.status_histories!.map((h) => (
                      <div key={h.id} className="text-xs flex items-center justify-between gap-2 bg-canvas px-3 py-2 rounded-lg border border-line">
                        <div>
                          <span className="font-bold text-ink">
                            {ORDER_STATUS_META[h.to_status]?.label || h.to_status_label || h.to_status}
                          </span>
                          {h.note && <span className="text-muted"> — {h.note}</span>}
                        </div>
                        <span className="text-[11px] text-muted shrink-0">
                          {h.actor_name || 'النظام'} • {h.created_at ? new Date(h.created_at).toLocaleString('ar-EG') : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
