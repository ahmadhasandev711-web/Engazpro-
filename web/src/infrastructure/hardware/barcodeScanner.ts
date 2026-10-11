/**
 * Infrastructure Layer - Barcode Scanner Service
 * Conforms to DIP (GR-7), GR-5 (Zero Memory Leak) & SoC (GR-3)
 * Controls mobile camera media streams and executes native BarcodeDetector if available.
 */

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

import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Haptics, NotificationType } from '@capacitor/haptics';

export interface IScannerService {
  isSupported(): boolean;
  isNative(): boolean;
  startCamera(videoElement: HTMLVideoElement): Promise<MediaStream>;
  stopCamera(stream: MediaStream | null): void;
  detectBarcode(source: HTMLVideoElement): Promise<string | null>;
  scanNative(): Promise<string | null>;
}

class NativeBarcodeScannerService implements IScannerService {
  private detector: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        this.detector = new window.BarcodeDetector!({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'],
        });
      } catch {
        this.detector = null;
      }
    }
  }

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  async scanNative(): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return null;

    try {
      // 1. Ensure Google Barcode Scanner module is available on Android
      if (Capacitor.getPlatform() === 'android') {
        try {
          const mod = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
          if (!mod.available) {
            await BarcodeScanner.installGoogleBarcodeScannerModule();
          }
        } catch {
          // Continue to standard scan if check fails
        }
      }

      // 2. Check and request camera permissions
      const perm = await BarcodeScanner.checkPermissions();
      if (perm.camera !== 'granted') {
        const req = await BarcodeScanner.requestPermissions();
        if (req.camera !== 'granted') {
          throw new Error('يرجى منح صلاحية الكاميرا لمسح الباركود');
        }
      }

      // 3. Launch Native Camera Viewfinder
      const result = await BarcodeScanner.scan();
      if (result.barcodes && result.barcodes.length > 0) {
        const code = result.barcodes[0].rawValue?.trim();
        if (code) {
          try {
            await Haptics.notification({ type: NotificationType.Success });
          } catch {}
          return code;
        }
      }
    } catch (err: any) {
      // Handle user cancellation gracefully
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('canceled') || msg.includes('cancelled') || msg.includes('dismissed')) {
        return null;
      }
      throw err;
    }

    return null;
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'navigator' in window &&
      'mediaDevices' in navigator &&
      'getUserMedia' in navigator.mediaDevices
    );
  }

  async startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    if (!this.isSupported()) {
      throw new Error('كاميرا الجهاز غير مدعومة أو المتصفح لا يملك صلاحية الوصول للكاميرا.');
    }

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;
    await videoElement.play();
    return stream;
  }

  stopCamera(stream: MediaStream | null): void {
    if (!stream) return;
    try {
      const tracks = stream.getTracks();
      tracks.forEach((track) => {
        track.stop();
      });
    } catch {
      // Clean silent shutdown
    }
  }

  async detectBarcode(source: HTMLVideoElement): Promise<string | null> {
    if (!this.detector || source.readyState < 2) {
      return null;
    }

    try {
      const barcodes = await this.detector.detect(source);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue.trim();
      }
    } catch {
      // Detection failure on frame - continue next frame
    }

    return null;
  }
}

export const barcodeScannerService: IScannerService = new NativeBarcodeScannerService();
