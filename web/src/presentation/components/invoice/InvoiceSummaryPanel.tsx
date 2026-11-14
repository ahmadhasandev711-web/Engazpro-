import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Party, PaymentMethod, formatCurrency, InvoiceInput } from '@pos-mandob/shared';
import { Button, Card, Select } from '../ui';

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
    <Card className="p-5 sm:p-6 flex flex-col gap-6 h-fit">
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-ink">
          {isReturn ? 'تسوية المرتجع والطرف' : 'تفاصيل الدفع والطرف'}
        </h3>

        {branchesData && branchesData.length > 0 && (
          <Select
            label="فرع / مخزن العملية"
            {...register('branch_id', {
              setValueAs: (v) => (v === '' ? null : Number(v)),
            })}
            disabled={canChangeBranch === false}
            error={errors.branch_id?.message}
          >
            {branchesData.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.type === 'WAREHOUSE' ? 'مستودع' : b.type === 'STORE' ? 'متجر' : 'سيارة'}){' '}
                {b.is_main ? '⭐ (رئيسي)' : ''}
              </option>
            ))}
          </Select>
        )}

        <Select
          label={`${isPurchase || isPurchaseReturn ? 'المورد' : 'العميل'} (اختياري للنقدي)`}
          {...register('party_id', {
            setValueAs: (v) => (v === '' ? null : Number(v)),
          })}
          error={errors.party_id?.message}
        >
          <option value="">-- نقدي (بدون حساب) --</option>
          {partiesData?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        {!isPurchase && !isReturn && !isPurchaseReturn && couriersData && couriersData.length > 0 && (
          <Select
            label="شركة الشحن والتوصيل (اختياري)"
            {...register('courier_party_id' as any, {
              setValueAs: (v) => (v === '' ? null : Number(v)),
            })}
          >
            <option value="">-- بدون شركة شحن (استلام محلي) --</option>
            {couriersData.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ''}
              </option>
            ))}
          </Select>
        )}

        <Select
          label={isReturn ? 'طريقة رد القيمة' : 'طريقة الدفع'}
          {...register('payment_method')}
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
        </Select>
      </div>

      <hr className="border-line" />

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted">الإجمالي:</span>
          <span className="font-bold text-ink tabular-nums">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between items-center gap-4">
          <span className="text-muted text-sm whitespace-nowrap">الخصم:</span>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('discount', { valueAsNumber: true })}
            className="w-28 min-h-[44px] px-3 py-1.5 bg-surface-2 text-ink border border-line rounded-xl text-sm text-left font-bold tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-line">
          <span className="text-lg font-bold text-ink">الصافي:</span>
          <span className="text-2xl font-black text-ok tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      <hr className="border-line" />

      <div className="space-y-3">
        <div className="flex justify-between items-center gap-4">
          <span className="text-muted text-sm whitespace-nowrap">
            {isReturn ? 'المبلغ المسترد نقداً:' : 'المدفوع نقداً:'}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('paid_amount', { valueAsNumber: true })}
            className="w-32 min-h-[44px] px-3 py-1.5 bg-surface-2 text-ink border border-line rounded-xl text-sm text-left font-bold tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        <div className="flex justify-between items-center">
          <span className="text-muted text-sm">
            {isReturn ? 'المخصوم من الحساب (آجل):' : 'المتبقي (الآجل):'}
          </span>
          <span className="font-bold text-warn tabular-nums">{formatCurrency(remaining)}</span>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={isPending}
        isLoading={isPending}
        leftIcon={!isPending ? <CheckCircle2 className="w-5 h-5" /> : undefined}
        className={`w-full mt-auto font-black text-base ${
          isReturn ? 'bg-warn text-on-brand hover:opacity-95' : ''
        }`}
      >
        {isPending ? 'جاري الحفظ...' : isReturn ? 'تأكيد وحفظ المرتجع' : 'حفظ الفاتورة'}
      </Button>
    </Card>
  );
};
