import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  RefreshCw,
  Truck,
  Upload,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  EasyfyOrderStatus,
  EasyfyPaymentStatus,
  formatCurrency,
} from '@pos-mandob/shared';
import {
  useEasyfyOrderDetail,
  useReorderEasyfyOrder,
  useReuploadEasyfyPaymentProof,
} from '../../../hooks/useEasyfyShop';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../utils/cn';
import { AuthenticatedMediaPreview } from '../../components/admin/easyfy/AuthenticatedMediaPreview';
import {
  ORDER_STATUS_META,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_META,
} from '../../components/admin/easyfy/easyfyUiMeta';
import { ShopTopBar } from '../../components/shop/ShopTopBar';
import { Badge, Button, Card, EmptyState, Input } from '../../components/ui';

const TIMELINE_STEPS: Array<{ status: EasyfyOrderStatus; label: string }> = [
  { status: EasyfyOrderStatus.PENDING, label: 'استلام الطلب' },
  { status: EasyfyOrderStatus.CONFIRMED, label: 'تأكيد الطلب' },
  { status: EasyfyOrderStatus.PREPARING, label: 'جاري التجهيز' },
  { status: EasyfyOrderStatus.SHIPPED, label: 'تم الشحن' },
  { status: EasyfyOrderStatus.DELIVERED, label: 'تم التسليم' },
];

