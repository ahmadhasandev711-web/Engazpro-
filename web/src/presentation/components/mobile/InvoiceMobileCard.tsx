import React from 'react';
import {
  Calendar,
  User,
  Printer,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  ArrowLeftRight,
} from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { useHaptic } from '../../hooks/useHaptic';
import { Badge, Button, Card } from '../ui';

interface InvoiceMobileCardProps {
  invoice: any;
  isReturn: boolean;
  isOwnerOrAdmin: boolean;
  isManager: boolean;
  canDeleteInvoice: boolean;
  onSelectInvoice: (invoiceId: number) => void;
  onPrintReceipt: (invoiceId: number) => void;
  onDeleteInvoice: (invoiceId: number, invoiceNumber: string) => void;
  onQuickReturn?: (invoice: any) => void;
  onExchange?: (invoice: any) => void;
}

/**
 * Presentation Layer - InvoiceMobileCard
 * Mobile-first card for sales, returns, and purchase invoices.
 * Touch targets >= 44px, status stripe, and role-based metadata.
 */
export const InvoiceMobileCard: React.FC<InvoiceMobileCardProps> = ({
  invoice,
  isReturn,
  isOwnerOrAdmin,
  isManager,
  canDeleteInvoice,
  onSelectInvoice,
  onPrintReceipt,
  onDeleteInvoice,
  onQuickReturn,
  onExchange,
}) => {
  const { selection } = useHaptic();

  const isDue = Number(invoice.due_amount) > 0;
  const statusBorder = isReturn
    ? 'border-r-warn'
    : isDue
      ? 'border-r-bad'
      : 'border-r-ok';

  const isPurchaseDoc =
    invoice.type === 'PURCHASE' || invoice.type === 'PURCHASE_RETURN';
  const salesperson = isPurchaseDoc
    ? invoice.created_by_name
    : invoice.salesperson_name || invoice.created_by_name;

  return (
    <Card
      onClick={() => {
        selection();
        onSelectInvoice(invoice.id);
      }}
      className={`p-4 border-r-4 ${statusBorder} space-y-3 cursor-pointer active:scale-[0.99] transition-all`}
      dir="rtl"
    >
      {/* 1. Header: Document Number, Status Badge & Date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="neutral" className="tabular-nums font-black text-ink">
            {invoice.invoice_number}
          </Badge>

          {!isReturn && invoice.return_status === 'FULL' && (
            <Badge tone="bad" className="text-[11px]">
              <RotateCcw className="w-3 h-3" />
              مرتجع بالكامل
            </Badge>
          )}
          {!isReturn && invoice.return_status === 'PARTIAL' && (
            <Badge tone="warn" className="text-[11px] tabular-nums">
              <RotateCcw className="w-3 h-3" />
              مرتجع جزئي: {formatCurrency(invoice.returned_total ?? 0)}
            </Badge>
          )}
          {isReturn && invoice.parent_invoice_number && (
            <Badge tone="info" className="text-[11px] tabular-nums">
              أصل: {invoice.parent_invoice_number}
            </Badge>
          )}

          {isReturn ? (
            <Badge tone="warn" className="text-[11px]">
              <RotateCcw className="w-3 h-3" />
              مرتجع
            </Badge>
          ) : isDue ? (
            <Badge tone="bad" className="text-[11px] tabular-nums">
              <AlertCircle className="w-3 h-3" />
              متبقي: {formatCurrency(invoice.due_amount)}
            </Badge>
          ) : (
            <Badge tone="ok" className="text-[11px]">
              <CheckCircle2 className="w-3 h-3" />
              مسدد
            </Badge>
          )}
        </div>

        <span className="text-[11px] text-muted tabular-nums flex items-center gap-1 shrink-0">
          <Calendar className="w-3 h-3 text-muted" />
          {invoice.date}
        </span>
      </div>

      {/* 2. Customer / Party & Salesperson Row */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <User className="w-3.5 h-3.5 text-muted shrink-0" />
          <span className="font-bold text-ink truncate">
            {invoice.party_name || 'نقدي (بدون حساب)'}
          </span>
        </div>

        {(isOwnerOrAdmin || isManager) && salesperson && (
          <Badge tone="info" className="text-[11px] shrink-0">
            {!isPurchaseDoc && invoice.salesperson_name
              ? `سيلز: ${invoice.salesperson_name}`
              : `المنشئ: ${invoice.created_by_name}`}
          </Badge>
        )}
      </div>

      {/* 3. Financial Breakdown Box */}
      <div className="flex items-center justify-between p-2.5 bg-surface-2/80 rounded-xl border border-line text-xs">
        <div>
          <span className="text-muted block text-[11px] font-medium">الإجمالي</span>
          <span
            className={`font-black text-sm tabular-nums block ${
              isReturn ? 'text-warn' : 'text-ok'
            }`}
          >
            {formatCurrency(invoice.total)}
          </span>
        </div>

        <div>
          <span className="text-muted block text-[11px] font-medium">
            {isReturn ? 'المسترد' : 'المدفوع'}
          </span>
          <span className="font-bold text-ink tabular-nums text-xs block">
            {formatCurrency(invoice.paid_amount)}
          </span>
        </div>

        {isDue && (
          <div>
            <span className="text-bad block text-[11px] font-medium">الباقي</span>
            <span className="font-black text-bad tabular-nums text-xs block">
              {formatCurrency(invoice.due_amount)}
            </span>
          </div>
        )}
      </div>

      {/* 4. Action Buttons (Touch Targets >= 44px) */}
      <div
        className="flex flex-wrap items-center justify-end gap-1.5 pt-1.5 border-t border-line"
        onClick={(e) => e.stopPropagation()}
      >
        {!isReturn && invoice.return_status !== 'FULL' && onQuickReturn && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              selection();
              onQuickReturn(invoice);
            }}
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-warn" />}
            className="text-xs font-bold border-warn/30 bg-warn-soft text-warn hover:bg-warn-soft/80 px-3"
            title="عمل مرتجع لهذه الفاتورة"
          >
            مرتجع
          </Button>
        )}

        {!isReturn && invoice.return_status !== 'FULL' && onExchange && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              selection();
              onExchange(invoice);
            }}
            leftIcon={<ArrowLeftRight className="w-3.5 h-3.5 text-brand" />}
            className="text-xs font-bold border-brand/30 bg-brand-soft text-brand-ink hover:bg-brand-soft/80 px-3"
            title="استبدال لهذه الفاتورة"
          >
            استبدال
          </Button>
        )}

        {/* Thermal Receipt Print */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {
            selection();
            onPrintReceipt(invoice.id);
          }}
          leftIcon={<Printer className="w-3.5 h-3.5 text-ok" />}
          className="text-xs font-bold border-ok/30 bg-ok-soft text-ok hover:bg-ok-soft/80 px-3"
          title="طباعة إيصال كاشير حراري (80mm)"
        >
          إيصال
        </Button>

        {/* View Details */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {
            selection();
            onSelectInvoice(invoice.id);
          }}
          leftIcon={<Eye className="w-3.5 h-3.5" />}
          className="text-xs font-bold px-3"
          title="عرض تفاصيل الفاتورة"
        >
          معاينة
        </Button>

        {/* Delete Invoice (Protected by RBAC) */}
        {canDeleteInvoice && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              selection();
              onDeleteInvoice(invoice.id, invoice.invoice_number);
            }}
            className="text-xs font-bold border-bad/30 bg-bad-soft text-bad hover:bg-bad-soft/80 px-2.5"
            title="إلغاء وحذف الفاتورة"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
};
