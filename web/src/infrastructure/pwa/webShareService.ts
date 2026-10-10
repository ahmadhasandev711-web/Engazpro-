/**
 * Infrastructure Layer - Web Share Service
 * Conforms to DIP (GR-7) & SoC (GR-3)
 * Provides native OS sharing for receipts & invoices on mobile with WhatsApp fallback.
 */

export interface ShareInvoicePayload {
  title: string;
  text: string;
  url?: string;
  phone?: string;
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
    if (this.canShare()) {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url || window.location.origin,
        });
        return true;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return false; // User cancelled share sheet
        }
        // Fallback to WhatsApp if share failed
      }
    }

    this.openWhatsAppDirect(payload.text, payload.phone);
    return true;
  }

  openWhatsAppDirect(text: string, phone?: string): void {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    const encodedText = encodeURIComponent(text);
    const targetUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
}

export const webShareService: IWebShareService = new MobileWebShareService();
