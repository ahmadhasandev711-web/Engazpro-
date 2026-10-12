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
} from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { MobileCard } from './MobileCard';
import { useHaptic } from '../../hooks/useHaptic';

interface InvoiceMobileCardProps {
  invoice: any;
  isReturn: boolean;
  isOwnerOrAdmin: boolean;
  isManager: boolean;
  canDeleteInvoice: boolean;
  onSelectInvoice: (invoiceId: number) => void;
  onPrintReceipt: (invoiceId: number) => void;
  onDeleteInvoice: (invoiceId: number, invoiceNumber: string) => void;
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
}) => {
  const { selection } = useHaptic();

  const isDue = Number(invoice.due_amount) > 0;
  const statusColor: 'amber' | 'rose' | 'emerald' = isReturn
    ? 'amber'
    : isDue
    ? 'rose'
    : 'emerald';

  const salesperson = invoice.salesperson_name || invoice.created_by_name;

  return (
    <MobileCard
      statusColor={statusColor}
      onClick={() => onSelectInvoice(invoice.id)}
      className="space-y-3"
    >
      {/* 1. Header: Document Number, Status Badge & Date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-xs text-slate-800 bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-lg">
            {invoice.invoice_number}
          </span>

          {isReturn ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
              <RotateCcw className="w-2.5 h-2.5" />
              مرتجع
            </span>
          ) : isDue ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              متبقي: {formatCurrency(invoice.due_amount)}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              مسدد
            </span>
          )}
        </div>

        <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
          <Calendar className="w-3 h-3 text-slate-400" />
          {invoice.date}
        </span>
      </div>

      {/* 2. Customer / Party & Salesperson Row */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-bold text-slate-900 truncate">
            {invoice.party_name || 'نقدي (بدون حساب)'}
          </span>
        </div>

        {(isOwnerOrAdmin || isManager) && salesperson && (
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md shrink-0">
            {invoice.salesperson_name ? `سيلز: ${invoice.salesperson_name}` : `المنشئ: ${invoice.created_by_name}`}
          </span>
        )}
      </div>

      {/* 3. Financial Breakdown Box */}
      <div className="flex items-center justify-between p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
        <div>
          <span className="text-slate-400 block text-[10px] font-medium">الإجمالي</span>
          <span
            className={`font-black text-sm font-mono block ${
              isReturn ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {formatCurrency(invoice.total)}
          </span>
        </div>

        <div>
          <span className="text-slate-400 block text-[10px] font-medium">
            {isReturn ? 'المسترد' : 'المدفوع'}
          </span>
          <span className="font-bold text-slate-700 font-mono text-xs block">
            {formatCurrency(invoice.paid_amount)}
          </span>
        </div>

        {isDue && (
          <div>
            <span className="text-rose-500 block text-[10px] font-medium">الباقي</span>
            <span className="font-black text-rose-600 font-mono text-xs block">
              {formatCurrency(invoice.due_amount)}
            </span>
          </div>
        )}
      </div>

      {/* 4. Action Buttons (Touch Targets >= 44px) */}
      <div
        className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thermal Receipt Print */}
        <button
          type="button"
          onClick={() => {
            selection();
            onPrintReceipt(invoice.id);
          }}
          className="min-h-[42px] px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 rounded-xl flex items-center gap-1.5 border border-emerald-200 transition-all active:scale-95 cursor-pointer"
          title="طباعة إيصال كاشير حراري (80mm)"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>إيصال</span>
        </button>

        {/* View Details */}
        <button
          type="button"
          onClick={() => {
            selection();
            onSelectInvoice(invoice.id);
          }}
          className="min-h-[42px] px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl flex items-center gap-1.5 border border-slate-200 transition-all active:scale-95 cursor-pointer"
          title="عرض تفاصيل الفاتورة"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>معاينة</span>
        </button>

        {/* Delete Invoice (Protected by RBAC) */}
        {canDeleteInvoice && (
          <button
            type="button"
            onClick={() => {
              selection();
              onDeleteInvoice(invoice.id, invoice.invoice_number);
            }}
            className="min-h-[42px] px-2.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-xl flex items-center gap-1 border border-rose-200 transition-all active:scale-95 cursor-pointer"
            title="إلغاء وحذف الفاتورة"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </MobileCard>
  );
};
