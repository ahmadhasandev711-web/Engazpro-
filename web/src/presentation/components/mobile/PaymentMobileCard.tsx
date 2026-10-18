import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Trash2, User, FileText, CreditCard, Printer } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';

interface PaymentMobileCardProps {
  payment: any;
  isOwner?: boolean;
  canDelete?: boolean;
  onDelete?: (id: number) => void;
  onPrint?: (payment: any) => void;
}

export const PaymentMobileCard: React.FC<PaymentMobileCardProps> = ({
  payment,
  isOwner = false,
  canDelete = false,
  onDelete,
  onPrint,
}) => {
  const isReceipt = payment.type === 'RECEIPT';

  const methodLabel =
    payment.method === 'CASH'
      ? 'كاش (نقدية)'
      : payment.method === 'CARD'
      ? 'بطاقة / فيزا'
      : payment.method === 'INSTAPAY'
      ? 'إنستاباي'
      : payment.method === 'VODAFONE_CASH'
      ? 'فودافون كاش'
      : payment.method === 'TRANSFER'
      ? 'تحويل بنكي'
      : payment.method;

  const roleLabel =
    payment.created_by_role === 'MANDOB'
      ? 'مندوب'
      : payment.created_by_role === 'CASHIER'
      ? 'كاشير'
      : payment.created_by_role === 'MANAGER'
      ? 'مدير'
      : payment.created_by_role === 'SUPERVISOR'
      ? 'مشرف'
      : 'إدارة';

  return (
    <div
      className={`bg-white rounded-2xl border p-4 shadow-xs space-y-3 transition-all duration-200 border-r-4 ${
        isReceipt
          ? 'border-r-emerald-500 border-slate-200/90'
          : 'border-r-rose-500 border-slate-200/90'
      }`}
    >
      {/* Header: Type Badge, ID, Date */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border ${
              isReceipt
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {isReceipt ? (
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
            )}
            {isReceipt ? 'سند قبض' : 'سند صرف'}
          </span>
          <span className="font-mono text-xs font-bold text-slate-400">#{payment.id}</span>
        </div>

        <span className="text-xs text-slate-400 font-mono">{payment.date}</span>
      </div>

      {/* Middle: Party & Amount */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-black text-slate-900 text-sm truncate">
            {payment.party_name || 'بدون طرف تعامل'}
          </h4>
          {isOwner && payment.created_by_name && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 font-medium truncate">
              <User className="w-3 h-3 text-slate-400 shrink-0" />
              <span>المحصّل:</span>
              <span className="font-bold text-slate-700">{payment.created_by_name}</span>
              <span className="text-[10px] text-slate-400">({roleLabel})</span>
            </div>
          )}
        </div>

        <div className="text-left shrink-0">
          <span
            className={`text-base font-black font-mono tracking-tight ${
              isReceipt ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {isReceipt ? '+' : '-'} {formatCurrency(payment.amount)}
          </span>
        </div>
      </div>

      {/* Footer: Payment Method & Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl font-bold text-[11px]">
          <CreditCard className="w-3 h-3 text-slate-500" />
          {methodLabel}
        </span>

        <div className="flex items-center gap-1.5">
          {onPrint && (
            <button
              type="button"
              onClick={() => onPrint(payment)}
              className="min-h-[44px] px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl flex items-center gap-1.5 border border-slate-200 active:scale-95 transition-all"
              title="طباعة / مشاركة الإيصال"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>إيصال</span>
            </button>
          )}

          {canDelete && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(payment.id)}
              className="min-h-[44px] px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-xl flex items-center gap-1.5 border border-rose-200/80 active:scale-95 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>إلغاء</span>
            </button>
          )}
        </div>
      </div>

      {/* Notes if present */}
      {payment.notes && (
        <div className="flex items-start gap-1.5 p-2 bg-slate-50 rounded-xl text-[11px] text-slate-600 border border-slate-100">
          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed line-clamp-2">{payment.notes}</p>
        </div>
      )}
    </div>
  );
};
