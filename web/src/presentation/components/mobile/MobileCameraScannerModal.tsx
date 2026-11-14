import React, { useState, useEffect } from 'react';
import { Camera, X, AlertCircle, ScanLine, ArrowLeft } from 'lucide-react';
import { useCameraScanner } from '../../hooks/useCameraScanner';
import { barcodeScannerService } from '../../../infrastructure/hardware/barcodeScanner';
import { nativeBackButton } from '../../../platform/nativeBackButton';
import { Button } from '../ui';

interface MobileCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

/**
 * Presentation Layer - MobileCameraScannerModal
 * Conforms to GR-5 (Immediate camera hardware release on close) & SoC (GR-3)
 * Provides native Google MLKit scanner on mobile devices and HTML5 viewfinder fallback on web.
 */
export const MobileCameraScannerModal: React.FC<MobileCameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const [manualCode, setManualCode] = useState<string>('');
  const [nativeError, setNativeError] = useState<string | null>(null);
  const isNative = barcodeScannerService.isNative();

  // Hardware Back Button integration
  useEffect(() => {
    if (!isOpen) return;
    return nativeBackButton.register(() => {
      onClose();
      return true;
    });
  }, [isOpen, onClose]);

  const { videoRef, isStreaming, error: webError, isSupported } = useCameraScanner({
    onScan: (code) => {
      onScan(code);
      onClose();
    },
    isOpen: isOpen && !isNative,
  });

  // Native Mobile MLKit Scanner Execution
  useEffect(() => {
    if (!isOpen || !isNative) return;

    let isSubscribed = true;
    (async () => {
      try {
        setNativeError(null);
        const code = await barcodeScannerService.scanNative();
        if (!isSubscribed) return;
        if (code) {
          onScan(code);
          onClose();
        } else {
          // Scanned cancelled by user
          onClose();
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        setNativeError(err?.message || 'تعذر تشغيل كاميرا الباركود. يرجى مراجعة الصلاحيات أو إدخال الكود يدوياً.');
      }
    })();

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, isNative, onScan, onClose]);

  if (!isOpen) return null;

  const error = isNative ? nativeError : webError;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-canvas/95 flex flex-col justify-between text-ink animate-in fade-in duration-200" dir="rtl">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] border-b border-line bg-panel/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-ok" />
          <h3 className="font-black text-sm text-ink">ماسح الباركود بالكاميرا</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onClose}
          className="px-2 rounded-full text-muted hover:text-ink"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Main Viewfinder Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Live Video Feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Darkened Viewport Mask */}
        <div className="absolute inset-0 bg-canvas/40 pointer-events-none" />

        {/* Viewfinder Target Frame */}
        <div className="relative z-10 w-72 h-72 border-2 border-ok/80 rounded-3xl flex flex-col items-center justify-center shadow-[0_0_0_9999px_rgb(var(--c-canvas)/0.65)] overflow-hidden">
          {/* Corner Guides */}
          <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-ok rounded-tr-lg" />
          <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-ok rounded-tl-lg" />
          <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-ok rounded-br-lg" />
          <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-ok rounded-bl-lg" />

          {/* Animated Laser Scanning Line */}
          {isStreaming && (
            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-bad to-transparent shadow-sm animate-pulse" />
          )}

          <div className="text-center px-4 pointer-events-none">
            <ScanLine className="w-8 h-8 text-ok mx-auto mb-2 animate-bounce" />
            <p className="text-xs font-bold text-ink drop-shadow-md">
              وجّه الكاميرا نحو باركود الصنف
            </p>
          </div>
        </div>

        {/* Camera Permission / Support Error */}
        {(!isSupported || error) && (
          <div className="absolute z-20 inset-x-4 max-w-sm mx-auto bg-bad-soft/95 border border-bad/40 p-4 rounded-2xl text-ink text-xs flex items-start gap-3 backdrop-blur-md shadow-2xl">
            <AlertCircle className="w-5 h-5 text-bad shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">تعذر الوصول للكاميرا</p>
              <p className="text-2xs leading-relaxed text-muted">
                {error || 'المتصفح لا يدعم الوصول للكاميرا أو تم حظر الصلاحية. يمكنك إدخال الباركود يدوياً بالأسفل.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Manual Fallback Input Area */}
      <div className="p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] bg-panel/95 border-t border-line backdrop-blur-md space-y-3">
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="أو أدخل رقم الباركود يدوياً..."
            className="flex-1 min-h-[44px] bg-surface-2 border border-line rounded-xl px-3.5 py-2.5 text-xs text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!manualCode.trim()}
            rightIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="text-xs font-black shrink-0 bg-ok hover:bg-ok/90"
          >
            تأكيد
          </Button>
        </form>
      </div>
    </div>
  );
};
