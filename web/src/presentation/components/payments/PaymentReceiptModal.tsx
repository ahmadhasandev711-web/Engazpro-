import React, { useRef } from 'react';
import { Printer, X, Share2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { useAuthStore } from '../../../data/store/useAuthStore';
import { webShareService } from '../../../infrastructure/pwa/webShareService';

export interface PaymentReceiptData {
  id: number;
  party_id?: number | null;
  party_name?: string | null;
  party_type?: string | null;
  party_phone?: string | null;
  party_balance?: number | null;
  invoice_id?: number | null;
  invoice_number?: string | null;
  type: 'RECEIPT' | 'PAYMENT' | string;
  amount: number;
  method: string;
  date: string;
  notes?: string | null;
  created_by?: number;
  created_by_name?: string | null;
  created_by_role?: string | null;
  created_at?: string;
}

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentReceiptData | null;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
}) => {
  const user = useAuthStore((state) => state.user);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !payment) return null;

  const isReceipt = payment.type === 'RECEIPT';
  const storeIdentity = user?.store_identity;
  const storeName = storeIdentity?.business_name || (user as any)?.store_name || user?.name || 'متجر إنجاز برو';
  const storePhone = storeIdentity?.store_phone || user?.phone;
  const storeAddress = storeIdentity?.store_address;

  const dateStr = payment.date || (payment.created_at ? new Date(payment.created_at).toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG'));
  const timeStr = payment.created_at
    ? new Date(payment.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : '';

  const methodLabel =
    payment.method === 'CASH'
      ? 'نقدية (كاش)'
      : payment.method === 'CARD'
      ? 'بطاقة دفع / فيزا'
      : payment.method === 'INSTAPAY'
      ? 'إنستاباي (InstaPay)'
      : payment.method === 'VODAFONE_CASH'
      ? 'فودافون كاش (Vodafone Cash)'
      : payment.method === 'TRANSFER'
      ? 'تحويل بنكي'
      : payment.method;

  const roleLabel =
    payment.created_by_role === 'MANDOB'
      ? 'مندوب مبيعات'
      : payment.created_by_role === 'CASHIER'
      ? 'كاشير'
      : payment.created_by_role === 'MANAGER'
      ? 'مدير فرع'
      : payment.created_by_role === 'SUPERVISOR'
      ? 'مشرف'
      : 'الإدارة';

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = async () => {
    const formattedAmount = formatCurrency(payment.amount);
    const voucherType = isReceipt ? 'إيصال استلام نقدية (سند قبض)' : 'إيصال صرف نقدية (سند صرف)';
    const partyName = payment.party_name || (isReceipt ? 'العميل المحترم' : 'المورد المحترم');

    let text = `🧾 *${voucherType}*\n`;
    text += `🏬 *${storeName}*\n`;
    text += `--------------------------------\n`;
    text += `🔢 رقم السند: #${payment.id}\n`;
    text += `📅 التاريخ: ${dateStr}${timeStr ? ` ${timeStr}` : ''}\n`;
    text += `👤 الطرف: ${partyName}\n`;
    text += `💰 المبلغ: *${formattedAmount}*\n`;
    text += `💳 طريقة السداد: ${methodLabel}\n`;
    if (payment.invoice_number) {
      text += `📄 رقم الفاتورة: ${payment.invoice_number}\n`;
    }
    if (payment.notes) {
      text += `📝 البيان: ${payment.notes}\n`;
    }
    if (payment.party_balance != null && Number(payment.party_balance) !== 0) {
      text += `📊 الرصيد المتبقي: ${formatCurrency(payment.party_balance)}\n`;
    }
    if (payment.created_by_name) {
      text += `✍️ المحصل / المسؤول: ${payment.created_by_name} (${roleLabel})\n`;
    }
    text += `--------------------------------\n`;
    text += `شكراً لتعاملكم معنا!`;

    await webShareService.shareInvoice({
      title: `${voucherType} #${payment.id} - ${storeName}`,
      text,
      phone: payment.party_phone || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <span
              className={`p-1.5 rounded-xl ${
                isReceipt ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {isReceipt ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
            </span>
            <div>
              <h3 className="text-sm font-black">
                {isReceipt ? 'إيصال سند قبض' : 'إيصال سند صرف'}
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">سند رقم #{payment.id}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Paper Container (Calibrated 74mm on 80mm roll) */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-100/50 flex justify-center">
          <div
            ref={printRef}
            id="payment-thermal-receipt"
            className="w-full bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-slate-900 font-mono text-xs leading-relaxed"
            dir="rtl"
          >
            {/* Store Branding Header */}
            <div className="text-center pb-2.5 border-b border-dashed border-slate-300 space-y-0.5">
              <h2 className="text-sm font-black tracking-tight text-slate-900">{storeName}</h2>
              <div
                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isReceipt ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                }`}
              >
                {isReceipt ? 'إيصال استلام نقدية (سند قبض)' : 'إيصال صرف نقدية (سند صرف)'}
              </div>
              {storePhone && (
                <p className="text-[10px] text-slate-500 font-mono">هاتف: {storePhone}</p>
              )}
              {storeAddress && (
                <p className="text-[9px] text-slate-400 font-sans">{storeAddress}</p>
              )}
            </div>

            {/* Voucher Details */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">رقم السند:</span>
                <span className="font-bold font-mono">#{payment.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">التاريخ والوقت:</span>
                <span className="font-mono">
                  {dateStr} {timeStr}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">
                  {isReceipt ? 'المستلم منه (العميل):' : 'المصروف له (المورد):'}
                </span>
                <span className="font-bold text-slate-900 font-sans">
                  {payment.party_name || 'بدون طرف محدد'}
                </span>
              </div>
              {payment.party_phone && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">هاتف الطرف:</span>
                  <span className="font-mono">{payment.party_phone}</span>
                </div>
              )}
              {payment.invoice_number && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">سداد عن فاتورة:</span>
                  <span className="font-mono font-bold text-indigo-700">{payment.invoice_number}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">طريقة السداد:</span>
                <span className="font-bold text-slate-800 font-sans">{methodLabel}</span>
              </div>
              {payment.created_by_name && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">المسؤول / المحصّل:</span>
                  <span className="font-bold text-slate-800 font-sans">
                    {payment.created_by_name} ({roleLabel})
                  </span>
                </div>
              )}
            </div>

            {/* Amount Banner */}
            <div className="my-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
              <span className="text-[10px] text-slate-500 font-sans block mb-0.5">
                {isReceipt ? 'المبلغ المستلم نقداً / إلكترونياً' : 'المبلغ المصروف نقداً / إلكترونياً'}
              </span>
              <div
                className={`text-lg font-black font-mono tracking-tight ${
                  isReceipt ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatCurrency(payment.amount)}
              </div>
            </div>

            {/* Notes / Statement */}
            {payment.notes && (
              <div className="py-2 border-b border-dashed border-slate-300 text-[11px]">
                <span className="text-slate-500 font-sans block mb-0.5">البيان / ملاحظات:</span>
                <p className="font-sans text-slate-800 bg-slate-50 p-2 rounded-lg leading-relaxed text-[10px]">
                  {payment.notes}
                </p>
              </div>
            )}

            {/* Party Balance if present */}
            {payment.party_balance != null && Number(payment.party_balance) !== 0 && (
              <div className="py-2 border-b border-dashed border-slate-300 flex justify-between items-center text-[11px]">
                <span className="text-slate-500 font-sans">رصيد الحساب الحالي:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(payment.party_balance)}
                </span>
              </div>
            )}

            {/* Signatures */}
            <div className="pt-4 pb-2 grid grid-cols-2 gap-3 text-center text-[10px] text-slate-600 font-sans">
              <div className="border-t border-dashed border-slate-300 pt-2">
                <span>توقيع المسلّم</span>
                <div className="h-6" />
              </div>
              <div className="border-t border-dashed border-slate-300 pt-2">
                <span>توقيع المستلم</span>
                <div className="h-6" />
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 border-t border-dashed border-slate-300 space-y-1">
              <p className="text-[10px] font-sans text-slate-600 font-bold">شكراً لتعاملكم معنا!</p>
              <p className="text-[8px] text-slate-400 font-sans">
                يعتبر هذا الإيصال إثبات سداد رسمي من نظام {storeName}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-slate-200 space-y-2 no-print">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-2xl text-xs font-black shadow-md shadow-primary-600/20 transition-all active:scale-98 flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة بون (74mm)</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-3 rounded-2xl text-xs font-black transition-all active:scale-98 flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>مشاركة واتساب</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-2xl text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Embedded Print CSS for 80mm thermal printers (Calibrated to 72mm printable area, strict 1-page output) */}
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: 100% !important;
            overflow: hidden !important;
            background: white !important;
          }
          body *:not(:has(#payment-thermal-receipt)):not(#payment-thermal-receipt):not(#payment-thermal-receipt *):not(style) {
            display: none !important;
          }
          #root, body *:has(#payment-thermal-receipt) {
            position: static !important;
            display: block !important;
            width: 80mm !important;
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
          #payment-thermal-receipt, #payment-thermal-receipt * {
            visibility: visible !important;
          }
          #payment-thermal-receipt {
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            margin: 0 auto !important;
            width: 72mm !important;
            max-width: 72mm !important;
            box-sizing: border-box !important;
            padding: 2mm 3.5mm !important;
            border: none !important;
            box-shadow: none !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
