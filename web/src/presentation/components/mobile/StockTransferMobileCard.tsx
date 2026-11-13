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

import { StockTransferStatus, StockTransfer } from '@pos-mandob/shared';
import { Badge, BadgeTone, Button, Card } from '../ui';

interface StockTransferMobileCardProps {
  transfer: StockTransfer;
  onReceive: (transferId: number) => void;
  onCancel?: (transferId: number) => void;
  onView: (transfer: StockTransfer) => void;
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

  const getStatusConfig = (status: string): {
    label: string;
    tone: BadgeTone;
    stripeClass: string;
    icon: React.ReactNode;
  } => {
    switch (status) {
      case StockTransferStatus.IN_TRANSIT:
        return {
          label: 'في الطريق',
          tone: 'info',
          stripeClass: 'border-r-4 border-r-info',
          icon: <Clock className="w-3.5 h-3.5" />,
        };
      case StockTransferStatus.RECEIVED:
        return {
          label: 'تم الاستلام',
          tone: 'ok',
          stripeClass: 'border-r-4 border-r-ok',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
      case StockTransferStatus.CANCELLED:
        return {
          label: 'ملغي',
          tone: 'bad',
          stripeClass: 'border-r-4 border-r-bad',
          icon: <XCircle className="w-3.5 h-3.5" />,
        };
      default:
        return {
          label: status,
          tone: 'neutral',
          stripeClass: 'border-r-4 border-r-line-2',
          icon: <ArrowLeftRight className="w-3.5 h-3.5" />,
        };
    }
  };

  const statusConfig = getStatusConfig(transfer.status);
  const items = transfer.items || [];
  const totalQuantity = items.reduce((sum: number, item: any) => sum + (Number(item.quantity_sent) || 0), 0);

  return (
    <Card className={`p-0 sm:p-0 overflow-hidden ${statusConfig.stripeClass}`}>
      {/* Header: Number, Date, Status Badge */}
      <div className="p-3.5 pb-2.5 flex items-start justify-between gap-2 border-b border-line">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums font-black text-sm text-ink tracking-tight">
              #{transfer.transfer_number}
            </span>
          </div>
          <p className="text-2xs text-muted font-medium mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted" />
            {transfer.transferred_at ? new Date(transfer.transferred_at).toLocaleString('ar-EG') : '-'}
          </p>
        </div>

        <Badge tone={statusConfig.tone} className="gap-1 py-1 text-2xs">
          {statusConfig.icon}
          {statusConfig.label}
        </Badge>
      </div>

      {/* Body: Route visualizer */}
      <div className="p-3.5 space-y-3">
        {/* Route track */}
        <div className="bg-surface-2/80 rounded-xl p-3 border border-line">
          <div className="flex items-center justify-between gap-2 text-xs">
            {/* From branch */}
            <div className="flex-1 min-w-0">
              <span className="text-2xs text-muted font-semibold block mb-0.5">فرع المصدر (من)</span>
              <div className="flex items-center gap-1.5 text-ink font-bold truncate">
                <div className="w-6 h-6 rounded-lg bg-surface-2 border border-line text-muted flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{transfer.from_branch?.name || '-'}</span>
              </div>
            </div>

            {/* Direction Arrow */}
            <div className="px-2 shrink-0 flex flex-col items-center justify-center text-brand-ink">
              <div className="w-7 h-7 rounded-full bg-brand-soft border border-brand/25 flex items-center justify-center">
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* To branch */}
            <div className="flex-1 min-w-0 text-left">
              <span className="text-2xs text-muted font-semibold block mb-0.5">فرع الوجهة (إلى)</span>
              <div className="flex items-center justify-end gap-1.5 text-brand-ink font-bold truncate">
                <span className="truncate">{transfer.to_branch?.name || '-'}</span>
                <div className="w-6 h-6 rounded-lg bg-brand-soft text-brand-ink flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items summary & collapsible detail */}
        <div className="bg-surface-2/50 rounded-xl border border-line overflow-hidden">
          <button
            type="button"
            onClick={() => setItemsExpanded(!itemsExpanded)}
            className="w-full min-h-[44px] p-2.5 flex items-center justify-between text-xs font-semibold text-ink hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted" />
              <span>الأصناف المحولة:</span>
              <Badge tone="neutral" className="text-2xs tabular-nums">
                {items.length} صنف ({totalQuantity} قطعة)
              </Badge>
            </div>
            {itemsExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted" />
            )}
          </button>

          {itemsExpanded && (
            <div className="p-3 pt-2 border-t border-line space-y-2">
              {items.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="flex items-center justify-between text-xs bg-panel p-2 rounded-lg border border-line"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-ink truncate">{item.product?.name || 'صنف'}</p>
                    {item.variant && (
                      <p className="text-2xs text-brand-ink font-medium mt-0.5">
                        مقاس: {item.variant.size || '-'} | لون: {item.variant.color || '-'}
                      </p>
                    )}
                  </div>
                  <span className="tabular-nums font-bold text-ink shrink-0 mr-2 bg-surface-2 px-2 py-0.5 rounded border border-line">
                    {item.quantity_sent} {item.unit_name || 'قطعة'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes if any */}
        {transfer.notes && (
          <div className="flex items-start gap-1.5 p-2.5 bg-warn-soft border border-warn/25 rounded-xl text-2xs text-warn">
            <FileText className="w-3.5 h-3.5 text-warn shrink-0 mt-0.5" />
            <span className="line-clamp-2">{transfer.notes}</span>
          </div>
        )}
      </div>

      {/* Action footer: 44px touch targets */}
      <div className="p-3 bg-surface-2/60 border-t border-line flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => onView(transfer)}
          leftIcon={<Eye className="w-4 h-4 text-muted" />}
          className="px-3.5 text-xs"
        >
          <span>تفاصيل</span>
        </Button>

        <div className="flex items-center gap-2">
          {transfer.status === StockTransferStatus.IN_TRANSIT && canCancel && onCancel && (
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => onCancel(transfer.id)}
              className="px-3 text-xs bg-bad-soft border border-bad/25 text-bad hover:bg-bad/15"
            >
              إلغاء
            </Button>
          )}

          {transfer.status === StockTransferStatus.IN_TRANSIT && (
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={isReceiving}
              onClick={() => onReceive(transfer.id)}
              leftIcon={<Check className="w-4 h-4" />}
              className="px-4 text-xs bg-ok hover:bg-ok/90 text-on-brand"
            >
              <span>{isReceiving ? 'جاري التأكيد...' : 'تأكيد الاستلام'}</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
