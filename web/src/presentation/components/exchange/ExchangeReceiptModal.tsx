import React from 'react';
import { ExchangeRecord, formatCurrency } from '@pos-mandob/shared';
import { Printer, X, ArrowLeftRight } from 'lucide-react';
import { Button, Badge } from '../ui';

interface ExchangeReceiptModalProps {
  exchange: ExchangeRecord | null;
  onClose: () => void;
}

export const ExchangeReceiptModal: React.FC<ExchangeReceiptModalProps> = ({ exchange, onClose }) => {
  if (!exchange) return null;

  const returned = (exchange.items || []).filter((i) => i.direction === 'RETURNED');
  const replacement = (exchange.items || []).filter((i) => i.direction === 'REPLACEMENT');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm p-4"
      dir="rtl"
    >
      <div className="bg-panel text-ink rounded-2xl max-w-md w-full border border-line shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line print:hidden">
          <div className="flex items-center gap-2 font-black text-sm">
            <ArrowLeftRight className="w-4 h-4 text-brand" />
            <span>إيصال استبدال {exchange.exchange_number}</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 text-xs bg-surface-2/40 print:bg-paper print:text-paper-ink">
          <div className="text-center border-b border-dashed border-line pb-3 space-y-1">
            <h3 className="text-base font-black">سند وإيصال استبدال</h3>
            <p className="font-bold tabular-nums text-brand">{exchange.exchange_number}</p>
            {exchange.original_invoice_number && (
              <p className="text-muted tabular-nums">أصل الفاتورة: {exchange.original_invoice_number}</p>
            )}
            <p className="text-muted">العميل: {exchange.party_name || 'عميل نقدي'}</p>
            {exchange.branch_name && <p className="text-muted">الفرع: {exchange.branch_name}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="font-black text-warn flex items-center justify-between">
              <span>القطع المرتجعة</span>
              <span className="tabular-nums">{formatCurrency(exchange.return_total)}</span>
            </div>
            {returned.map((item) => (
              <div key={item.id} className="flex justify-between items-center bg-panel p-2 rounded-lg border border-line">
                <div>
                  <span className="font-bold">{item.product_name}</span>
                  {item.variant_name && <span className="text-muted mr-1">({item.variant_name})</span>}
                  {item.condition === 'DAMAGED' && (
                    <Badge tone="bad" className="mr-1.5 text-[10px]">تالف</Badge>
                  )}
                </div>
                <span className="tabular-nums font-bold">
                  {item.quantity} × {formatCurrency(item.unit_price)}
                </span>
              </div>
            ))}
          </div>

          {replacement.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-dashed border-line">
              <div className="font-black text-ok flex items-center justify-between">
                <span>القطع البديلة</span>
                <span className="tabular-nums">{formatCurrency(exchange.replacement_total)}</span>
              </div>
              {replacement.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-panel p-2 rounded-lg border border-line">
                  <div>
                    <span className="font-bold">{item.product_name}</span>
                    {item.variant_name && <span className="text-muted mr-1">({item.variant_name})</span>}
                  </div>
                  <span className="tabular-nums font-bold">
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-dashed border-line space-y-1.5 font-bold">
            {exchange.exchange_shipping_fee > 0 && (
              <div className="flex justify-between text-muted">
                <span>شحن الاستبدال:</span>
                <span className="tabular-nums">{formatCurrency(exchange.exchange_shipping_fee)}</span>
              </div>
            )}
            {exchange.store_credit_used > 0 && (
              <div className="flex justify-between text-info">
                <span>مخصوم من المحفظة:</span>
                <span className="tabular-nums">-{formatCurrency(exchange.store_credit_used)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black pt-1 border-t border-line">
              <span>
                {exchange.net_amount > 0
                  ? 'صافي فرق محصل من العميل:'
                  : exchange.net_amount < 0
                    ? exchange.settlement_type === 'STORE_CREDIT'
                      ? 'صافي مُضاف لمحفظة العميل:'
                      : 'صافي فرق مسترد للعميل:'
                    : 'استبدال متساوي:'}
              </span>
              <span className="tabular-nums text-brand">
                {formatCurrency(Math.abs(exchange.net_amount))}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line print:hidden">
          <Button type="button" variant="secondary" size="md" onClick={() => window.print()} leftIcon={<Printer className="w-4 h-4" />}>
            طباعة (80mm)
          </Button>
          <Button type="button" variant="primary" size="md" onClick={onClose}>
            تم
          </Button>
        </div>
      </div>
    </div>
  );
};
