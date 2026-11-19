import React from 'react';
import { Phone, MapPin, Receipt, FileText, Edit2, Trash2, User, Truck, MessageSquare } from 'lucide-react';
import { Party, formatCurrency } from '@pos-mandob/shared';
import { Badge, BadgeTone, Button, Card } from '../ui';
import { CustomerRiskBadge } from '../crm/CustomerRiskBadge';

interface PartyMobileCardProps {
  party: Party;
  isSupplier: boolean;
  onEdit: (party: Party) => void;
  onDelete: (party: Party) => void;
  onLedger: (party: Party) => void;
  onOpenCrm?: (party: Party) => void;
  canDelete?: boolean;
}

export const PartyMobileCard: React.FC<PartyMobileCardProps> = ({
  party,
  isSupplier,
  onEdit,
  onDelete,
  onLedger,
  onOpenCrm,
  canDelete = false,
}) => {
  const isPositive = Number(party.balance) > 0;
  const isNegative = Number(party.balance) < 0;

  let stripeClass = 'border-r-line-2';
  let badgeTone: BadgeTone = 'neutral';
  let balanceLabel = 'خالص';

  if (isPositive) {
    if (isSupplier) {
      stripeClass = 'border-r-bad';
      badgeTone = 'bad';
      balanceLabel = 'مستحق له';
    } else {
      stripeClass = 'border-r-ok';
      badgeTone = 'ok';
      balanceLabel = 'مديونية عليه';
    }
  } else if (isNegative) {
    stripeClass = 'border-r-info';
    badgeTone = 'info';
    balanceLabel = isSupplier ? 'رصيد دائن لنا' : 'رصيد دائن له';
  }

  const cleanPhone = party.phone ? party.phone.replace(/\D/g, '') : '';

  return (
    <Card
      className={`p-0 sm:p-0 border-r-4 ${stripeClass} overflow-hidden transition-all duration-200`}
      dir="rtl"
    >
      {/* Header: Name, Address, Balance Badge */}
      <div className="p-3.5 pb-2.5 flex items-start justify-between gap-2 border-b border-line">
        <div className="min-w-0 flex items-start gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              isSupplier ? 'bg-warn-soft text-warn' : 'bg-brand-soft text-brand'
            }`}
          >
            {isSupplier ? <Truck className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-ink text-sm truncate">{party.name}</h4>
            {party.address ? (
              <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 text-muted shrink-0" />
                <span className="truncate">{party.address}</span>
              </p>
            ) : (
              <p className="text-[11px] text-muted mt-0.5">بدون عنوان مسجل</p>
            )}
            {!isSupplier && party.crm_metrics && (
              <div className="mt-1.5">
                <CustomerRiskBadge metrics={party.crm_metrics} variant="compact" />
              </div>
            )}
          </div>
        </div>

        {/* Financial Badge */}
        <div className="text-left shrink-0">
          <Badge tone={badgeTone} className="font-black tabular-nums">
            {formatCurrency(party.balance)}
          </Badge>
          <span className="block text-[11px] text-muted font-medium text-center mt-0.5">
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
              className="flex-1 min-h-[44px] px-3.5 py-2 bg-ok-soft hover:bg-ok-soft/80 text-ok font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-ok/30 active:scale-[0.98] transition-all"
            >
              <Phone className="w-4 h-4 text-ok" />
              <span dir="ltr" className="tabular-nums text-xs">
                {party.phone}
              </span>
            </a>

            {/* Direct WhatsApp Button */}
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noreferrer"
              className="min-h-[44px] min-w-[44px] px-3.5 bg-ok hover:opacity-95 text-on-brand rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-xs"
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
                className="min-h-[44px] min-w-[44px] px-3 bg-surface-2 hover:bg-line text-ink rounded-xl flex items-center justify-center active:scale-95 transition-all text-xs font-bold border border-line"
                title={`هاتف إضافي: ${party.phone2}`}
              >
                <Phone className="w-3.5 h-3.5 text-muted ml-1" />
                <span dir="ltr" className="tabular-nums text-[11px]">
                  2
                </span>
              </a>
            )}
          </div>
        ) : (
          <div className="py-1 text-center text-muted text-xs">لا يوجد رقم هاتف مسجل</div>
        )}

        {/* Invoices Count & Notes */}
        <div className="flex items-center justify-between text-xs text-muted pt-1">
          <span className="flex items-center gap-1 font-medium">
            <Receipt className="w-3.5 h-3.5 text-muted" />
            <span>عدد الفواتير:</span>
            <span className="font-bold text-ink tabular-nums">{party.invoices_count || 0}</span>
          </span>

          {party.notes && (
            <span className="text-[11px] text-muted truncate max-w-[180px]" title={party.notes}>
              {party.notes}
            </span>
          )}
        </div>
      </div>

      {/* Action Footer: 44px Touch Targets */}
      <div className="p-2.5 bg-surface-2/60 border-t border-line flex items-center justify-between gap-2">
        {/* Ledger button */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => onLedger(party)}
          leftIcon={<FileText className="w-4 h-4 text-ok" />}
          className="flex-1 bg-panel text-ok border-ok/30 hover:bg-ok-soft text-xs font-bold"
        >
          كشف الحساب
        </Button>

        {!isSupplier && onOpenCrm && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => onOpenCrm(party)}
            leftIcon={<MessageSquare className="w-3.5 h-3.5 text-brand" />}
            className="bg-panel text-brand border-brand/30 hover:bg-brand-soft text-xs font-bold px-3"
          >
            CRM
          </Button>
        )}

        {/* Edit button */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => onEdit(party)}
          leftIcon={<Edit2 className="w-3.5 h-3.5 text-muted" />}
          className="bg-panel text-xs font-bold px-3.5"
        >
          تعديل
        </Button>

        {/* Delete button (if permitted) */}
        {canDelete && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => onDelete(party)}
            className="bg-bad-soft border-bad/30 text-bad hover:bg-bad-soft/80 text-xs font-bold px-3"
            title="حذف جهة التعامل"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  );
};
