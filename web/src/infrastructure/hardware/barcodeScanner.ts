/**
 * Camera barcode scanning through the browser BarcodeDetector and getUserMedia.
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

export interface IScannerService {
  isSupported(): boolean;
  isNative(): boolean;
  startCamera(videoElement: HTMLVideoElement): Promise<MediaStream>;
  stopCamera(stream: MediaStream | null): void;
  detectBarcode(source: HTMLVideoElement): Promise<string | null>;
  scanNative(): Promise<string | null>;
}

class BrowserBarcodeScannerService implements IScannerService {
  private detector: { detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>> } | null = null;

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

  async startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    if (!this.isSupported()) {
      throw new Error('كاميرا الجهاز غير مدعومة أو المتصفح لا يملك صلاحية الوصول للكاميرا.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    videoElement.srcObject = stream;
    await videoElement.play();
    return stream;
  }

  stopCamera(stream: MediaStream | null): void {
    stream?.getTracks().forEach((track) => track.stop());
  }

  async detectBarcode(source: HTMLVideoElement): Promise<string | null> {
    if (!this.detector || source.readyState < 2) return null;
    try {
      const barcodes = await this.detector.detect(source);
      const value = barcodes[0]?.rawValue?.trim();
      return value || null;
    } catch {
      return null;
    }
  }
}

export const barcodeScannerService: IScannerService = new BrowserBarcodeScannerService();
