const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'كاش (نقدية)',
  CARD: 'بطاقة / فيزا',
  INSTAPAY: 'إنستاباي (InstaPay)',
  VODAFONE_CASH: 'فودافون كاش',
  TRANSFER: 'تحويل بنكي',
  COURIER_COD: 'تحصيل شركة شحن (COD)',
  SPLIT: 'دفع مجزأ',
  CREDIT: 'آجل (على الحساب)',
};

export function getPaymentMethodLabel(method?: string | null): string {
  if (!method) return PAYMENT_METHOD_LABELS.CASH;
  return PAYMENT_METHOD_LABELS[method] ?? method;
}
