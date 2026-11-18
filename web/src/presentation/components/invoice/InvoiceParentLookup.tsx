import React from 'react';
import { FileSearch } from 'lucide-react';
import { Invoice, formatCurrency } from '@pos-mandob/shared';
import { Badge, Button, Card, Input } from '../ui';
import { InvoiceItemMeta } from '../common/InvoiceItemMeta';

interface InvoiceParentLookupProps {
  parentInvoice: Invoice | null;
  invoiceLookupNumber: string;
  isSearchingInvoice: boolean;
  onSearchNumberChange: (value: string) => void;
  onSearchInvoice: () => void;
  onClearParentInvoice: () => void;
  onAddItemToReturn: (item: any) => void;
}

export const InvoiceParentLookup: React.FC<InvoiceParentLookupProps> = ({
  parentInvoice,
  invoiceLookupNumber,
  isSearchingInvoice,
  onSearchNumberChange,
  onSearchInvoice,
  onClearParentInvoice,
  onAddItemToReturn,
}) => {
  return (
    <Card className="p-4 bg-warn-soft/50 border-warn/30 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold text-ink flex items-center gap-1.5">
          <FileSearch className="w-4 h-4 text-warn" />
          بحث برقم الفاتورة الأصلية (اختياري لجلب الأصناف والأسعار)
        </span>
        {parentInvoice && (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClearParentInvoice}
            className="text-xs text-bad hover:underline font-bold px-2"
          >
            إلغاء الربط والرجوع للمرتجع الحر
          </Button>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="أدخل رقم الفاتورة الأصلية (مثال: INV-00001)..."
            value={invoiceLookupNumber}
            onChange={(e) => onSearchNumberChange(e.target.value)}
            className="tabular-nums text-right border-warn/40 focus:border-warn focus:ring-warn"
          />
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onSearchInvoice}
          disabled={isSearchingInvoice || !invoiceLookupNumber.trim()}
          isLoading={isSearchingInvoice}
          className="bg-warn text-on-brand hover:opacity-95 shrink-0 font-bold"
        >
          {isSearchingInvoice ? 'جاري البحث...' : 'استيراد الفاتورة'}
        </Button>
      </div>

      {parentInvoice && (
        <Card className="p-3 border-warn/30 mt-2 space-y-2">
          <div className="flex justify-between flex-wrap gap-2 text-xs text-muted pb-2 border-b border-line font-bold">
            <span>
              فاتورة رقم:{' '}
              <span className="tabular-nums text-ink">{parentInvoice.invoice_number}</span>
            </span>
            <span>
              الطرف: <span className="text-ink">{parentInvoice.party_name || parentInvoice.party?.name || 'نقدي'}</span>
            </span>
            <span>
              التاريخ: <span className="text-ink tabular-nums">{parentInvoice.date}</span>
            </span>
          </div>
          <div className="text-xs font-medium text-muted">اختر البنود المراد استرجاعها:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {parentInvoice.items?.map((item: any) => (
              <button
                key={`${item.id ?? item.product_id}-${item.product_variant_id ?? 0}-${item.product_batch_id ?? 0}`}
                type="button"
                onClick={() => onAddItemToReturn(item)}
                className="min-h-[44px] flex justify-between items-center gap-2 p-2.5 bg-surface-2 hover:bg-warn-soft/50 border border-line rounded-xl text-right transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="font-bold text-ink text-xs truncate">{item.product_name}</p>
                  <InvoiceItemMeta
                    variantName={item.variant_name}
                    batchNumber={item.batch_number}
                    unitName={item.unit_name}
                  />
                  <p className="text-[11px] text-muted tabular-nums mt-0.5">
                    الكمية الأصلية: {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <Badge tone="warn" className="shrink-0">+ استرجاع</Badge>
              </button>
            ))}
          </div>
        </Card>
      )}
    </Card>
  );
};
