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
  Clock,
  Truck,
  RotateCcw,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { MobileCard } from './MobileCard';
import { useHaptic } from '../../hooks/useHaptic';

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

  // Determine status styling
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING_CONFIRMATION':
      case 'PENDING':
        return {
          label: 'بانتظار التأكيد',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          border: 'amber' as const,
          icon: Clock,
        };
      case 'CONFIRMED':
        return {
          label: 'مؤكد وقيد التجهيز',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          border: 'indigo' as const,
          icon: Package,
        };
      case 'DISPATCHED':
        return {
          label: 'مع المندوب',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          border: 'indigo' as const,
          icon: Truck,
        };
      case 'SHIPPED_VIA_COURIER':
        return {
          label: 'مع شركة الشحن',
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          border: 'purple' as const,
          icon: Truck,
        };
      case 'DELIVERED':
        return {
          label: 'تم التسليم بنجاح',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          border: 'emerald' as const,
          icon: CheckCircle2,
        };
      case 'RETURNED':
        return {
          label: 'مرتجع',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          border: 'rose' as const,
          icon: RotateCcw,
        };
      default:
        return {
          label: status,
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          border: 'slate' as const,
          icon: AlertCircle,
        };
    }
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;

  const handleCopyTracking = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.tracking_number) {
      navigator.clipboard.writeText(order.tracking_number);
      setCopiedTracking(true);
      setTimeout(() => setCopiedTracking(false), 2000);
    }
  };

  const isPrepaid =
    order.payment_status === 'PAID_ONLINE' ||
    (order.wc_payment_method && order.wc_payment_method !== 'cod');

  return (
    <MobileCard statusColor={statusConfig.border} className="space-y-3.5">
      {/* 1. Header: Order ID, Date & Status Badge */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/60">
              #{order.wc_order_id}
            </span>
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 font-sans">
              <Calendar className="w-3 h-3" />
              {formatOrderDate(order)}
            </span>
          </div>
          {order.branch && (
            <span className="text-[10px] text-slate-500 block font-bold">
              فرع التجهيز: {order.branch.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-xl border ${statusConfig.bg}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{statusConfig.label}</span>
          </span>
        </div>
      </div>

      {/* 2. Customer Section with Action Buttons (Call / WhatsApp) */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-slate-900 truncate">
            {order.customer_name || 'عميل بدون اسم'}
          </h4>
          {locationName && (
            <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200/70 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              {locationName}
            </span>
          )}
        </div>

        {address && (
          <p className="text-[11px] text-slate-500 flex items-start gap-1 font-sans">
            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
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
              className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-mono text-[11px]">{phone}</span>
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
              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
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
          <span className="font-bold text-slate-500">
            الأصناف ({items.length}):
          </span>
          {items.length > 2 && (
            <button
              type="button"
              onClick={() => setIsItemsExpanded(!isItemsExpanded)}
              className="text-primary-600 font-black flex items-center gap-0.5 text-[11px]"
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
              className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/70 border border-slate-100 text-xs"
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={cleanItemName(item.name)}
                  className="w-9 h-9 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-slate-200/80 flex items-center justify-center shrink-0 text-slate-400">
                  <Package className="w-4 h-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="font-bold text-slate-900 truncate block text-[11px]">
                  {cleanItemName(item.name)}
                </span>
                {item.attributes && Array.isArray(item.attributes) && item.attributes.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {item.attributes.map((attr: any, aIdx: number) => (
                      <span
                        key={aIdx}
                        className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.2 rounded text-slate-600 font-bold"
                      >
                        {attr.key}: {attr.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="font-mono text-xs font-black text-slate-800 shrink-0">
                × {item.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Courier & Tracking Strip (if dispatched) */}
      {(order.courier_name || order.mandob || order.tracking_number) && (
        <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-purple-900 font-bold">
            <Truck className="w-3.5 h-3.5 text-purple-600" />
            <span>{order.courier_name || order.mandob?.name || 'شركة شحن'}</span>
          </div>

          {order.tracking_number && (
            <button
              type="button"
              onClick={handleCopyTracking}
              className="inline-flex items-center gap-1 font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-purple-200 text-purple-700"
              title="نسخ رقم البوليصة"
            >
              <span>{order.tracking_number}</span>
              {copiedTracking ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>
      )}

      {/* 5. Financial Summary Row */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-400 block font-bold">
            {isPrepaid ? 'مدفوع مقدماً أونلاين' : 'المطلوب تحصيله (COD)'}
          </span>
          <span className="font-mono text-base font-black text-slate-900">
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
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl active:scale-95 transition-all"
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
            className="p-2 text-indigo-600 bg-indigo-50 rounded-xl active:scale-95 transition-all"
            title="عرض التفاصيل الكاملة والصور"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 6. Context-Aware Primary Action Button */}
      <div className="pt-1">
        {(order.status === 'PENDING_CONFIRMATION' || order.status === 'PENDING') && onConfirm && canConfirm && (
          <button
            type="button"
            onClick={() => {
              selection();
              onConfirm(order);
            }}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-900/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>تأكيد وتجهيز الطلب الآن ⚡</span>
          </button>
        )}

        {order.status === 'CONFIRMED' && (
          <div className="grid grid-cols-2 gap-2">
            {onAssignCourier && (
              <button
                type="button"
                onClick={() => {
                  selection();
                  onAssignCourier(order);
                }}
                className="py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-xs active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Package className="w-3.5 h-3.5" />
                <span>شركة شحن</span>
              </button>
            )}

            {onAssignMandob && canDispatch && (
              <button
                type="button"
                onClick={() => {
                  selection();
                  onAssignMandob(order);
                }}
                className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>مندوب الفرع</span>
              </button>
            )}
          </div>
        )}

        {(order.status === 'DISPATCHED' || order.status === 'SHIPPED_VIA_COURIER') && onDeliver && canDeliver && (
          <button
            type="button"
            onClick={() => {
              selection();
              onDeliver(order);
            }}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-md shadow-amber-900/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>تسليم الأوردر وتحصيل الكاش 💵</span>
          </button>
        )}
      </div>
    </MobileCard>
  );
};
