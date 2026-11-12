import React, { useState } from 'react';
import {
  Phone,
  MapPin,
  Calendar,
  Eye,
  Printer,
  Package,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Truck,
  Copy,
  Check,
} from 'lucide-react';
import { formatCurrency, WcOrderStatus, WcPaymentStatus } from '@pos-mandob/shared';
import { MobileCard } from './MobileCard';
import { useHaptic } from '../../hooks/useHaptic';
import { getStatusBadge, getCallConfirmedBadge } from '../wc-orders/helpers';
import { Button } from '../ui/Button';

interface WcOrderMobileCardProps {
  order: any;
  onViewDetails: (order: any) => void;
  onPrint: (order: any) => void;
  onConfirm?: (order: any) => void;
  onAssignCourier?: (order: any) => void;
  onAssignMandob?: (order: any) => void;
  onDeliver?: (order: any) => void;
  canConfirm?: boolean;
  canDispatch?: boolean;
  canDeliver?: boolean;
}

const cleanItemName = (name?: string): string => {
  if (!name) return '';
  return name.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
};

const formatOrderDate = (order: any): string => {
  const dateStr = order?.order_date || order?.created_at;
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateStr);
  }
};

/**
 * Presentation Layer - WcOrderMobileCard
 * Mobile-first tailored order card optimized for thumb navigation and fast driver/packer workflows.
 */
