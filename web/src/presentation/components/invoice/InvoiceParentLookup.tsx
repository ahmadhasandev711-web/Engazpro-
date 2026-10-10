import React from 'react';
import { FileSearch } from 'lucide-react';
import { Invoice, formatCurrency } from '@pos-mandob/shared';

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
    <div className="bg-gradient-to-l from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
          <FileSearch className="w-4 h-4 text-amber-600" />
          بحث برقم الفاتورة الأصلية (اختياري لجلب الأصناف والأسعار)
        </span>
        {parentInvoice && (
          <button
            type="button"
            onClick={onClearParentInvoice}
            className="text-xs text-rose-600 hover:underline font-bold"
          >
            إلغاء الربط والرجوع للمرتجع الحر
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="أدخل رقم الفاتورة الأصلية (مثال: INV-00001)..."
          value={invoiceLookupNumber}
          onChange={(e) => onSearchNumberChange(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-white border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-right font-mono"
        />
        <button
          type="button"
          onClick={onSearchInvoice}
          disabled={isSearchingInvoice || !invoiceLookupNumber.trim()}
          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors"
        >
          {isSearchingInvoice ? 'جاري البحث...' : 'استيراد الفاتورة'}
        </button>
      </div>

      {parentInvoice && (
        <div className="bg-white p-3 rounded-xl border border-amber-200 mt-2 space-y-2">
          <div className="flex justify-between text-xs text-slate-600 pb-2 border-b border-slate-100 font-bold">
            <span>
              فاتورة رقم: <span className="font-mono text-slate-900">{parentInvoice.invoice_number}</span>
            </span>
            <span>الطرف: <span className="text-slate-900">{parentInvoice.party?.name || 'نقدي'}</span></span>
            <span>التاريخ: <span className="text-slate-900">{parentInvoice.date}</span></span>
          </div>
          <div className="text-xs font-medium text-slate-500">اختر البنود المراد استرجاعها:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {parentInvoice.items?.map((item: any) => (
              <button
                key={item.id || item.product_id}
                type="button"
                onClick={() => onAddItemToReturn(item)}
                className="flex justify-between items-center p-2.5 bg-slate-50 hover:bg-amber-100/50 border border-slate-200 rounded-lg text-right transition-colors"
              >
                <div>
                  <p className="font-bold text-slate-800 text-xs">{item.product_name}</p>
                  <p className="text-[11px] text-slate-500">
                    الكمية الأصلية: {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-1 rounded">
                  + استرجاع
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};