/**
 * Infrastructure Layer - Web Share Service
 * Conforms to DIP (GR-7) & SoC (GR-3)
 * Provides native OS sharing for receipts & invoices on mobile with WhatsApp fallback.
 */

import { formatCurrency } from '@pos-mandob/shared';

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

  const paymentMethodLabel =
    invoice.payment_method === 'CASH'
      ? 'نقدي (كاش)'
      : invoice.payment_method === 'CARD'
      ? 'بطاقة بنكية / فيزا'
      : invoice.payment_method === 'INSTAPAY'
      ? 'إنستاباي (InstaPay)'
      : invoice.payment_method === 'VODAFONE_CASH'
      ? 'فودافون كاش'
      : invoice.payment_method === 'COURIER_COD'
      ? 'تحصيل شحن (COD)'
      : invoice.payment_method === 'SPLIT'
      ? 'دفع مجزأ'
      : invoice.payment_method === 'TRANSFER'
      ? 'تحويل بنكي'
      : invoice.payment_method === 'CREDIT'
      ? 'آجل على الحساب'
      : invoice.payment_method;

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
