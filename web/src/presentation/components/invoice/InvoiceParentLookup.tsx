import React from 'react';
import { FileSearch } from 'lucide-react';
import { Invoice, formatCurrency } from '@pos-mandob/shared';
import { Badge, Button, Card, Input } from '../ui';
import { InvoiceItemMeta } from '../common/InvoiceItemMeta';

interface InvoiceParentLookupProps {
  parentInvoice: Invoice | null;
  invoiceLookupNumber: string;
  isSearchingInvoice: boolean;
  isPurchaseReturn?: boolean;
  allowPhoneAndNameSearch?: boolean;
  lookupMatches?: Invoice[];
  onSelectLookupMatch?: (invoice: Invoice) => void;
  onSearchNumberChange: (value: string) => void;
  onSearchInvoice: () => void;
  onClearParentInvoice: () => void;
  onAddItemToReturn: (item: any) => void;
}

export const InvoiceParentLookup: React.FC<InvoiceParentLookupProps> = ({
  parentInvoice,
  invoiceLookupNumber,
  isSearchingInvoice,
  isPurchaseReturn = false,
  allowPhoneAndNameSearch = false,
  lookupMatches = [],
  onSelectLookupMatch,
  onSearchNumberChange,
  onSearchInvoice,
  onClearParentInvoice,
  onAddItemToReturn,
}) => {
  const sampleNumber = isPurchaseReturn ? 'PUR-00001' : 'INV-00001';
  const handleLookupKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (invoiceLookupNumber.trim() && !isSearchingInvoice) {
        onSearchInvoice();
      }
    }
  };
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
            placeholder={
              allowPhoneAndNameSearch
                ? `رقم فاتورة (17 أو ${sampleNumber}) أو رقم موبايل العميل / اسمه ثم Enter...`
                : `أدخل رقم الفاتورة (مثال: 1 أو 001 أو ${sampleNumber})...`
            }
            value={invoiceLookupNumber}
            onChange={(e) => onSearchNumberChange(e.target.value)}
            onKeyDown={handleLookupKeyDown}
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
          {isSearchingInvoice ? 'جاري البحث...' : 'بحث وجلب الفاتورة'}
        </Button>
      </div>

      {!parentInvoice && lookupMatches.length > 0 && onSelectLookupMatch && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-bold text-ink">اختر الفاتورة المطابقة ({lookupMatches.length}):</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lookupMatches.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => onSelectLookupMatch(inv)}
                className="p-2.5 rounded-xl bg-panel border border-line hover:border-brand text-right text-xs flex items-center justify-between gap-2 transition-colors"
              >
                <div>
                  <div className="font-black text-brand tabular-nums">{inv.invoice_number}</div>
                  <div className="text-muted text-[11px]">{inv.party_name || 'عميل نقدي'} • {inv.date}</div>
                </div>
                <span className="font-black tabular-nums text-ink">{formatCurrency(inv.total)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
          {!isPurchaseReturn && Number(parentInvoice.discount) > 0 && (
            <div className="p-2 rounded-xl bg-info-soft border border-info/30 text-info text-[11px] font-bold">
              تنبيه: الفاتورة الأصلية عليها خصم/عرض بقيمة {formatCurrency(parentInvoice.discount)} — يتم احتساب صافي سعر الاسترجاع للوحدة بعد الخصم تلقائياً
            </div>
          )}
          <div className="text-xs font-medium text-muted">اختر البنود المراد استرجاعها:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {parentInvoice.items?.map((item: any) => {
              const returnedQty = Number(item.returned_quantity ?? 0);
              const returnableQty = Number(item.returnable_quantity ?? item.quantity ?? 0);
              const isFullyReturned = returnableQty <= 0;
              const effectiveUnitPrice = Number(item.effective_return_unit_price ?? item.unit_price ?? 0);
              const hasProratedDiscount = effectiveUnitPrice !== Number(item.unit_price ?? 0);

              return (
                <button
                  key={`${item.id ?? item.product_id}-${item.product_variant_id ?? 0}-${item.product_batch_id ?? 0}`}
                  type="button"
                  disabled={isFullyReturned}
                  onClick={() => onAddItemToReturn(item)}
                  className={`min-h-[44px] flex justify-between items-center gap-2 p-2.5 border border-line rounded-xl text-right transition-colors ${
                    isFullyReturned
                      ? 'bg-surface-2/40 opacity-60 cursor-not-allowed'
                      : 'bg-surface-2 hover:bg-warn-soft/50 cursor-pointer'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-ink text-xs truncate">{item.product_name}</p>
                    <InvoiceItemMeta
                      variantName={item.variant_name}
                      batchNumber={item.batch_number}
                      unitName={item.unit_name}
                    />
                    <p className="text-[11px] text-muted tabular-nums mt-0.5">
                      الأصلية: {item.quantity} × {formatCurrency(effectiveUnitPrice)}
                      {hasProratedDiscount && (
                        <span className="line-through opacity-60 mr-1">
                          ({formatCurrency(item.unit_price)})
                        </span>
                      )}
                      {returnedQty > 0 && ` | متاح: ${returnableQty}`}
                    </p>
                  </div>
                  <Badge tone={isFullyReturned ? 'neutral' : 'warn'} className="shrink-0">
                    {isFullyReturned ? 'مسترجع بالكامل' : '+ استرجاع'}
                  </Badge>
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </Card>
  );
};
