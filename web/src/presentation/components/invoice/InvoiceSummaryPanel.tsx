import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Party, PaymentMethod, formatCurrency, InvoiceInput } from '@pos-mandob/shared';

interface InvoiceSummaryPanelProps {
  isReturn: boolean;
  isPurchase: boolean;
  isPurchaseReturn: boolean;
  partiesData?: Party[];
  couriersData?: Party[];
  branchesData?: any[];
  canChangeBranch?: boolean;
  register: UseFormRegister<InvoiceInput>;
  errors: FieldErrors<InvoiceInput>;
  subtotal: number;
  total: number;
  remaining: number;
  isPending: boolean;
}

export const InvoiceSummaryPanel: React.FC<InvoiceSummaryPanelProps> = ({
  isReturn,
  isPurchase,
  isPurchaseReturn,
  partiesData,
  couriersData,
  branchesData,
  canChangeBranch = true,
  register,
  errors,
  subtotal,
  total,
  remaining,
  isPending,
}) => {
  return (
    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col gap-6">
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-white">
          {isReturn ? 'تسوية المرتجع والطرف' : 'تفاصيل الدفع والطرف'}
        </h3>

        {branchesData && branchesData.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              فرع / مخزن العملية
            </label>
            <select
              {...register('branch_id', {
                setValueAs: (v) => (v === '' ? null : Number(v)),
              })}
              disabled={canChangeBranch === false}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-white disabled:opacity-60"
            >
              {branchesData.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.type === 'WAREHOUSE' ? 'مستودع' : b.type === 'STORE' ? 'متجر' : 'سيارة'}) {b.is_main ? '⭐ (رئيسي)' : ''}
                </option>
              ))}
            </select>
            {errors.branch_id && <p className="text-xs text-rose-400 mt-1">{errors.branch_id.message}</p>}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            {isPurchase || isPurchaseReturn ? 'المورد' : 'العميل'} (اختياري للنقدي)
          </label>
          <select
            {...register('party_id', {
              setValueAs: (v) => (v === '' ? null : Number(v)),
            })}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-white"
          >
            <option value="">-- نقدي (بدون حساب) --</option>
            {partiesData?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {errors.party_id && <p className="text-xs text-rose-400 mt-1">{errors.party_id.message}</p>}
        </div>

        {!isPurchase && !isReturn && !isPurchaseReturn && couriersData && couriersData.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              شركة الشحن والتوصيل (اختياري)
            </label>
            <select
              {...register('courier_party_id' as any, {
                setValueAs: (v) => (v === '' ? null : Number(v)),
              })}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-white"
            >
              <option value="">-- بدون شركة شحن (استلام محلي) --</option>
              {couriersData.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            {isReturn ? 'طريقة رد القيمة' : 'طريقة الدفع'}
          </label>
          <select
            {...register('payment_method')}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-white"
          >
            <option value={PaymentMethod.CASH}>
              {isReturn ? 'رد نقدية كاش من الخزينة' : 'كاش نقدي'}
            </option>
            <option value={PaymentMethod.CREDIT}>
              {isReturn ? 'خصم من رصيد الحساب (آجل)' : 'آجل (على الحساب)'}
            </option>
            <option value={PaymentMethod.CARD}>فيزا / بطاقة</option>
            <option value={PaymentMethod.INSTAPAY}>إنستاباي (InstaPay)</option>
            <option value={PaymentMethod.VODAFONE_CASH}>فودافون كاش ومحافظ إلكترونية</option>
            <option value={PaymentMethod.TRANSFER}>تحويل بنكي</option>
          </select>
        </div>
      </div>

      <hr className="border-slate-800" />

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">الإجمالي:</span>
          <span className="font-bold">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between items-center gap-4">
          <span className="text-slate-400 text-sm whitespace-nowrap">الخصم:</span>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('discount', { valueAsNumber: true })}
            className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-left font-bold"
          />
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-800">
          <span className="text-lg font-bold text-white">الصافي:</span>
          <span className="text-2xl font-black text-emerald-400">{formatCurrency(total)}</span>
        </div>
      </div>

      <hr className="border-slate-800" />

      <div className="space-y-3">
        <div className="flex justify-between items-center gap-4">
          <span className="text-slate-400 text-sm whitespace-nowrap">
            {isReturn ? 'المبلغ المسترد نقداً:' : 'المدفوع نقداً:'}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('paid_amount', { valueAsNumber: true })}
            className="w-28 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-left focus:ring-2 focus:ring-emerald-500 font-bold"
          />
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">
            {isReturn ? 'المخصوم من الحساب (آجل):' : 'المتبقي (الآجل):'}
          </span>
          <span className="font-bold text-amber-400">{formatCurrency(remaining)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={`w-full mt-auto py-4 ${
          isReturn ? 'bg-amber-600 hover:bg-amber-500' : 'bg-primary-600 hover:bg-primary-500'
        } disabled:opacity-50 disabled:bg-slate-700 text-white font-black text-lg rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2`}
      >
        {isPending ? (
          'جاري الحفظ...'
        ) : (
          <>
            <CheckCircle2 className="w-6 h-6" />
            {isReturn ? 'تأكيد وحفظ المرتجع' : 'حفظ الفاتورة'}
          </>
        )}
      </button>
    </div>
  );
};