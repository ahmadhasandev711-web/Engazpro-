import React from 'react';
import { formatCurrency, WcOrderStatus, WcPaymentStatus } from '@pos-mandob/shared';
import {
  ShoppingBag,
  Truck,
  CheckCircle2,
  X,
  Phone,
  MapPin,
  DollarSign,
  RotateCcw,
  Package,
  Printer,
  Calendar,
  AlertCircle,
  Clock,
  Circle,
} from 'lucide-react';
import {
  cleanItemName,
  formatOrderDate,
  getStatusBadge,
  getCallConfirmedBadge,
  calculateOrderStages,
  OrderStage,
} from './helpers';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../utils/cn';
import type { WcOrdersViewModel } from './types';

interface WcOrderDetailsPanelProps {
  vm: WcOrdersViewModel;
  onClose?: () => void;
  isAside?: boolean;
}

export const WcOrderDetailsPanel: React.FC<WcOrderDetailsPanelProps> = ({ vm, onClose, isAside = false }) => {
  const {
    isManager,
    isMandob,
    viewingOrder,
    setViewingOrder,
    setSelectedBranchId,
    setConfirmError,
    setForceConfirm,
    setConfirmModalOrder,
    setDispatchModalOrder,
    setSelectedMandobId,
    openCourierModal,
    openDeliverModal,
    setPrintOrder,
    user,
    branches,
    mandobs,
    returnMutation,
    orders,
  } = vm;

  if (!viewingOrder) {
    if (isAside) {
      return (
        <div className="bg-panel border border-line rounded-3xl p-6 h-full flex flex-col items-center justify-center min-h-[460px]">
          <EmptyState
            icon={<ShoppingBag className="w-8 h-8 text-muted" />}
            title="اختر طلباً لعرض تفاصيله"
            description="اضغط على أي طلب من القائمة لمعاينة التفاصيل، بنود الفاتورة، وخط سير المراحل."
            className="border-0 bg-transparent py-0 px-0"
          />
        </div>
      );
    }
    return null;
  }

  const order = (orders && orders.find((o: any) => o.id === viewingOrder.id)) || viewingOrder;
  const stages = calculateOrderStages(order);

  const phone = order.customer_phone || order.party?.phone;
  const address = order.customer_address || order.party?.address;
  const gov = order.governorate || order.city;
  const cleanPhoneForWa = phone ? phone.replace(/\D/g, '') : '';
  const waUrl = cleanPhoneForWa
    ? cleanPhoneForWa.startsWith('2')
      ? `https://wa.me/${cleanPhoneForWa}`
      : `https://wa.me/2${cleanPhoneForWa}`
    : null;

  return (
    <div
      className={cn(
        'bg-panel border border-line p-5 shadow-xs flex flex-col h-full overflow-hidden text-right',
        isAside ? 'rounded-3xl' : 'rounded-t-[2.5rem] sm:rounded-3xl'
      )}
      dir="rtl"
    >
      {/* Mobile Handle if used in modal */}
      {!isAside && (
        <div className="w-12 h-1.5 bg-line rounded-full mx-auto mb-2 sm:hidden shrink-0" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-3 shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-10 h-10 rounded-2xl bg-brand-soft border border-brand/20 flex items-center justify-center text-brand-ink shadow-2xs shrink-0">
            <ShoppingBag className="w-5 h-5 text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-black text-ink tabular-nums">
                طلب ووكومرس #{order.wc_order_id}
              </h2>
              {getCallConfirmedBadge(order)}
              {getStatusBadge(order.status)}
            </div>
            {(order.order_date || order.created_at) && (
              <p className="text-2xs text-muted font-medium flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-muted" />
                <span>تاريخ الطلب: {formatOrderDate(order)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {order.status !== WcOrderStatus.CANCELLED && (
            <button
              type="button"
              onClick={() => setPrintOrder(order)}
              className="p-2 text-muted hover:text-brand hover:bg-surface-2 rounded-xl transition-all cursor-pointer border border-line min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="طباعة بوليصة التوصيل / الفاتورة"
            >
              <Printer className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted hover:text-ink hover:bg-surface-2 rounded-xl transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto py-3 space-y-3.5 flex-1 pr-0.5">
        {/* Stages Timeline (ol) */}
        <div className="space-y-1.5">
          <span className="text-2xs font-black text-muted uppercase tracking-wider block">
            خط سير الطلب والمراحل:
          </span>
          <ol className="p-3 bg-surface-2/60 border border-line rounded-2xl space-y-2.5">
            {stages.map((stage: OrderStage) => {
              const getStatusDot = () => {
                switch (stage.status) {
                  case 'done':
                    return <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />;
                  case 'now':
                    return <Clock className="w-4 h-4 text-brand shrink-0 animate-pulse" />;
                  case 'warn':
                    return <AlertCircle className="w-4 h-4 text-warn shrink-0" />;
                  case 'bad':
                    return <AlertCircle className="w-4 h-4 text-bad shrink-0" />;
                  case 'todo':
                  default:
                    return <Circle className="w-4 h-4 text-muted/40 shrink-0" />;
                }
              };

              return (
                <li key={stage.id} className="flex items-start gap-2.5 text-xs">
                  <div className="pt-0.5">{getStatusDot()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          'font-bold',
                          stage.status === 'bad' && 'text-bad',
                          stage.status === 'warn' && 'text-warn',
                          stage.status === 'now' && 'text-brand font-black',
                          stage.status === 'done' && 'text-ink',
                          stage.status === 'todo' && 'text-muted'
                        )}
                      >
                        {stage.label}
                      </span>
                      {stage.sublabel && (
                        <span className="text-2xs text-muted tabular-nums truncate">
                          {stage.sublabel}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Customer Information Card */}
        <div className="bg-surface-2/60 border border-line rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-2xs font-black text-muted uppercase tracking-wider block">
                بيانات العميل:
              </span>
              <h3 className="text-sm font-black text-ink mt-0.5">{order.customer_name}</h3>
            </div>

            {/* Quick Contact Buttons */}
            <div className="flex items-center gap-2">
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-panel border border-line text-ink hover:text-ok rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 tabular-nums min-h-[36px]"
                >
                  <Phone className="w-3.5 h-3.5 text-ok" />
                  <span>{phone}</span>
                </a>
              )}
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ok text-on-brand hover:opacity-90 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 min-h-[36px]"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
                  </svg>
                  <span>واتساب</span>
                </a>
              )}
            </div>
          </div>

          {/* Customer Address */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted pt-1 border-t border-line">
            {gov && (
              <span className="inline-flex items-center gap-1 bg-panel border border-line px-2 py-0.5 rounded-lg font-bold text-ink">
                <MapPin className="w-3 h-3 text-muted" />
                <span>{gov}</span>
              </span>
            )}
            {address && <span className="font-medium text-muted">{address}</span>}
          </div>

          {/* Customer Note from WooCommerce */}
          {order.notes && (
            <div className="bg-warn-soft border border-warn/20 rounded-xl p-2.5 text-xs text-warn flex items-start gap-2">
              <span className="font-bold shrink-0">ملاحظات العميل:</span>
              <span className="leading-relaxed font-medium">{order.notes}</span>
            </div>
          )}
        </div>

        {/* Products & Line Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-ink flex items-center gap-1.5">
              <Package className="w-4 h-4 text-brand" />
              <span>الأصناف والمنتجات المطلوبة ({order.items_snapshot?.length || 0})</span>
            </span>
          </div>

          <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden bg-panel">
            {(order.items_snapshot || []).map((item: any, idx: number) => {
              const qty = Math.max(1, Number(item.quantity) || 1);
              const unitPrice = item.price || (item.subtotal ? item.subtotal / qty : 0);
              const lineTotal = item.total || item.subtotal || unitPrice * qty;

              return (
                <div key={idx} className="p-3 flex items-center gap-3 hover:bg-surface-2/40 transition-colors">
                  {/* Thumbnail Image */}
                  <div className="w-12 h-12 rounded-xl border border-line bg-surface-2 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={cleanItemName(item.name)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Package className="w-5 h-5 text-muted" />
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-ink leading-snug">
                      {cleanItemName(item.name)}
                    </h4>

                    {/* Variation Attributes */}
                    {item.attributes && Array.isArray(item.attributes) && item.attributes.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {item.attributes.map((attr: any, aIdx: number) => (
                          <span
                            key={aIdx}
                            className="inline-flex items-center text-2xs font-bold bg-surface-2 text-muted px-2 py-0.5 rounded-md border border-line"
                          >
                            <span className="text-muted/70 ml-1">{attr.key}:</span>
                            <span>{attr.value}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-2xs text-muted mt-1 tabular-nums">
                      <span>سعر الوحدة: <strong className="text-ink">{formatCurrency(unitPrice)}</strong></span>
                      <span>الكمية: <strong className="text-ink">× {item.quantity}</strong></span>
                    </div>
                  </div>

                  {/* Line Total */}
                  <div className="text-left font-black text-xs text-ink shrink-0 tabular-nums">
                    {formatCurrency(lineTotal)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="bg-surface-2/60 border border-line rounded-2xl p-3.5 space-y-2 text-xs">
          <div className="flex justify-between text-muted">
            <span>إجمالي المنتجات:</span>
            <span className="font-bold tabular-nums text-ink">{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>تكلفة الشحن والتوصيل:</span>
            <span className="font-bold tabular-nums text-ink">{formatCurrency(order.shipping_cost)}</span>
          </div>
          {order.discount_total > 0 && (
            <div className="flex justify-between text-ok">
              <span className="flex items-center gap-1">
                <span>خصم الكوبون:</span>
                {order.wc_coupon_codes && order.wc_coupon_codes.length > 0 && (
                  <span className="bg-ok-soft text-ok text-2xs px-1.5 py-0.5 rounded font-bold">
                    {order.wc_coupon_codes.join(', ')}
                  </span>
                )}
              </span>
              <span className="font-bold tabular-nums">-{formatCurrency(order.discount_total)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm font-black text-ink border-t border-line pt-2">
            <span>الإجمالي النهائي المطلوب تحصيله:</span>
            <span className="text-brand text-base font-black tabular-nums">{formatCurrency(order.total)}</span>
          </div>
          <div className="pt-1 flex items-center justify-between text-2xs text-muted border-t border-line">
            <span>طريقة الدفع:</span>
            <span className="font-bold text-ink">
              {order.payment_status === WcPaymentStatus.PAID_ONLINE ? '💳 مدفوع أونلاين' : '💵 الدفع عند الاستلام (COD)'}
              {order.wc_payment_method ? ` (${order.wc_payment_method})` : ''}
            </span>
          </div>
        </div>

        {/* Logistics & Assignment Card */}
        <div className="p-3 bg-surface-2/60 border border-line rounded-2xl text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted">فرع التجهيز والمخزون:</span>
            <span className="font-bold text-ink">{order.branch?.name || 'لم يحدد بعد'}</span>
          </div>
          {order.mandob && (
            <div className="flex items-center justify-between">
              <span className="text-muted">المندوب المسند له:</span>
              <span className="font-bold text-info">{order.mandob.name}</span>
            </div>
          )}
          {order.courier_name && (
            <div className="flex items-center justify-between border-t border-line pt-1.5">
              <span className="text-muted">شركة الشحن:</span>
              <span className="font-bold text-ink">{order.courier_name}</span>
            </div>
          )}
          {order.tracking_number && (
            <div className="flex items-center justify-between">
              <span className="text-muted">رقم البوليصة:</span>
              <span className="font-bold text-ink bg-panel px-2 py-0.5 rounded border border-line tabular-nums">
                {order.tracking_number}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-line flex flex-col gap-2 shrink-0">
        {!isMandob && order.status === WcOrderStatus.PENDING_CONFIRMATION && (
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              if (!isAside) setViewingOrder(null);
              setConfirmModalOrder(order);
              setConfirmError(null);
              setForceConfirm(false);
              const defaultBranch = isManager
                ? branches.find((b: any) => b.id === user?.branch_id)
                : (branches.find((b: any) => b.id === order.branch_id) ||
                   branches.find((b: any) => b.is_main) ||
                   branches[0]);
              setSelectedBranchId(defaultBranch?.id ?? (user?.branch_id ?? ''));
            }}
            leftIcon={<CheckCircle2 className="w-5 h-5" />}
            className="w-full min-h-[44px] font-black text-xs"
          >
            تأكيد الطلب وتحديد المخزن
          </Button>
        )}

        {!isMandob && order.status === WcOrderStatus.CONFIRMED && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                if (!isAside) setViewingOrder(null);
                setDispatchModalOrder(order);
                setSelectedMandobId(order.mandob_id || (mandobs[0]?.id ?? ''));
              }}
              leftIcon={<Truck className="w-4 h-4" />}
              className="min-h-[44px] font-black text-xs"
            >
              إسناد لمندوب
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                if (!isAside) setViewingOrder(null);
                openCourierModal(order);
              }}
              leftIcon={<Package className="w-4 h-4" />}
              className="min-h-[44px] font-black text-xs"
            >
              إسناد لشركة شحن
            </Button>
          </div>
        )}

        {order.status === WcOrderStatus.DISPATCHED && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                if (!isAside) setViewingOrder(null);
                openDeliverModal(order);
              }}
              leftIcon={<DollarSign className="w-4 h-4" />}
              className="min-h-[44px] font-black text-xs"
            >
              {order.payment_status === WcPaymentStatus.PAID_ONLINE ? 'تأكيد التسليم' : 'تسليم وتحصيل'}
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => {
                const orderId = order.id;
                if (!isAside) setViewingOrder(null);
                returnMutation.mutate(orderId);
              }}
              disabled={returnMutation.isPending}
              isLoading={returnMutation.isPending}
              leftIcon={<RotateCcw className="w-4 h-4" />}
              className="min-h-[44px] font-black text-xs"
            >
              مرتجع
            </Button>
          </div>
        )}

        {order.status === WcOrderStatus.SHIPPED_VIA_COURIER && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                if (!isAside) setViewingOrder(null);
                openDeliverModal(order);
              }}
              leftIcon={<DollarSign className="w-4 h-4" />}
              className="min-h-[44px] font-black text-xs"
            >
              {order.payment_status === WcPaymentStatus.PAID_ONLINE ? 'تأكيد تسليم الشحنة' : 'تسليم وتحصيل COD'}
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => {
                const orderId = order.id;
                if (!isAside) setViewingOrder(null);
                returnMutation.mutate(orderId);
              }}
              disabled={returnMutation.isPending}
              isLoading={returnMutation.isPending}
              leftIcon={<RotateCcw className="w-4 h-4" />}
              className="min-h-[44px] font-black text-xs"
            >
              مرتجع شحن
            </Button>
          </div>
        )}

        {onClose && (
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            className="w-full min-h-[44px] font-bold text-xs text-muted hover:text-ink"
          >
            إغلاق
          </Button>
        )}
      </div>
    </div>
  );
};
