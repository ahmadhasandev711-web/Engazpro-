import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Package,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';

interface StockTransferMobileCardProps {
  transfer: any;
  onReceive: (transferId: number) => void;
  onCancel?: (transferId: number) => void;
  onView: (transfer: any) => void;
  isReceiving?: boolean;
  canCancel?: boolean;
}

export const StockTransferMobileCard: React.FC<StockTransferMobileCardProps> = ({
  transfer,
  onReceive,
  onCancel,
  onView,
  isReceiving = false,
  canCancel = false,
}) => {
  const [itemsExpanded, setItemsExpanded] = useState(false);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'IN_TRANSIT':
        return {
          label: 'في الطريق',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
          stripeClass: 'border-r-4 border-r-blue-500',
          icon: <Clock className="w-3.5 h-3.5" />,
        };
      case 'RECEIVED':
        return {
          label: 'تم الاستلام',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          stripeClass: 'border-r-4 border-r-emerald-500',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
      case 'CANCELLED':
        return {
          label: 'ملغي',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
          stripeClass: 'border-r-4 border-r-rose-500',
          icon: <XCircle className="w-3.5 h-3.5" />,
        };
      default:
        return {
          label: status,
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
          stripeClass: 'border-r-4 border-r-slate-400',
          icon: <ArrowLeftRight className="w-3.5 h-3.5" />,
        };
    }
  };

  const statusConfig = getStatusConfig(transfer.status);
  const items = transfer.items || [];
  const totalQuantity = items.reduce((sum: number, item: any) => sum + (Number(item.quantity_sent) || 0), 0);

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200 ${statusConfig.stripeClass}`}
    >
      {/* Header: Number, Date, Status Badge */}
      <div className="p-3.5 pb-2.5 flex items-start justify-between gap-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-black text-sm text-slate-900 tracking-tight">
              #{transfer.transfer_number}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            {transfer.transferred_at ? new Date(transfer.transferred_at).toLocaleString('ar-EG') : '-'}
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConfig.badgeClass}`}
        >
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      </div>

      {/* Body: Route visualizer */}
      <div className="p-3.5 space-y-3">
        {/* Route track */}
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
          <div className="flex items-center justify-between gap-2 text-xs">
            {/* From branch */}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">فرع المصدر (من)</span>
              <div className="flex items-center gap-1.5 text-slate-800 font-bold truncate">
                <div className="w-6 h-6 rounded-lg bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{transfer.from_branch?.name || '-'}</span>
              </div>
            </div>

            {/* Direction Arrow */}
            <div className="px-2 shrink-0 flex flex-col items-center justify-center text-blue-600">
              <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* To branch */}
            <div className="flex-1 min-w-0 text-left">
              <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">فرع الوجهة (إلى)</span>
              <div className="flex items-center justify-end gap-1.5 text-blue-700 font-bold truncate">
                <span className="truncate">{transfer.to_branch?.name || '-'}</span>
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items summary & collapsible detail */}
        <div className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden">
          <button
            type="button"
            onClick={() => setItemsExpanded(!itemsExpanded)}
            className="w-full p-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-100/60 active:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-500" />
              <span>الأصناف المحولة:</span>
              <span className="bg-white border border-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-full text-[11px]">
                {items.length} صنف ({totalQuantity} قطعة)
              </span>
            </div>
            {itemsExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {itemsExpanded && (
            <div className="p-3 pt-0 border-t border-slate-100 space-y-2 mt-1">
              {items.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-100"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{item.product?.name || 'صنف'}</p>
                    {item.variant && (
                      <p className="text-[10px] text-purple-700 font-medium mt-0.5">
                        مقاس: {item.variant.size || '-'} | لون: {item.variant.color || '-'}
                      </p>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900 shrink-0 mr-2 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {item.quantity_sent} {item.unit_name || 'قطعة'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes if any */}
        {transfer.notes && (
          <div className="flex items-start gap-1.5 p-2.5 bg-amber-50/70 border border-amber-200/70 rounded-xl text-[11px] text-amber-900">
            <FileText className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{transfer.notes}</span>
          </div>
        )}
      </div>

      {/* Action footer: 44px touch targets */}
      <div className="p-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onView(transfer)}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100 text-xs font-bold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all"
        >
          <Eye className="w-4 h-4 text-slate-500" />
          <span>تفاصيل</span>
        </button>

        <div className="flex items-center gap-2">
          {transfer.status === 'IN_TRANSIT' && canCancel && onCancel && (
            <button
              type="button"
              onClick={() => onCancel(transfer.id)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 active:bg-rose-200 text-xs font-bold active:scale-95 transition-all"
            >
              إلغاء
            </button>
          )}

          {transfer.status === 'IN_TRANSIT' && (
            <button
              type="button"
              disabled={isReceiving}
              onClick={() => onReceive(transfer.id)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isReceiving ? 'جاري التأكيد...' : 'تأكيد الاستلام'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
