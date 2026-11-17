/**
 * Camera barcode scanning through browser BarcodeDetector with lazy @zxing/browser
 * fallback for Safari/Firefox, plus clean Native bridge hooks for Capacitor MLKit.
 */

import type { BrowserMultiFormatReader } from '@zxing/browser';

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): {
        detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>;
      };
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

export type CameraFacingMode = 'environment' | 'user';

export interface IScannerService {
  isSupported(): boolean;
  isNative(): boolean;
  startCamera(videoElement: HTMLVideoElement, facingMode?: CameraFacingMode): Promise<MediaStream>;
  stopCamera(stream: MediaStream | null): void;
  supportsTorch(stream: MediaStream | null): boolean;
  toggleTorch(stream: MediaStream | null, enabled: boolean): Promise<boolean>;
  detectBarcode(source: HTMLVideoElement): Promise<string | null>;
  scanNative(): Promise<string | null>;
}

const SUPPORTED_FORMATS = [
  'ean_13',
  'ean_8',
  'code_128',
  'code_39',
  'upc_a',
  'upc_e',
  'itf',
  'qr_code',
];

class BrowserBarcodeScannerService implements IScannerService {
  private detector: { detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>> } | null = null;
  private zxingReaderPromise: Promise<BrowserMultiFormatReader> | null = null;
  private captureCanvas: HTMLCanvasElement | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        this.detector = new window.BarcodeDetector!({ formats: SUPPORTED_FORMATS });
      } catch {
        this.detector = null;
      }
    }
  }

  isNative(): boolean {
    return false;
  }

  async scanNative(): Promise<string | null> {
    return null;
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'navigator' in window &&
      'mediaDevices' in navigator &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    );
  }

  async startCamera(
    videoElement: HTMLVideoElement,
    facingMode: CameraFacingMode = 'environment'
  ): Promise<MediaStream> {
    if (!this.isSupported()) {
      const isSecure = typeof window !== 'undefined' && window.isSecureContext;
      throw new Error(
        isSecure
          ? 'المتصفح لا يدعم الوصول إلى كاميرا الجهاز.'
          : 'تشغيل الكاميرا يتطلب فتح النظام عبر HTTPS (أو localhost).'
      );
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      videoElement.srcObject = stream;
      await videoElement.play();
      return stream;
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        throw new Error('تم رفض صلاحية الكاميرا. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح.');
      }
      if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        throw new Error('لم يتم العثور على كاميرا متصلة بهذا الجهاز.');
      }
      throw new Error(err?.message || 'تعذر تشغيل الكاميرا.');
    }
  }

  stopCamera(stream: MediaStream | null): void {
    stream?.getTracks().forEach((track) => track.stop());
  }

  supportsTorch(stream: MediaStream | null): boolean {
    const track = stream?.getVideoTracks?.()[0];
    if (!track || typeof track.getCapabilities !== 'function') return false;
    const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    return Boolean(caps?.torch);
  }

  async toggleTorch(stream: MediaStream | null, enabled: boolean): Promise<boolean> {
    const track = stream?.getVideoTracks?.()[0];
    if (!track || !this.supportsTorch(stream)) return false;
    try {
      await track.applyConstraints({
        advanced: [{ torch: enabled } as MediaTrackConstraintSet],
      });
      return enabled;
    } catch {
      return false;
    }
  }

  async detectBarcode(source: HTMLVideoElement): Promise<string | null> {
    if (source.readyState < 2 || source.videoWidth === 0 || source.videoHeight === 0) {
      return null;
    }

    if (this.detector) {
      try {
        const barcodes = await this.detector.detect(source);
        const value = barcodes[0]?.rawValue?.trim();
        return value || null;
      } catch {
        // Fallback cleanly to ZXing if browser BarcodeDetector throws on frame
      }
    }

    return this.detectWithZxingFallback(source);
  }

  private async getZxingReader(): Promise<BrowserMultiFormatReader> {
    if (!this.zxingReaderPromise) {
      this.zxingReaderPromise = import('@zxing/browser').then(
        ({ BrowserMultiFormatReader }) => new BrowserMultiFormatReader()
      );
    }
    return this.zxingReaderPromise;
  }

  private async detectWithZxingFallback(source: HTMLVideoElement): Promise<string | null> {
    try {
      const reader = await this.getZxingReader();
      if (!this.captureCanvas) {
        this.captureCanvas = document.createElement('canvas');
      }

      const maxWidth = 720;
      const scale = source.videoWidth > maxWidth ? maxWidth / source.videoWidth : 1;
      const targetW = Math.max(1, Math.round(source.videoWidth * scale));
      const targetH = Math.max(1, Math.round(source.videoHeight * scale));

      if (this.captureCanvas.width !== targetW || this.captureCanvas.height !== targetH) {
        this.captureCanvas.width = targetW;
        this.captureCanvas.height = targetH;
      }

      const ctx = this.captureCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0, targetW, targetH);

      const result = reader.decodeFromCanvas(this.captureCanvas);
      return result?.getText()?.trim() || null;
    } catch {
      return null;
    }
  }
}

export const barcodeScannerService: IScannerService = new BrowserBarcodeScannerService();
