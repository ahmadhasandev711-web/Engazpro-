import React, { useRef } from 'react';
import { Printer, X, CheckCircle2, Share2, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { useAuthStore } from '../../../data/store/useAuthStore';
import { webShareService } from '../../../infrastructure/pwa/webShareService';

export interface ShiftZReportData {
  id: number;
  shift_number: string;
  status: string;
  status_label?: string;
  opened_at: string;
  closed_at?: string | null;
  settled_at?: string | null;
  created_by?: number;
  created_by_name?: string | null;
  created_by_role?: string | null;
  user?: { id: number; name: string; role?: string } | null;
  treasury_id?: number | null;
  treasury_name?: string | null;
  settled_by_name?: string | null;
  settled_by_user?: { id: number; name: string } | null;
  opening_balance: number;
  cash_sales: number;
  electronic_sales: number;
  credit_sales?: number;
  cash_receipts: number;
  cash_returns: number;
  expenses: number;
  expected_cash: number;
  actual_cash?: number | null;
  difference?: number | null;
  notes?: string | null;
  settlement_notes?: string | null;
}

interface ShiftZReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftZReportData | null;
}

export const ShiftZReportModal: React.FC<ShiftZReportModalProps> = ({
  isOpen,
  onClose,
  shift,
}) => {
  const user = useAuthStore((state) => state.user);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !shift) return null;

  const storeIdentity = user?.store_identity;
  const storeName = storeIdentity?.business_name || (user as any)?.store_name || user?.name || 'متجر إنجاز برو';
  const storePhone = storeIdentity?.store_phone || user?.phone;
  const storeAddress = storeIdentity?.store_address;

  const employeeName = shift.user?.name || shift.created_by_name || 'الكاشير';
  const employeeRole = shift.user?.role || shift.created_by_role;
  const roleLabel =
    employeeRole === 'MANDOB'
      ? 'مندوب مبيعات'
      : employeeRole === 'CASHIER'
      ? 'كاشير POS'
      : employeeRole === 'MANAGER'
      ? 'مدير فرع'
      : employeeRole === 'SUPERVISOR'
      ? 'مشرف ورديات'
      : 'موظف';

  const openedDateStr = shift.opened_at ? new Date(shift.opened_at).toLocaleDateString('ar-EG') : '-';
  const openedTimeStr = shift.opened_at
    ? new Date(shift.opened_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : '';

  const closedDateStr = shift.closed_at ? new Date(shift.closed_at).toLocaleDateString('ar-EG') : '-';
  const closedTimeStr = shift.closed_at
    ? new Date(shift.closed_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : '';

  const actualCash = shift.actual_cash != null ? Number(shift.actual_cash) : Number(shift.expected_cash);
  const difference = shift.difference != null ? Number(shift.difference) : (actualCash - Number(shift.expected_cash));
  const isDiffZero = Math.abs(difference) < 0.01;
  const isSurplus = difference > 0.01;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = async () => {
    let text = `📊 *تقرير إغلاق وردية (Z-Report)*\n`;
    text += `🏬 *${storeName}*\n`;
    text += `--------------------------------\n`;
    text += `🔢 رقم الوردية: ${shift.shift_number}\n`;
    text += `👤 الموظف: ${employeeName} (${roleLabel})\n`;
    if (shift.treasury_name) {
      text += `🏦 الخزينة / الدرج: ${shift.treasury_name}\n`;
    }
    text += `🕒 بدء الوردية: ${openedDateStr} ${openedTimeStr}\n`;
    text += `🔒 إغلاق الوردية: ${closedDateStr} ${closedTimeStr}\n`;
    text += `--------------------------------\n`;
    text += `💵 رصيد الافتتاح: ${formatCurrency(shift.opening_balance)}\n`;
    text += `📈 مبيعات كاش: +${formatCurrency(shift.cash_sales)}\n`;
    if (Number(shift.electronic_sales) > 0) {
      text += `💳 مبيعات شبكة/محافظ: ${formatCurrency(shift.electronic_sales)}\n`;
    }
    if (Number(shift.cash_receipts) > 0) {
      text += `📥 تحصيلات عملاء: +${formatCurrency(shift.cash_receipts)}\n`;
    }
    if (Number(shift.expenses) > 0) {
      text += `📤 مصروفات: -${formatCurrency(shift.expenses)}\n`;
    }
    if (Number(shift.cash_returns) > 0) {
      text += `🔄 مرتجعات كاش: -${formatCurrency(shift.cash_returns)}\n`;
    }
    text += `--------------------------------\n`;
    text += `🎯 النقدية المتوقعة: ${formatCurrency(shift.expected_cash)}\n`;
    text += `💰 النقدية الفعلية المسلمة: *${formatCurrency(actualCash)}*\n`;
    text += `⚖️ نتيجة الجرد: ${isDiffZero ? 'مطابق تماماً (0.00)' : isSurplus ? `زيادة +${formatCurrency(difference)}` : `عجز ${formatCurrency(difference)}`}\n`;
    if (shift.notes) {
      text += `📝 ملاحظات: ${shift.notes}\n`;
    }
    text += `--------------------------------\n`;
    text += `تم الإغلاق بنجاح وتجهيز مظروف العهدة.`;

    await webShareService.shareInvoice({
      title: `Z-Report ${shift.shift_number} - ${storeName}`,
      text,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-black">بون تقفيل الوردية (Z-Report)</h3>
              <span className="text-[10px] text-slate-400 font-mono">وردية {shift.shift_number}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-100/50 flex justify-center">
          <div
            ref={printRef}
            id="shift-z-report-receipt"
            className="w-full bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-slate-900 font-sans text-xs leading-relaxed"
            dir="rtl"
          >
            {/* Store Branding Header */}
            <div className="text-center pb-2.5 border-b border-dashed border-slate-300 space-y-0.5">
              <h2 className="text-sm font-black tracking-tight text-slate-900">{storeName}</h2>
              <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">
                بون إغلاق وتسليم الوردية (Z-Report)
              </div>
              {storePhone && (
                <p className="text-[10px] text-slate-500 font-mono">هاتف: {storePhone}</p>
              )}
              {storeAddress && (
                <p className="text-[9px] text-slate-400 font-sans">{storeAddress}</p>
              )}
            </div>

            {/* Shift Header Meta */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">رقم الوردية:</span>
                <span className="font-bold font-mono">{shift.shift_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">الموظف المسؤول:</span>
                <span className="font-bold font-sans text-slate-800">
                  {employeeName} ({roleLabel})
                </span>
              </div>
              {shift.treasury_name && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">الدرج / الخزينة:</span>
                  <span className="font-bold font-sans text-slate-800">{shift.treasury_name}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">وقت الفتح:</span>
                <span className="font-mono text-[10px]">
                  {openedDateStr} {openedTimeStr}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">وقت الإغلاق:</span>
                <span className="font-mono text-[10px]">
                  {closedDateStr} {closedTimeStr}
                </span>
              </div>
              {shift.settled_by_name && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">المعتمد / المستلم:</span>
                  <span className="font-bold font-sans text-emerald-800">{shift.settled_by_name}</span>
                </div>
              )}
            </div>

            {/* Financial Movements Breakdown */}
            <div className="py-2 border-b border-dashed border-slate-300 space-y-1.5 text-[11px]">
              <div className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-wider mb-1">
                تفاصيل الحركة المالية
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-sans">رصيد الافتتاح:</span>
                <span className="font-mono font-bold text-slate-700">{formatCurrency(shift.opening_balance)}</span>
              </div>

              <div className="flex justify-between items-center text-emerald-700">
                <span className="font-sans">مبيعات نقدية (كاش):</span>
                <span className="font-mono font-bold">+{formatCurrency(shift.cash_sales)}</span>
              </div>

              {Number(shift.electronic_sales) > 0 && (
                <div className="flex justify-between items-center text-indigo-700">
                  <span className="font-sans">مبيعات إلكترونية (شبكة/محافظ):</span>
                  <span className="font-mono font-bold">{formatCurrency(shift.electronic_sales)}</span>
                </div>
              )}

              {Number(shift.cash_receipts) > 0 && (
                <div className="flex justify-between items-center text-emerald-700">
                  <span className="font-sans">تحصيلات وسندات قبض:</span>
                  <span className="font-mono font-bold">+{formatCurrency(shift.cash_receipts)}</span>
                </div>
              )}

              {Number(shift.expenses) > 0 && (
                <div className="flex justify-between items-center text-rose-600">
                  <span className="font-sans">مصروفات ونثريات:</span>
                  <span className="font-mono font-bold">-{formatCurrency(shift.expenses)}</span>
                </div>
              )}

              {Number(shift.cash_returns) > 0 && (
                <div className="flex justify-between items-center text-rose-600">
                  <span className="font-sans">مرتجعات مبيعات كاش:</span>
                  <span className="font-mono font-bold">-{formatCurrency(shift.cash_returns)}</span>
                </div>
              )}
            </div>

            {/* Reconciliation Cash Box */}
            <div className="my-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-sans">النقدية المتوقعة بالدرج:</span>
                <span className="font-mono font-bold text-slate-800">{formatCurrency(shift.expected_cash)}</span>
              </div>

              <div className="flex justify-between items-center border-t border-slate-200/80 pt-1.5">
                <span className="font-black text-slate-900 font-sans">النقدية الفعلية المجرودة:</span>
                <span className="font-mono font-black text-slate-950 text-sm">
                  {formatCurrency(actualCash)}
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-slate-200/80 pt-1.5">
                <span className="font-sans font-bold text-slate-600">نتيجة المطابقة:</span>
                {isDiffZero ? (
                  <span className="font-bold text-emerald-700 font-sans flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>مطابق (0.00)</span>
                  </span>
                ) : isSurplus ? (
                  <span className="font-bold text-amber-700 font-mono flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>زيادة +{formatCurrency(difference)}</span>
                  </span>
                ) : (
                  <span className="font-bold text-rose-700 font-mono flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>عجز {formatCurrency(difference)}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Shift Notes if any */}
            {shift.notes && (
              <div className="py-2 border-b border-dashed border-slate-300 text-[11px]">
                <span className="text-slate-500 font-sans block mb-0.5">ملاحظات الكاشير:</span>
                <p className="font-sans text-slate-800 bg-slate-50 p-2 rounded-lg leading-relaxed text-[10px]">
                  {shift.notes}
                </p>
              </div>
            )}

            {/* Settlement Notes if any */}
            {shift.settlement_notes && (
              <div className="py-2 border-b border-dashed border-slate-300 text-[11px]">
                <span className="text-slate-500 font-sans block mb-0.5">ملاحظات التوريد والاعتماد:</span>
                <p className="font-sans text-slate-800 bg-slate-50 p-2 rounded-lg leading-relaxed text-[10px]">
                  {shift.settlement_notes}
                </p>
              </div>
            )}

            {/* Dual Signature Lines */}
            <div className="pt-3 pb-2 grid grid-cols-2 gap-3 text-center text-[10px] text-slate-600 font-sans">
              <div className="border-t border-dashed border-slate-300 pt-2">
                <span className="font-bold">توقيع الكاشير (المسلّم)</span>
                <div className="h-6" />
              </div>
              <div className="border-t border-dashed border-slate-300 pt-2">
                <span className="font-bold">توقيع الخزينة (المستلم)</span>
                <div className="h-6" />
              </div>
            </div>

            {/* Receipt Footer */}
            <div className="text-center pt-2 border-t border-dashed border-slate-300 space-y-0.5">
              <p className="text-[9px] font-sans text-slate-500">
                يتم تدبيس هذا البون الحراري بمظروف النقدية المسلم للخزينة
              </p>
              <p className="text-[8px] text-slate-400 font-sans">
                نظام إدارة نقاط البيع والمناديب الذكي • {storeName}
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

      {/* Embedded Print CSS for thermal printers (Calibrated to auto paper width, safe margins, strict 1-page output) */}
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
          body *:not(:has(#shift-z-report-receipt)):not(#shift-z-report-receipt):not(#shift-z-report-receipt *):not(style) {
            display: none !important;
          }
          #root, body *:has(#shift-z-report-receipt) {
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
          #shift-z-report-receipt, #shift-z-report-receipt * {
            visibility: visible !important;
          }
          #shift-z-report-receipt {
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
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
