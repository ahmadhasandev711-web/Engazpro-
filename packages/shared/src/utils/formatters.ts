/**
 * تنسيق العملة
 */
export function formatCurrency(amount: number | string | null | undefined, currency: string = 'ج.م'): string {
  const safeAmount = Number(amount) || 0;
  return `${safeAmount.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

/**
 * تنسيق الأرقام
 */
export function formatNumber(num: number): string {
  const safeNum = Number(num) || 0;
  return safeNum.toLocaleString('ar-EG');
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'نقدي (كاش)',
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

/**
 * تنسيق التاريخ للعرض
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * تنسيق التاريخ والوقت للعرض
 */
export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
