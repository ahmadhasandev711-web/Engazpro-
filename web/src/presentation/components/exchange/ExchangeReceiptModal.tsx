import React from 'react';
import { ExchangeRecord, formatCurrency } from '@pos-mandob/shared';
import { Printer, X, ArrowLeftRight } from 'lucide-react';
import { useAuthStore } from '../../../data/store/useAuthStore';
import { Button, Badge } from '../ui';

interface ExchangeReceiptModalProps {
  exchange: ExchangeRecord | null;
  onClose: () => void;
}

export const ExchangeReceiptModal: React.FC<ExchangeReceiptModalProps> = ({ exchange, onClose }) => {
  const user = useAuthStore((state) => state.user);
  if (!exchange) return null;

  const storeIdentity = user?.store_identity;
  const storeName = storeIdentity?.business_name || (user as any)?.store_name || user?.name || 'متجر Easyfy';
  const storePhone = storeIdentity?.store_phone || user?.phone;
  const storeAddress = storeIdentity?.store_address;
  const currencySymbol = storeIdentity?.currency || 'ج.م';

  const returned = (exchange.items || []).filter((i) => i.direction === 'RETURNED');
  const replacement = (exchange.items || []).filter((i) => i.direction === 'REPLACEMENT');
  const dateLabel = exchange.created_at
    ? new Date(exchange.created_at).toLocaleString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm p-4"
      dir="rtl"
    >
      <div className="bg-panel text-ink rounded-2xl max-w-md w-full border border-line shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line no-print">
          <div className="flex items-center gap-2 font-black text-sm">
            <ArrowLeftRight className="w-4 h-4 text-brand" />
            <span>إيصال استبدال {exchange.exchange_number}</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto bg-surface-2/40 flex justify-center">
          <div
            id="exchange-thermal-receipt"
            className="thermal-receipt-sheet w-full bg-paper p-5 rounded-2xl border border-paper-line shadow-sm text-paper-ink font-sans text-xs leading-relaxed space-y-3"
            dir="rtl"
          >
            <div className="text-center border-b border-dashed border-paper-line pb-3 space-y-1">
              <h2 className="text-base font-black text-paper-ink">{storeName}</h2>
              {storePhone && <p className="text-2xs text-paper-muted font-mono">هاتف: {storePhone}</p>}
              {storeAddress && <p className="text-2xs text-paper-muted">{storeAddress}</p>}
              <div className="pt-1">
                <h3 className="text-sm font-black text-paper-ink">سند وإيصال استبدال</h3>
                <p className="font-bold tabular-nums text-paper-ink">{exchange.exchange_number}</p>
              </div>
              {dateLabel && <p className="text-2xs text-paper-muted tabular-nums">{dateLabel}</p>}
              {exchange.original_invoice_number && (
                <p className="text-paper-muted tabular-nums">أصل الفاتورة: {exchange.original_invoice_number}</p>
              )}
              {exchange.original_online_order_number && (
                <p className="text-paper-muted tabular-nums">طلب أونلاين: {exchange.original_online_order_number}</p>
              )}
              <p className="text-paper-muted">العميل: {exchange.party_name || 'عميل نقدي'}</p>
              {exchange.branch_name && <p className="text-paper-muted">الفرع: {exchange.branch_name}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="font-black text-paper-ink flex items-center justify-between">
                <span>القطع المرتجعة</span>
                <span className="tabular-nums">{formatCurrency(exchange.return_total, currencySymbol)}</span>
              </div>
              {returned.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center bg-surface-1/40 p-2 rounded-lg border border-paper-line/60"
                >
                  <div>
                    <span className="font-bold text-paper-ink">{item.product_name}</span>
                    {item.variant_name && <span className="text-paper-muted mr-1">({item.variant_name})</span>}
                    {item.condition === 'DAMAGED' && (
                      <Badge tone="bad" className="mr-1.5 text-[10px]">تالف</Badge>
                    )}
                  </div>
                  <span className="tabular-nums font-bold text-paper-ink">
                    {item.quantity} × {formatCurrency(item.unit_price, currencySymbol)}
                  </span>
                </div>
              ))}
            </div>

            {replacement.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-dashed border-paper-line">
                <div className="font-black text-paper-ink flex items-center justify-between">
                  <span>القطع البديلة</span>
                  <span className="tabular-nums">{formatCurrency(exchange.replacement_total, currencySymbol)}</span>
                </div>
                {replacement.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-surface-1/40 p-2 rounded-lg border border-paper-line/60"
                  >
                    <div>
                      <span className="font-bold text-paper-ink">{item.product_name}</span>
                      {item.variant_name && <span className="text-paper-muted mr-1">({item.variant_name})</span>}
                    </div>
                    <span className="tabular-nums font-bold text-paper-ink">
                      {item.quantity} × {formatCurrency(item.unit_price, currencySymbol)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-dashed border-paper-line space-y-1.5 font-bold">
              {exchange.exchange_shipping_fee > 0 && (
                <div className="flex justify-between text-paper-muted">
                  <span>شحن الاستبدال:</span>
                  <span className="tabular-nums">{formatCurrency(exchange.exchange_shipping_fee, currencySymbol)}</span>
                </div>
              )}
              {exchange.store_credit_used > 0 && (
                <div className="flex justify-between text-paper-ink">
                  <span>مخصوم من المحفظة:</span>
                  <span className="tabular-nums">-{formatCurrency(exchange.store_credit_used, currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black pt-1 border-t border-paper-line text-paper-ink">
                <span>
                  {exchange.net_amount > 0
                    ? 'صافي فرق محصل من العميل:'
                    : exchange.net_amount < 0
                      ? exchange.settlement_type === 'STORE_CREDIT'
                        ? 'صافي مُضاف لمحفظة العميل:'
                        : 'صافي فرق مسترد للعميل:'
                      : 'استبدال متساوي:'}
                </span>
                <span className="tabular-nums">
                  {formatCurrency(Math.abs(exchange.net_amount), currencySymbol)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-dashed border-paper-line text-center text-2xs text-paper-muted space-y-0.5">
              <p className="font-bold text-paper-ink">شكراً لتعاملكم معنا!</p>
              <p className="font-mono text-2xs">نظام Easyfy لإدارة نقاط البيع والمخازن</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line no-print">
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
