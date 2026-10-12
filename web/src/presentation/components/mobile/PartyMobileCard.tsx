import React from 'react';
import { Phone, MapPin, Receipt, FileText, Edit2, Trash2, User, Truck } from 'lucide-react';
import { Party, formatCurrency } from '@pos-mandob/shared';

interface PartyMobileCardProps {
  party: Party;
  isSupplier: boolean;
  onEdit: (party: Party) => void;
  onDelete: (party: Party) => void;
  onLedger: (party: Party) => void;
  canDelete?: boolean;
}

export const PartyMobileCard: React.FC<PartyMobileCardProps> = ({
  party,
  isSupplier,
  onEdit,
  onDelete,
  onLedger,
  canDelete = false,
}) => {
  const isPositive = Number(party.balance) > 0;
  const isNegative = Number(party.balance) < 0;

  // Stripe & Badge Config
  let stripeClass = 'border-r-4 border-r-slate-300';
  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
  let balanceLabel = 'خالص';

  if (isPositive) {
    if (isSupplier) {
      stripeClass = 'border-r-4 border-r-rose-500';
      badgeClass = 'bg-rose-100 text-rose-800 border-rose-200';
      balanceLabel = 'مستحق له';
    } else {
      stripeClass = 'border-r-4 border-r-emerald-500';
      badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      balanceLabel = 'مديونية عليه';
    }
  } else if (isNegative) {
    stripeClass = 'border-r-4 border-r-blue-500';
    badgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
    balanceLabel = isSupplier ? 'رصيد دائن لنا' : 'رصيد دائن له';
  }

  const cleanPhone = party.phone ? party.phone.replace(/\D/g, '') : '';

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200 ${stripeClass}`}
    >
      {/* Header: Name, Address, Balance Badge */}
      <div className="p-3.5 pb-2.5 flex items-start justify-between gap-2 border-b border-slate-100">
        <div className="min-w-0 flex items-start gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              isSupplier ? 'bg-amber-50 text-amber-600' : 'bg-primary-50 text-primary-600'
            }`}
          >
            {isSupplier ? <Truck className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-slate-900 text-sm truncate">{party.name}</h4>
            {party.address ? (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{party.address}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-0.5">بدون عنوان مسجل</p>
            )}
          </div>
        </div>

        {/* Financial Badge */}
        <div className="text-left shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border font-mono ${badgeClass}`}
          >
            {formatCurrency(party.balance)}
          </span>
          <span className="block text-[10px] text-slate-400 font-medium text-center mt-0.5">
            {balanceLabel}
          </span>
        </div>
      </div>

      {/* Middle: Phone & WhatsApp Direct Actions */}
      <div className="p-3.5 pt-2.5 space-y-2.5">
        {party.phone ? (
          <div className="flex items-center gap-2">
            {/* Direct Phone Call Button */}
            <a
              href={`tel:${party.phone}`}
              className="flex-1 min-h-[44px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-emerald-200/80 active:scale-98 transition-all"
            >
              <Phone className="w-4 h-4 text-emerald-600" />
              <span dir="ltr" className="font-mono text-xs">{party.phone}</span>
            </a>

            {/* Direct WhatsApp Button */}
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noreferrer"
              className="min-h-[44px] px-3.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-2xs"
              title="مراسلة واتساب"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
              </svg>
            </a>

            {/* Secondary Phone if available */}
            {party.phone2 && (
              <a
                href={`tel:${party.phone2}`}
                className="min-h-[44px] px-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl flex items-center justify-center active:scale-95 transition-all text-xs font-bold"
                title={`هاتف إضافي: ${party.phone2}`}
              >
                <Phone className="w-3.5 h-3.5 text-slate-500 ml-1" />
                <span dir="ltr" className="font-mono text-[11px]">2</span>
              </a>
            )}
          </div>
        ) : (
          <div className="py-1 text-center text-slate-400 text-xs">
            لا يوجد رقم هاتف مسجل
          </div>
        )}

        {/* Invoices Count & Notes */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span className="flex items-center gap-1 font-medium">
            <Receipt className="w-3.5 h-3.5 text-slate-400" />
            <span>عدد الفواتير:</span>
            <span className="font-bold text-slate-800 font-mono">{party.invoices_count || 0}</span>
          </span>

          {party.notes && (
            <span className="text-[11px] text-slate-400 truncate max-w-[180px]" title={party.notes}>
              {party.notes}
            </span>
          )}
        </div>
      </div>

      {/* Action Footer: 44px Touch Targets */}
      <div className="p-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
        {/* Ledger button */}
        <button
          type="button"
          onClick={() => onLedger(party)}
          className="min-h-[44px] flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all"
        >
          <FileText className="w-4 h-4 text-emerald-600" />
          <span>كشف الحساب</span>
        </button>

        {/* Edit button */}
        <button
          type="button"
          onClick={() => onEdit(party)}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all"
        >
          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
          <span>تعديل</span>
        </button>

        {/* Delete button (if permitted) */}
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(party)}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 active:bg-rose-200 text-xs font-bold flex items-center justify-center active:scale-95 transition-all"
            title="حذف جهة التعامل"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
