import React, { useState, useEffect } from 'react';
import { Camera, X, AlertCircle, ScanLine, ArrowLeft } from 'lucide-react';
import { useCameraScanner } from '../../hooks/useCameraScanner';
import { barcodeScannerService } from '../../../infrastructure/hardware/barcodeScanner';
import { nativeBackButton } from '../../../platform/nativeBackButton';

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
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col justify-between text-white animate-in fade-in duration-200" dir="rtl">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-400" />
          <h3 className="font-black text-sm text-white">ماسح الباركود بالكاميرا</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-300 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>
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
        <div className="absolute inset-0 bg-slate-950/40 pointer-events-none" />

        {/* Viewfinder Target Frame */}
        <div className="relative z-10 w-72 h-72 border-2 border-emerald-400/80 rounded-3xl flex flex-col items-center justify-center shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] overflow-hidden">
          {/* Corner Guides */}
          <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
          <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
          <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
          <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />

          {/* Animated Laser Scanning Line */}
          {isStreaming && (
            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_2px_rgba(244,63,94,0.8)] animate-pulse" />
          )}

          <div className="text-center px-4 pointer-events-none">
            <ScanLine className="w-8 h-8 text-emerald-300/80 mx-auto mb-2 animate-bounce" />
            <p className="text-xs font-bold text-white drop-shadow-md">
              وجّه الكاميرا نحو باركود الصنف
            </p>
          </div>
        </div>

        {/* Camera Permission / Support Error */}
        {(!isSupported || error) && (
          <div className="absolute z-20 inset-x-4 max-w-sm mx-auto bg-rose-950/90 border border-rose-500/50 p-4 rounded-2xl text-rose-100 text-xs flex items-start gap-3 backdrop-blur-md shadow-2xl">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">تعذر الوصول للكاميرا</p>
              <p className="text-[11px] leading-relaxed opacity-90">
                {error || 'المتصفح لا يدعم الوصول للكاميرا أو تم حظر الصلاحية. يمكنك إدخال الباركود يدوياً بالأسفل.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Manual Fallback Input Area */}
      <div className="p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] bg-slate-900/90 border-t border-white/10 backdrop-blur-md space-y-3">
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="أو أدخل رقم الباركود يدوياً..."
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0"
          >
            <span>تأكيد</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
