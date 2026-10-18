/**
 * Infrastructure Layer - ESC/POS thermal printer (Bluetooth) on native Android.
 * GR-7 (DIP) + GR-6.1: hardware adapter; UI calls this service only.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Money } from '@pos-mandob/shared';
import { BluetoothPrinter, EscPosPrinter } from '@fedejm/capacitor-esc-pos-printer';

const PRINTER_MAC_KEY = 'thermal_printer_mac';

export interface ThermalReceiptLine {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ThermalReceiptPayload {
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  invoiceNumber: string;
  dateLabel: string;
  timeLabel: string;
  cashierName: string;
  customerName: string;
  lines: ThermalReceiptLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paidAmount: number;
  currencySymbol: string;
}

export interface IThermalPrinterService {
  isSupported(): boolean;
  printReceipt(payload: ThermalReceiptPayload): Promise<void>;
}

const formatMoney = (amount: number, symbol: string): string =>
  `${Money.of(amount).getAmount().toFixed(2)} ${symbol}`;

const buildReceiptText = (payload: ThermalReceiptPayload): string => {
  const lines: string[] = [];
  lines.push(payload.storeName);
  lines.push('فاتورة مبيعات');
  if (payload.storePhone) lines.push(`هاتف: ${payload.storePhone}`);
  if (payload.storeAddress) lines.push(payload.storeAddress);
  lines.push('--------------------------------');
  lines.push(`رقم: ${payload.invoiceNumber}`);
  lines.push(`التاريخ: ${payload.dateLabel} ${payload.timeLabel}`);
  lines.push(`الكاشير: ${payload.cashierName}`);
  lines.push(`العميل: ${payload.customerName}`);
  lines.push('--------------------------------');

  for (const item of payload.lines) {
    lines.push(item.name);
    lines.push(
      `${item.quantity} x ${formatMoney(item.unitPrice, payload.currencySymbol)} = ${formatMoney(
        item.lineTotal,
        payload.currencySymbol
      )}`
    );
  }

  lines.push('--------------------------------');
  lines.push(`الإجمالي: ${formatMoney(payload.total, payload.currencySymbol)}`);
  if (payload.discount > 0) {
    lines.push(`الخصم: ${formatMoney(payload.discount, payload.currencySymbol)}`);
  }
  if (payload.shipping > 0) {
    lines.push(`الشحن: ${formatMoney(payload.shipping, payload.currencySymbol)}`);
  }
  lines.push(`المدفوع: ${formatMoney(payload.paidAmount, payload.currencySymbol)}`);
  lines.push('شكراً لتعاملكم معنا');
  return lines.join('\n');
};

const textToEscPosPayload = (text: string): number[] => {
  const init = [0x1b, 0x40];
  const encoded = Array.from(new TextEncoder().encode(text));
  const tail = [0x0a, 0x0a, 0x1d, 0x56, 0x00];
  return [...init, ...encoded, ...tail];
};

const resolvePrinterAddress = async (): Promise<string> => {
  const saved = await Preferences.get({ key: PRINTER_MAC_KEY });
  if (saved.value) return saved.value;

  await EscPosPrinter.requestBluetoothEnable();
  const { devices } = await EscPosPrinter.getBluetoothPrinterDevices();
  if (!devices.length) {
    throw new Error('NO_PRINTER');
  }

  const address = devices[0].address;
  await Preferences.set({ key: PRINTER_MAC_KEY, value: address });
  return address;
};

class NativeThermalPrinterService implements IThermalPrinterService {
  isSupported(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  async printReceipt(payload: ThermalReceiptPayload): Promise<void> {
    const address = await resolvePrinterAddress();
    const printer = new BluetoothPrinter(address);
    const bytes = textToEscPosPayload(buildReceiptText(payload));

    try {
      await printer.link();
      await printer.connect();
      await printer.send(bytes);
    } finally {
      try {
        await printer.disconnect();
      } catch {
        /* ignore */
      }
      try {
        await printer.dispose();
      } catch {
        /* ignore */
      }
    }
  }
}

class WebThermalPrinterService implements IThermalPrinterService {
  isSupported(): boolean {
    return false;
  }

  async printReceipt(): Promise<void> {
    throw new Error('Thermal Bluetooth printing is only available in the mobile app.');
  }
}

export const thermalPrinterService: IThermalPrinterService = Capacitor.isNativePlatform()
  ? new NativeThermalPrinterService()
  : new WebThermalPrinterService();
