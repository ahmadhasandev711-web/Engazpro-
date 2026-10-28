import React, { useRef } from 'react';
import { Printer, X, CheckCircle2, RotateCcw, Share2 } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { useAuthStore } from '../../../data/store/useAuthStore';
import { webShareService, formatInvoiceWhatsAppText } from '../../../infrastructure/pwa/webShareService';

interface PosReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
  onStartNewInvoice?: () => void;
}

export const PosReceiptModal: React.FC<PosReceiptModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onStartNewInvoice,
}) => {
  const user = useAuthStore((state) => state.user);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const storeIdentity = user?.store_identity;
  const storeName = storeIdentity?.business_name || (user as any)?.store_name || user?.name || 'متجر إنجاز برو';
  const storePhone = storeIdentity?.store_phone || user?.phone;
  const storeAddress = storeIdentity?.store_address;
  const currencySymbol = storeIdentity?.currency || 'ج.م';
  const cashierName = invoice.creator?.name || invoice.created_by_name || user?.name || 'كاشير';
  const dateStr = invoice.date || new Date().toISOString().split('T')[0];
  const timeStr = invoice.created_at
    ? new Date(invoice.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = async () => {
    const text = formatInvoiceWhatsAppText(invoice, {
      storeName,
      storePhone,
      currencySymbol,
    });
    const invoiceNo = invoice.invoice_number || `#${invoice.id}`;
    const customerPhone = invoice.party?.phone || invoice.customer_phone || (invoice.party as any)?.phone;

    await webShareService.shareInvoice({
      title: `فاتورة ${invoiceNo} - ${storeName}`,
      text,
      phone: customerPhone,
    });
  };

  const items = invoice.items || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
        {/* Modal Top Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-black">{onStartNewInvoice ? 'تم تسجيل الفاتورة بنجاح' : 'معاينة وإيصال الفاتورة'}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-100/50 flex justify-center">
          <div
            ref={printRef}
            id="pos-thermal-receipt"
            className="w-full bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-slate-900 font-sans text-xs leading-relaxed"
            dir="rtl"
          >
            {/* Header Branding */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-1">
              <h2 className="text-base font-black tracking-tight text-slate-900">{storeName}</h2>
              <p className="text-[10px] text-slate-500 font-sans">فاتورة مبيعات</p>
              {storePhone && (
                <p className="text-[10px] text-slate-500 font-mono">هاتف: {storePhone}</p>
              )}
              {storeAddress && (
                <p className="text-[9px] text-slate-400 font-sans">{storeAddress}</p>
              )}
            </div>

            {/* Invoice Info */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">رقم الفاتورة:</span>
                <span className="font-bold font-mono">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">التاريخ والوقت:</span>
                <span className="font-mono">
                  {dateStr} {timeStr}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">الكاشير:</span>
                <span className="font-bold text-slate-800">{cashierName}</span>
              </div>
              {(invoice.salesperson_name || invoice.salesperson?.name) && (invoice.salesperson_name || invoice.salesperson?.name) !== cashierName && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">مسؤول البيع:</span>
                  <span className="font-bold text-slate-800">{invoice.salesperson_name || invoice.salesperson?.name}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">العميل:</span>
                <span className="font-medium text-slate-900">{invoice.party?.name || invoice.party_name || 'عميل نقدي'}</span>
              </div>
              {(invoice.party?.phone || invoice.customer_phone) && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">هاتف العميل:</span>
                  <span className="font-mono">{invoice.party?.phone || invoice.customer_phone}</span>
                </div>
              )}
              {(invoice.party?.address || invoice.customer_address) && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">العنوان:</span>
                  <span className="text-left text-[10px]">{invoice.party?.address || invoice.customer_address}</span>
                </div>
              )}
              {invoice.courier_name && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">شركة الشحن:</span>
                  <span className="font-bold text-purple-800">{invoice.courier_name} {invoice.tracking_number ? `(#${invoice.tracking_number})` : ''}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2.5 border-b border-dashed border-slate-300">
              <table className="w-full text-right text-[11px] table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="pb-1 w-[50%]">الصنف</th>
                    <th className="pb-1 text-center w-[18%]">الكمية</th>
                    <th className="pb-1 text-left w-[32%]">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item: any, idx: number) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1 font-bold">
                        <div className="line-clamp-1">{item.product_name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          <span className="font-mono">{formatCurrency(item.unit_price, currencySymbol)}</span> للقطعة
                        </div>
                      </td>
                      <td className="py-1 text-center font-bold font-mono">{item.quantity}</td>
                      <td className="py-1 text-left font-bold font-mono">{formatCurrency(item.total, currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>المجموع الفرعي:</span>
                <span>{formatCurrency(invoice.subtotal, currencySymbol)}</span>
              </div>
              {Number(invoice.discount) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>الخصم:</span>
                  <span>-{formatCurrency(invoice.discount, currencySymbol)}</span>
                </div>
              )}
              {Number(invoice.shipping_amount) > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>خدمة التوصيل / الشحن:</span>
                  <span className="font-bold">{formatCurrency(invoice.shipping_amount, currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200">
                <span>الإجمالي الصافي:</span>
                <span>{formatCurrency(invoice.total, currencySymbol)}</span>
              </div>
            </div>

            {/* Payment info */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">طريقة الدفع:</span>
                <span className="font-bold">
                  {invoice.payment_method === 'CASH'
                    ? 'نقدي (كاش)'
                    : invoice.payment_method === 'CARD'
                      ? 'بطاقة بنكية / فيزا'
                      : invoice.payment_method === 'INSTAPAY'
                        ? 'إنستاباي (InstaPay)'
                        : invoice.payment_method === 'VODAFONE_CASH'
                          ? 'فودافون كاش ومحافظ'
                          : invoice.payment_method === 'COURIER_COD'
                            ? 'تحصيل شركة الشحن (COD)'
                            : invoice.payment_method === 'SPLIT'
                              ? 'دفع مجزأ'
                              : invoice.payment_method === 'TRANSFER'
                                ? 'تحويل بنكي'
                                : 'آجل على الحساب'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">المبلغ المدفوع:</span>
                <span className="font-bold">{formatCurrency(invoice.paid_amount || invoice.total, currencySymbol)}</span>
              </div>
            </div>

            {/* Footer QR simulation & Thank you */}
            <div className="pt-3 text-center space-y-1 text-[10px] text-slate-400">
              <p className="font-sans font-bold text-slate-700">شكراً لزيارتكم ونسعد بخدمتكم دائماً!</p>
              <p className="font-mono text-[9px]">نظام إنجاز برو لإدارة نقاط البيع والمخازن</p>
            </div>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="p-4 bg-white border-t border-slate-200 space-y-2 no-print">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 min-w-[45%] bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-3 rounded-2xl text-xs font-black shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الإيصال</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex-1 min-w-[45%] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-3 rounded-2xl text-xs font-black transition-all active:scale-98 flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>مشاركة واتساب</span>
            </button>
          </div>

          {onStartNewInvoice ? (
            <button
              type="button"
              onClick={onStartNewInvoice}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-2xl text-xs font-black transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>فاتورة جديدة (Esc)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-2xl text-xs font-bold transition-colors"
            >
              إغلاق النافذة
            </button>
          )}
        </div>
      </div>

      {/* Embedded Print CSS for thermal receipt printers (Calibrated to auto paper width, safe margins, strict 1-page output) */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: 100% !important;
            overflow: hidden !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body *:not(:has(#pos-thermal-receipt)):not(#pos-thermal-receipt):not(#pos-thermal-receipt *):not(style) {
            display: none !important;
          }
          #root, body *:has(#pos-thermal-receipt) {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            overflow: visible !important;
            transform: none !important;
          }
          #pos-thermal-receipt, #pos-thermal-receipt * {
            visibility: visible !important;
          }
          #pos-thermal-receipt {
            position: relative !important;
            display: block !important;
            margin: 0 auto !important;
            width: 94% !important;
            max-width: 70mm !important;
            box-sizing: border-box !important;
            padding: 2mm 4mm !important;
            border: none !important;
            box-shadow: none !important;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Cairo', 'Tajawal', sans-serif !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
            color: #000 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #pos-thermal-receipt table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }
          #pos-thermal-receipt th, #pos-thermal-receipt td {
            padding-left: 2px !important;
            padding-right: 2px !important;
            word-break: break-word !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
