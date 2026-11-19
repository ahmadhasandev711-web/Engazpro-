/**
 * Infrastructure Layer - Web Share Service
 * Conforms to DIP (GR-7) & SoC (GR-3)
 * Provides native OS sharing for receipts & invoices on mobile with WhatsApp fallback.
 */

import { formatCurrency, getPaymentMethodLabel } from '@pos-mandob/shared';

export interface ShareInvoicePayload {
  title: string;
  text: string;
  url?: string;
  phone?: string;
}

export interface InvoiceWhatsAppStoreInfo {
  storeName: string;
  storePhone?: string;
  currencySymbol?: string;
}

/**
 * Builds a clean, professional, itemized WhatsApp receipt message
 */
export function formatInvoiceWhatsAppText(invoice: any, storeInfo: InvoiceWhatsAppStoreInfo): string {
  const storeName = storeInfo.storeName || 'المتجر';
  const storePhone = storeInfo.storePhone;
  const currencySymbol = storeInfo.currencySymbol || 'ج.م';

  const rawTotal = invoice.total ?? invoice.total_amount ?? 0;
  const totalFormatted = formatCurrency(Number(rawTotal), currencySymbol);
  const invoiceNo = invoice.invoice_number || `#${invoice.id}`;
  const customerName = invoice.party?.name || invoice.party_name || invoice.customer_name || 'عميل نقدي';

  const isPurchaseInvoice = invoice.type === 'PURCHASE' || invoice.type === 'PURCHASE_RETURN';
  const invoiceTitle = invoice.type === 'PURCHASE'
    ? 'فاتورة مشتريات'
    : invoice.type === 'PURCHASE_RETURN'
    ? 'مرتجع مشتريات'
    : invoice.type === 'SALE_RETURN'
    ? 'مرتجع مبيعات'
    : 'فاتورة مبيعات';

  const partyRole = isPurchaseInvoice ? 'المورد' : 'العميل';

  const dateStr = invoice.date || (invoice.created_at ? new Date(invoice.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const timeStr = invoice.created_at
    ? new Date(invoice.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : '';

  let text = `🧾 *إيصال ${invoiceTitle}*\n`;
  text += `🏬 *${storeName}*\n`;
  text += `──────────────────\n`;
  text += `🔢 رقم الفاتورة: *${invoiceNo}*\n`;
  text += `📅 التاريخ: ${dateStr}${timeStr ? ` (${timeStr})` : ''}\n`;
  text += `👤 ${partyRole}: *${customerName}*\n`;
  text += `──────────────────\n`;

  const items = invoice.items || [];
  if (items.length > 0) {
    text += `📦 *الأصناف:* \n`;
    items.forEach((item: any, idx: number) => {
      const name = item.product_name || item.product?.name || item.name || `صنف #${idx + 1}`;
      const variant = item.variant_name ? ` (${item.variant_name})` : '';
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price ?? item.price ?? 0);
      const lineTotal = Number(item.total ?? item.line_total ?? (qty * unitPrice));
      text += `• ${name}${variant} × ${qty} = ${formatCurrency(lineTotal, currencySymbol)}\n`;
    });
    text += `──────────────────\n`;
  }

  const subtotal = Number(invoice.subtotal);
  const discount = Number(invoice.discount);
  const shipping = Number(invoice.shipping_amount ?? invoice.shipping_cost);

  if (subtotal && subtotal !== Number(rawTotal)) {
    text += `💵 الإجمالي قبل الخصم: ${formatCurrency(subtotal, currencySymbol)}\n`;
  }
  if (discount && discount > 0) {
    text += `✂️ الخصم: ${formatCurrency(discount, currencySymbol)}\n`;
  }
  if (shipping && shipping > 0) {
    text += `🚚 مصاريف الشحن: ${formatCurrency(shipping, currencySymbol)}\n`;
  }

  text += `💰 *الصافي المطلوب: ${totalFormatted}*\n`;

  const paymentMethodLabel = invoice.payment_method
    ? getPaymentMethodLabel(invoice.payment_method)
    : undefined;

  if (paymentMethodLabel) {
    text += `💳 طريقة السداد: ${paymentMethodLabel}\n`;
  }

  const paidAmount = Number(invoice.paid_amount);
  const remainingAmount = Number(invoice.remaining_amount ?? invoice.due_amount);

  if (paidAmount > 0 && paidAmount < Number(rawTotal)) {
    text += `💵 المدفوع: ${formatCurrency(paidAmount, currencySymbol)}\n`;
  }
  if (remainingAmount > 0) {
    text += `⚠️ المتبقي: ${formatCurrency(remainingAmount, currencySymbol)}\n`;
  }

  text += `──────────────────\n`;
  text += `✨ شكراً لتعاملكم معنا ونسعد بخدمتكم دائماً!\n`;
  if (storePhone) {
    text += `📞 للتواصل والاستفسار: ${storePhone}\n`;
  }

  return text;
}

const getVoucherRoleLabel = (role?: string | null): string => {
  switch (role) {
    case 'MANDOB':
      return 'مندوب مبيعات';
    case 'CASHIER':
      return 'كاشير';
    case 'MANAGER':
      return 'مدير فرع';
    case 'SUPERVISOR':
      return 'مشرف';
    default:
      return 'الإدارة';
  }
};

export function formatPaymentVoucherWhatsAppText(payment: any, storeInfo: InvoiceWhatsAppStoreInfo): string {
  const storeName = storeInfo.storeName || 'المتجر';
  const currencySymbol = storeInfo.currencySymbol || 'ج.م';
  const isReceipt = payment.type === 'RECEIPT';
  const voucherType = isReceipt ? 'إيصال استلام نقدية (سند قبض)' : 'إيصال صرف نقدية (سند صرف)';
  const partyName = payment.party_name || (isReceipt ? 'العميل المحترم' : 'المورد المحترم');
  const dateStr =
    payment.date ||
    (payment.created_at ? new Date(payment.created_at).toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG'));
  const timeStr = payment.created_at
    ? new Date(payment.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : '';
  const methodLabel = payment.method ? getPaymentMethodLabel(payment.method) : '-';

  let text = `🧾 *${voucherType}*\n`;
  text += `🏬 *${storeName}*\n`;
  text += `──────────────────\n`;
  text += `🔢 رقم السند: #${payment.id}\n`;
  text += `📅 التاريخ: ${dateStr}${timeStr ? ` (${timeStr})` : ''}\n`;
  text += `👤 الطرف: *${partyName}*\n`;
  text += `💰 المبلغ: *${formatCurrency(Number(payment.amount) || 0, currencySymbol)}*\n`;
  text += `💳 طريقة السداد: ${methodLabel}\n`;
  if (payment.invoice_number) {
    text += `📄 رقم الفاتورة: ${payment.invoice_number}\n`;
  }
  if (payment.notes) {
    text += `📝 البيان: ${payment.notes}\n`;
  }
  if (payment.party_balance != null && Number(payment.party_balance) !== 0) {
    text += `📊 الرصيد المتبقي: ${formatCurrency(Number(payment.party_balance), currencySymbol)}\n`;
  }
  if (payment.created_by_name) {
    text += `✍️ المسؤول: ${payment.created_by_name} (${getVoucherRoleLabel(payment.created_by_role)})\n`;
  }
  text += `──────────────────\n`;
  text += `✨ شكراً لتعاملكم معنا!\n`;
  if (storeInfo.storePhone) {
    text += `📞 للتواصل: ${storeInfo.storePhone}\n`;
  }

  return text;
}

export function formatLedgerStatementWhatsAppText(
  ledgerData: any,
  storeInfo: InvoiceWhatsAppStoreInfo,
  period?: { fromDate?: string; toDate?: string }
): string {
  const storeName = storeInfo.storeName || 'المتجر';
  const currencySymbol = storeInfo.currencySymbol || 'ج.م';
  const party = ledgerData?.party || {};
  const summary = ledgerData?.summary || {};
  const entries: any[] = Array.isArray(ledgerData?.entries) ? ledgerData.entries : [];

  const partyTypeLabel =
    party.type === 'CUSTOMER' ? 'عميل' : party.type === 'COURIER' ? 'شركة شحن' : 'مورد';
  const currentBalance = Number(summary.current_balance ?? party.current_balance ?? 0);

  let text = `📒 *ملخص كشف حساب (${partyTypeLabel})*\n`;
  text += `🏬 *${storeName}*\n`;
  text += `──────────────────\n`;
  text += `👤 الطرف: *${party.name || 'طرف التعامل'}*\n`;
  if (period?.fromDate || period?.toDate) {
    text += `📅 الفترة: ${period.fromDate || 'البداية'} ← ${period.toDate || 'اليوم'}\n`;
  }
  text += `📤 إجمالي المدين: ${formatCurrency(Number(summary.total_debit) || 0, currencySymbol)}\n`;
  text += `📥 إجمالي الدائن: ${formatCurrency(Number(summary.total_credit) || 0, currencySymbol)}\n`;
  text += `💰 *الرصيد الحالي: ${formatCurrency(currentBalance, currencySymbol)}*\n`;

  const recentEntries = entries.slice(0, 5);
  if (recentEntries.length > 0) {
    text += `──────────────────\n`;
    text += `📋 *أحدث الحركات (${recentEntries.length}):*\n`;
    recentEntries.forEach((entry: any) => {
      const amt =
        Number(entry.debit) > 0
          ? `+${formatCurrency(Number(entry.debit), currencySymbol)} مدين`
          : `-${formatCurrency(Number(entry.credit) || 0, currencySymbol)} دائن`;
      text += `• ${entry.date || ''} | ${entry.description || 'حركة'} (${amt})\n`;
    });
  }

  text += `──────────────────\n`;
  if (storeInfo.storePhone) {
    text += `📞 للتواصل والاستفسار: ${storeInfo.storePhone}\n`;
  }

  return text;
}

export interface IWebShareService {
  canShare(): boolean;
  shareInvoice(payload: ShareInvoicePayload): Promise<boolean>;
  openWhatsAppDirect(text: string, phone?: string): void;
}

class MobileWebShareService implements IWebShareService {
  canShare(): boolean {
    return typeof window !== 'undefined' && 'navigator' in window && 'share' in navigator;
  }

  async shareInvoice(payload: ShareInvoicePayload): Promise<boolean> {
    // If a phone number is provided, direct WhatsApp gives the smoothest UX
    if (payload.phone) {
      this.openWhatsAppDirect(payload.text, payload.phone);
      return true;
    }

    // Otherwise, use native Web Share sheet without forcing any unsolicited URLs
    if (this.canShare()) {
      try {
        const shareData: ShareData = {
          title: payload.title,
          text: payload.text,
        };
        if (payload.url) {
          shareData.url = payload.url;
        }
        await navigator.share(shareData);
        return true;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return false; // User cancelled share sheet
        }
      }
    }

    this.openWhatsAppDirect(payload.text);
    return true;
  }

  openWhatsAppDirect(text: string, phone?: string): void {
    let clean = phone ? phone.replace(/\D/g, '') : '';
    // Format Egyptian numbers starting with 01 to include country code 2
    if (clean.startsWith('01') && clean.length === 11) {
      clean = '2' + clean;
    }

    const encodedText = encodeURIComponent(text);
    const targetUrl = clean
      ? `https://wa.me/${clean}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
}

export const webShareService: IWebShareService = new MobileWebShareService();