export const WcOrderMobileCard: React.FC<WcOrderMobileCardProps> = ({
  order,
  onViewDetails,
  onPrint,
  onConfirm,
  onAssignCourier,
  onAssignMandob,
  onDeliver,
  canConfirm = true,
  canDispatch = true,
  canDeliver = true,
}) => {
  const { selection } = useHaptic();
  const [isItemsExpanded, setIsItemsExpanded] = useState<boolean>(false);
  const [copiedTracking, setCopiedTracking] = useState<boolean>(false);

  const phone = order.customer_phone || order.party?.phone;
  const address = order.customer_address || order.party?.address;
  const locationName = order.governorate || order.city;
  const items = order.items_snapshot || [];

  const handleCopyTracking = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.tracking_number) {
      navigator.clipboard.writeText(order.tracking_number);
      setCopiedTracking(true);
      setTimeout(() => setCopiedTracking(false), 2000);
    }
  };

  const isPrepaid =
    order.payment_status === WcPaymentStatus.PAID_ONLINE ||
    (order.wc_payment_method && order.wc_payment_method !== 'cod');

  return (
    <MobileCard className="bg-panel border-line space-y-3.5">
      {/* 1. Header: Order ID, Date & Status Badge */}
      <div className="flex items-start justify-between gap-2 border-b border-line pb-2.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-sm font-black text-ink bg-surface-2 px-2.5 py-0.5 rounded-lg border border-line">
              #{order.wc_order_id}
            </span>
            <span className="text-2xs font-bold text-muted flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatOrderDate(order)}
            </span>
          </div>
          {order.branch && (
            <span className="text-2xs text-muted block font-bold">
              فرع التجهيز: {order.branch.name}
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {getStatusBadge(order.status)}
          {getCallConfirmedBadge(order)}
        </div>
      </div>

      {/* 2. Customer Section with Action Buttons (Call / WhatsApp) */}
      <div className="bg-surface-2/60 p-3 rounded-2xl border border-line space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-ink truncate">
            {order.customer_name || 'عميل بدون اسم'}
          </h4>
          {locationName && (
            <span className="text-2xs font-bold text-ink bg-panel px-2 py-0.5 rounded-lg border border-line flex items-center gap-1">
              <MapPin className="w-3 h-3 text-muted" />
              {locationName}
            </span>
          )}
        </div>

        {address && (
          <p className="text-2xs text-muted flex items-start gap-1">
            <MapPin className="w-3 h-3 text-muted shrink-0 mt-0.5" />
            <span className="line-clamp-2 leading-relaxed">{address}</span>
          </p>
        )}

        {/* Quick Phone & WhatsApp Buttons */}
        {phone && (
          <div className="flex items-center gap-2 pt-1">
            <a
              href={`tel:${phone}`}
              onClick={(e) => {
                e.stopPropagation();
                selection();
              }}
              className="flex-1 py-2 px-3 bg-panel hover:bg-surface-2 text-ink font-bold text-xs rounded-xl border border-line flex items-center justify-center gap-1.5 active:scale-95 transition-all tabular-nums min-h-[36px]"
            >
              <Phone className="w-3.5 h-3.5 text-ok" />
              <span className="text-2xs">{phone}</span>
            </a>

            <a
              href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                `مرحباً ${order.customer_name}، نود تأكيد طلبك رقم #${order.wc_order_id} من متجرنا.`
              )}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                selection();
              }}
              className="py-2 px-4 bg-ok text-on-brand hover:opacity-90 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs min-h-[36px]"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
              </svg>
              <span>واتساب</span>
            </a>
          </div>
        )}
      </div>

      {/* 3. Items Summary Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-muted">
            الأصناف ({items.length}):
          </span>
          {items.length > 2 && (
            <button
              type="button"
              onClick={() => setIsItemsExpanded(!isItemsExpanded)}
              className="text-brand font-black flex items-center gap-0.5 text-2xs cursor-pointer"
            >
              <span>{isItemsExpanded ? 'طي القائمة' : `عرض الكل (+${items.length - 2})`}</span>
              {isItemsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          {(isItemsExpanded ? items : items.slice(0, 2)).map((item: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-2/60 border border-line text-xs"
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={cleanItemName(item.name)}
                  className="w-9 h-9 rounded-lg object-cover border border-line bg-panel shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-surface-2 border border-line flex items-center justify-center shrink-0 text-muted">
                  <Package className="w-4 h-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="font-bold text-ink truncate block text-2xs">
                  {cleanItemName(item.name)}
                </span>
                {item.attributes && Array.isArray(item.attributes) && item.attributes.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {item.attributes.map((attr: any, aIdx: number) => (
                      <span
                        key={aIdx}
                        className="text-2xs bg-panel border border-line px-1.5 py-0.5 rounded text-muted font-bold"
                      >
                        {attr.key}: {attr.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="tabular-nums text-xs font-black text-ink shrink-0">
                × {item.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Courier & Tracking Strip (if dispatched) */}
      {(order.courier_name || order.mandob || order.tracking_number) && (
        <div className="p-2.5 rounded-xl bg-surface-2/60 border border-line text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-ink font-bold">
            <Truck className="w-3.5 h-3.5 text-brand" />
            <span>{order.courier_name || order.mandob?.name || 'شركة شحن'}</span>
          </div>

          {order.tracking_number && (
            <button
              type="button"
              onClick={handleCopyTracking}
              className="inline-flex items-center gap-1 tabular-nums text-2xs bg-panel px-2 py-0.5 rounded-md border border-line text-ink cursor-pointer"
              title="نسخ رقم البوليصة"
            >
              <span>{order.tracking_number}</span>
              {copiedTracking ? <Check className="w-3 h-3 text-ok" /> : <Copy className="w-3 h-3 text-muted" />}
            </button>
          )}
        </div>
      )}

      {/* 5. Financial Summary Row */}
      <div className="pt-2 border-t border-line flex items-center justify-between">
        <div>
          <span className="text-2xs text-muted block font-bold">
            {isPrepaid ? 'مدفوع مقدماً أونلاين' : 'المطلوب تحصيله (COD)'}
          </span>
          <span className="tabular-nums text-base font-black text-ink">
            {formatCurrency(order.total)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Print Button */}
          <button
            type="button"
            onClick={() => {
              selection();
              onPrint(order);
            }}
            className="p-2 text-muted hover:text-ink bg-surface-2 border border-line rounded-xl active:scale-95 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
            title="طباعة الفاتورة / البوليصة"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Details Button */}
          <button
            type="button"
            onClick={() => {
              selection();
              onViewDetails(order);
            }}
            className="p-2 text-brand bg-brand-soft border border-brand/20 rounded-xl active:scale-95 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
            title="عرض التفاصيل الكاملة والصور"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 6. Context-Aware Primary Action Button */}
      <div className="pt-1">
        {order.status === WcOrderStatus.PENDING_CONFIRMATION && onConfirm && canConfirm && (
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              selection();
              onConfirm(order);
            }}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            className="w-full min-h-[44px] font-black text-xs"
          >
            تأكيد وتجهيز الطلب الآن ⚡
          </Button>
        )}

        {order.status === WcOrderStatus.CONFIRMED && (
          <div className="grid grid-cols-2 gap-2">
            {onAssignCourier && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  selection();
                  onAssignCourier(order);
                }}
                leftIcon={<Package className="w-3.5 h-3.5" />}
                className="min-h-[44px] font-bold text-xs"
              >
                شركة شحن
              </Button>
            )}

            {onAssignMandob && canDispatch && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  selection();
                  onAssignMandob(order);
                }}
                leftIcon={<Truck className="w-3.5 h-3.5" />}
                className="min-h-[44px] font-bold text-xs"
              >
                مندوب الفرع
              </Button>
            )}
          </div>
        )}

        {(order.status === WcOrderStatus.DISPATCHED || order.status === WcOrderStatus.SHIPPED_VIA_COURIER) &&
          onDeliver &&
          canDeliver && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                selection();
                onDeliver(order);
              }}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              className="w-full min-h-[44px] font-black text-xs"
            >
              تسليم الأوردر وتحصيل الكاش 💵
            </Button>
          )}
      </div>
    </MobileCard>
  );
};
