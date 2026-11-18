import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Trash2, User, FileText, CreditCard, Printer } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { Badge, Button, Card } from '../ui';
import { getPaymentMethodLabel } from '../../utils/paymentMethodLabels';

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

  const methodLabel = getPaymentMethodLabel(payment.method);

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
    <Card
      className={`p-4 space-y-3 transition-all duration-200 border-r-4 ${
        isReceipt ? 'border-r-ok' : 'border-r-bad'
      }`}
    >
      {/* Header: Type Badge, ID, Date */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={isReceipt ? 'ok' : 'bad'} className="gap-1">
            {isReceipt ? (
              <ArrowDownLeft className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5" />
            )}
            {isReceipt ? 'سند قبض' : 'سند صرف'}
          </Badge>
          <span className="tabular-nums text-xs font-bold text-ink-3">#{payment.id}</span>
        </div>

        <span className="text-xs text-ink-3 tabular-nums">{payment.date}</span>
      </div>

      {/* Middle: Party & Amount */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-black text-ink text-sm truncate">
            {payment.party_name || 'بدون طرف تعامل'}
          </h4>
          {isOwner && payment.created_by_name && (
            <div className="flex items-center gap-1 text-[11px] text-ink-2 mt-0.5 font-medium truncate">
              <User className="w-3 h-3 text-ink-3 shrink-0" />
              <span>المحصّل:</span>
              <span className="font-bold text-ink">{payment.created_by_name}</span>
              <span className="text-[11px] text-ink-3">({roleLabel})</span>
            </div>
          )}
        </div>

        <div className="text-left shrink-0">
          <span
            className={`text-base font-black tabular-nums tracking-tight ${
              isReceipt ? 'text-ok' : 'text-bad'
            }`}
          >
            {isReceipt ? '+' : '-'} {formatCurrency(payment.amount)}
          </span>
        </div>
      </div>

      {/* Footer: Payment Method & Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-line-soft text-xs">
        <Badge tone="neutral" className="gap-1.5">
          <CreditCard className="w-3 h-3 text-ink-3" />
          {methodLabel}
        </Badge>

        <div className="flex items-center gap-1.5">
          {onPrint && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => onPrint(payment)}
              className="px-3 text-xs font-bold gap-1.5"
              title="طباعة / مشاركة الإيصال"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>إيصال</span>
            </Button>
          )}

          {canDelete && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => onDelete(payment.id)}
              className="px-3 text-xs font-bold text-bad bg-bad-soft hover:bg-bad/15 border border-bad/25 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إلغاء</span>
            </Button>
          )}
        </div>
      </div>

      {/* Notes if present */}
      {payment.notes && (
        <div className="flex items-start gap-1.5 p-2 bg-bg-subtle rounded-xl text-[11px] text-ink-2 border border-line-soft">
          <FileText className="w-3.5 h-3.5 text-ink-3 shrink-0 mt-0.5" />
          <p className="leading-relaxed line-clamp-2">{payment.notes}</p>
        </div>
      )}
    </Card>
  );
};