export const ShopOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: order, isLoading, isError } = useEasyfyOrderDetail(id);
  const reorderMutation = useReorderEasyfyOrder();
  const reuploadMutation = useReuploadEasyfyPaymentProof();

  const [newRef, setNewRef] = useState<string>('');
  const [newProofFile, setNewProofFile] = useState<File | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-5" dir="rtl">
        <ShopTopBar />
        <div className="h-80 rounded-2xl bg-surface-2 animate-pulse" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="space-y-5" dir="rtl">
        <ShopTopBar />
        <EmptyState
          icon={<Package className="w-9 h-9 text-muted" />}
          title="الطلب غير موجود"
          description="تأكد من رقم الطلب أو عد إلى قائمة طلبات المتجر."
          action={
            <Button size="sm" onClick={() => navigate('/shop/orders')}>
              عرض طلبات المتجر
            </Button>
          }
        />
      </div>
    );
  }

  const stMeta = ORDER_STATUS_META[order.status] ?? {
    label: String(order.status),
    tone: 'neutral' as const,
  };
  const payMeta = PAYMENT_STATUS_META[order.payment_verification_status] ?? {
    label: String(order.payment_verification_status),
    tone: 'neutral' as const,
  };
  const isCancelled = order.status === EasyfyOrderStatus.CANCELLED;
  const activeStepIdx = TIMELINE_STEPS.findIndex((s) => s.status === order.status);
  const canReuploadProof =
    order.payment_verification_status === EasyfyPaymentStatus.REJECTED &&
    order.status !== EasyfyOrderStatus.CANCELLED &&
    order.status !== EasyfyOrderStatus.DELIVERED;

  const handleReorder = async () => {
    try {
      await reorderMutation.mutateAsync(order.id);
      toast.success('تم نسخ الأصناف إلى سلة التسوق بنجاح.');
      navigate('/shop/cart');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر إعادة الطلب');
    }
  };

  const handleReuploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRef.trim() || !newProofFile) {
      toast.error('يرجى إدخال الرقم المرجعي الجديد وإرفاق صورة التحويل.');
      return;
    }
    try {
      await reuploadMutation.mutateAsync({
        orderId: order.id,
        transfer_reference: newRef.trim(),
        payment_proof: newProofFile,
      });
      setNewRef('');
      setNewProofFile(null);
      toast.success('تم إرسال الإثبات المحدث بنجاح لمراجعة الإدارة.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر إعادة رفع إثبات التحويل');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <ShopTopBar />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/shop/orders"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-muted hover:text-brand-ink"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لطلبات المتجر</span>
        </Link>

        <Button
          size="sm"
          variant="secondary"
          isLoading={reorderMutation.isPending}
          onClick={handleReorder}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          إعادة طلب نفس الأصناف
        </Button>
      </div>

      {/* Header & Visual Timeline */}
      <Card className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-black text-ink">طلب {order.order_number}</h1>
              <Badge tone={stMeta.tone}>{stMeta.label}</Badge>
              <Badge tone={payMeta.tone}>{payMeta.label}</Badge>
            </div>
            <p className="text-xs text-muted">
              تاريخ الطلب:{' '}
              {order.created_at ? new Date(order.created_at).toLocaleString('ar-EG') : '-'} • أنشأه:{' '}
              <strong className="text-ink">{order.ordered_by_name || '-'}</strong>
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs text-muted font-bold">الإجمالي</p>
            <p className="text-xl font-black text-brand tabular-nums">
              {formatCurrency(order.total_amount)}
            </p>
          </div>
        </div>

        {isCancelled ? (
          <div className="p-3.5 rounded-xl bg-bad-soft border border-bad/25 text-bad text-xs sm:text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>تم إلغاء هذا الطلب.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
            {TIMELINE_STEPS.map((step, idx) => {
              const reached = activeStepIdx >= idx;
              return (
                <div
                  key={step.status}
                  className={cn(
                    'p-3 rounded-xl border text-center space-y-1 transition-colors',
                    reached
                      ? 'bg-ok-soft/60 border-ok/35 text-ok'
                      : 'bg-canvas border-line text-muted'
                  )}
                >
                  <CheckCircle2 className={cn('w-4 h-4 mx-auto', reached ? 'text-ok' : 'opacity-40')} />
                  <p className="text-xs font-black">{step.label}</p>
                </div>
              );
            })}
          </div>
        )}

        {(order.courier_name || order.tracking_number) && (
          <div className="p-3.5 rounded-xl bg-info-soft/50 border border-info/25 text-xs flex items-center gap-3 flex-wrap">
            <Truck className="w-4 h-4 text-info shrink-0" />
            <span className="font-bold text-ink">
              شركة الشحن: {order.courier_name || '-'}
            </span>
            {order.tracking_number && (
              <span className="font-black text-info">رقم التتبع: {order.tracking_number}</span>
            )}
          </div>
        )}
      </Card>

      {/* Rejected Payment Proof Re-upload Banner */}
      {canReuploadProof && (
        <Card className="p-5 border-bad/35 bg-bad-soft/40 space-y-4">
          <div className="space-y-1">
            <p className="font-black text-sm text-bad flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>تم رفض إثبات التحويل — يرجى إعادة الرفع للمراجعة</span>
            </p>
            {order.payment_rejection_reason && (
              <p className="text-xs text-ink font-bold">
                السبب: {order.payment_rejection_reason}
              </p>
            )}
          </div>

          <form onSubmit={handleReuploadSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Input
              label="الرقم المرجعي الجديد"
              required
              value={newRef}
              onChange={(e) => setNewRef(e.target.value)}
            />
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-ink">صورة التحويل الواضحة *</p>
              <label className="min-h-[44px] flex items-center gap-2 px-3 rounded-xl border border-dashed border-line-2 bg-panel cursor-pointer text-xs font-bold text-ink">
                <Upload className="w-4 h-4 text-brand shrink-0" />
                <span className="truncate">{newProofFile ? newProofFile.name : 'اختر صورة جديدة'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setNewProofFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <Button type="submit" isLoading={reuploadMutation.isPending}>
              إرسال الإثبات المحدث
            </Button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Items */}
        <Card className="p-5 lg:col-span-8 space-y-4">
          <h2 className="font-black text-base text-ink border-b border-line pb-3">الأصناف المطلوبة</h2>
          <div className="space-y-3">
            {(order.items ?? []).map((item) => (
              <div key={item.id} className="p-3.5 rounded-xl border border-line bg-canvas space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="font-black text-sm text-ink">{item.product_name}</p>
                    <p className="text-xs text-muted">
                      {item.variant_label} • الكمية: {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <p className="font-black text-sm text-ink tabular-nums">
                    {formatCurrency(item.line_total)}
                  </p>
                </div>

                {item.custom_note && (
                  <p className="text-xs bg-brand-soft text-brand-ink px-2.5 py-1 rounded-lg border border-brand/20">
                    مواصفات الطباعة: {item.custom_note}
                  </p>
                )}

                {item.has_artwork && (
                  <div className="pt-1">
                    <p className="text-[11px] font-bold text-muted mb-1">التصميم المرفق:</p>
                    <AuthenticatedMediaPreview
                      endpoint={`/easyfy/orders/${order.id}/items/${item.id}/artwork`}
                      alt={`تصميم ${item.product_name}`}
                      compact
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Delivery, Payment & History */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 space-y-3">
            <h3 className="font-black text-sm text-ink flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand" />
              <span>بيانات التوصيل والدفع</span>
            </h3>
            <div className="text-xs space-y-1.5 text-muted">
              <p className="text-ink font-bold">{order.recipient_name}</p>
              <p>{order.recipient_phone}</p>
              <p>
                {order.governorate} — {order.shipping_address}
              </p>
              <p className="pt-2 border-t border-line font-bold text-ink">
                الدفع: {PAYMENT_METHOD_LABEL[order.payment_method] || order.payment_method}
              </p>
              {order.transfer_reference && <p>المرجع: {order.transfer_reference}</p>}
            </div>

            {order.has_payment_proof && (
              <div className="pt-2">
                <p className="text-xs font-bold text-muted mb-1">إيصال التحويل المرفق:</p>
                <AuthenticatedMediaPreview
                  endpoint={`/easyfy/orders/${order.id}/payment-proof`}
                  alt={`إيصال ${order.order_number}`}
                  compact
                />
              </div>
            )}

            <div className="pt-3 border-t border-line space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">المنتجات</span>
                <span className="font-bold text-ink tabular-nums">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">الشحن</span>
                <span className="font-bold text-ink tabular-nums">{formatCurrency(order.shipping_fee)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-ok">
                  <span>الخصم</span>
                  <span className="font-bold tabular-nums">- {formatCurrency(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-line text-sm">
                <span className="font-black text-ink">الإجمالي</span>
                <span className="font-black text-brand tabular-nums">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </Card>

          {(order.status_histories ?? []).length > 0 && (
            <Card className="p-5 space-y-3">
              <h3 className="font-black text-sm text-ink flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted" />
                <span>سجل التحديثات</span>
              </h3>
              <div className="space-y-2">
                {order.status_histories!.map((h) => (
                  <div key={h.id} className="text-xs bg-canvas p-2.5 rounded-xl border border-line space-y-0.5">
                    <p className="font-bold text-ink">
                      {ORDER_STATUS_META[h.to_status]?.label || h.to_status_label || h.to_status}
                    </p>
                    {h.note && <p className="text-muted">{h.note}</p>}
                    <p className="text-[11px] text-muted">
                      {h.created_at ? new Date(h.created_at).toLocaleString('ar-EG') : ''}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
