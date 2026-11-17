import React, { useState, useEffect } from 'react';
import {
  Camera,
  X,
  AlertCircle,
  ScanLine,
  ArrowLeft,
  Zap,
  ZapOff,
  SwitchCamera,
  CheckCircle2,
  Layers,
  Check,
} from 'lucide-react';
import { CameraScanMode, useCameraScanner } from '../../hooks/useCameraScanner';
import { barcodeScannerService } from '../../../infrastructure/hardware/barcodeScanner';
import { nativeBackButton } from '../../../platform/nativeBackButton';
import { cn } from '../../utils/cn';
import { Button } from '../ui';

interface MobileCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => Promise<boolean> | boolean;
}

/**
 * Presentation Layer - MobileCameraScannerModal
 * Conforms to GR-5 (Immediate camera hardware release on close) & SoC (GR-3).
 * Provides native Capacitor MLKit hook and WebRTC/ZXing viewfinder fallback on web/PWA.
 */
export const MobileCameraScannerModal: React.FC<MobileCameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const [scanMode, setScanMode] = useState<CameraScanMode>('single');
  const [manualCode, setManualCode] = useState<string>('');
  const [nativeError, setNativeError] = useState<string | null>(null);
  const isNative = barcodeScannerService.isNative();

  useEffect(() => {
    if (!isOpen) return;
    return nativeBackButton.register(() => {
      onClose();
      return true;
    });
  }, [isOpen, onClose]);

  const {
    videoRef,
    isStreaming,
    error: webError,
    isSupported,
    isTorchSupported,
    isTorchOn,
    scannedCount,
    lastScanEvent,
    toggleTorch,
    switchCamera,
  } = useCameraScanner({
    onScan,
    onClose,
    isOpen: isOpen && !isNative,
    mode: scanMode,
  });

  useEffect(() => {
    if (!isOpen || !isNative) return;

    let isSubscribed = true;
    (async () => {
      try {
        setNativeError(null);
        const code = await barcodeScannerService.scanNative();
        if (!isSubscribed) return;
        if (code) {
          await Promise.resolve(onScan(code));
        }
        onClose();
      } catch (err: any) {
        if (!isSubscribed) return;
        setNativeError(err?.message || 'تعذر تشغيل كاميرا الباركود. يمكنك إدخال الكود يدوياً بالأسفل.');
      }
    })();

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, isNative, onScan, onClose]);

  if (!isOpen) return null;

  const error = isNative ? nativeError : webError;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    const found = await Promise.resolve(onScan(code));
    if (found) {
      setManualCode('');
      if (scanMode === 'single') {
        onClose();
      }
    }
  };

  const frameRingClass = lastScanEvent
    ? lastScanEvent.ok
      ? 'border-ok'
      : 'border-bad'
    : 'border-brand/80';

  const cornerClass = lastScanEvent
    ? lastScanEvent.ok
      ? 'border-ok'
      : 'border-bad'
    : 'border-brand';

  return (
    <div
      className="fixed inset-0 z-50 bg-canvas/95 flex flex-col justify-between text-ink animate-in fade-in duration-200"
      dir="rtl"
    >
      {/* Top Controls Bar */}
      <div className="p-3 sm:p-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] border-b border-line bg-panel/95 backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-soft border border-brand/20 flex items-center justify-center text-brand shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm text-ink truncate">ماسح الباركود بالكاميرا</h3>
              <p className="text-2xs text-muted font-bold truncate">
                {scanMode === 'continuous'
                  ? `مسح متتالي للسلة · تم إضافة ${scannedCount}`
                  : 'مسح سريع لصنف واحد'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isTorchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className={cn(
                  'w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95',
                  isTorchOn
                    ? 'bg-warn-soft border-warn text-warn'
                    : 'bg-surface-2 border-line text-muted hover:text-ink'
                )}
                title={isTorchOn ? 'إطفاء الفلاش' : 'تشغيل الفلاش'}
                aria-label="الفلاش"
              >
                {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            {isSupported && !isNative && (
              <button
                type="button"
                onClick={switchCamera}
                className="w-9 h-9 rounded-xl bg-surface-2 border border-line text-muted hover:text-ink flex items-center justify-center transition-all cursor-pointer active:scale-95"
                title="تبديل الكاميرا"
                aria-label="تبديل الكاميرا"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-surface-2 border border-line text-muted hover:text-ink flex items-center justify-center transition-all cursor-pointer active:scale-95"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Selector Pill */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-2 rounded-2xl border border-line text-xs">
          <button
            type="button"
            onClick={() => setScanMode('single')}
            className={cn(
              'py-1.5 px-3 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              scanMode === 'single'
                ? 'bg-panel text-ink shadow-2xs border border-line'
                : 'text-muted hover:text-ink'
            )}
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>صنف واحد</span>
          </button>
          <button
            type="button"
            onClick={() => setScanMode('continuous')}
            className={cn(
              'py-1.5 px-3 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              scanMode === 'continuous'
                ? 'bg-brand text-on-brand shadow-xs'
                : 'text-muted hover:text-ink'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>مسح متتالي للسلة</span>
          </button>
        </div>
      </div>

      {/* Main Viewfinder Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden p-4">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-canvas/35 pointer-events-none" />

        {/* Viewfinder Target Frame */}
        <div
          className={cn(
            'relative z-10 w-72 h-64 sm:w-80 sm:h-64 border-2 rounded-3xl flex flex-col items-center justify-center shadow-[0_0_0_9999px_rgb(var(--c-canvas)/0.62)] overflow-hidden transition-colors duration-200',
            frameRingClass
          )}
        >
          <div className={cn('absolute top-2.5 right-2.5 w-7 h-7 border-t-4 border-r-4 rounded-tr-xl', cornerClass)} />
          <div className={cn('absolute top-2.5 left-2.5 w-7 h-7 border-t-4 border-l-4 rounded-tl-xl', cornerClass)} />
          <div className={cn('absolute bottom-2.5 right-2.5 w-7 h-7 border-b-4 border-r-4 rounded-br-xl', cornerClass)} />
          <div className={cn('absolute bottom-2.5 left-2.5 w-7 h-7 border-b-4 border-l-4 rounded-bl-xl', cornerClass)} />

          {isStreaming && (
            <div className="absolute inset-x-4 top-0 h-0.5 bg-gradient-to-r from-transparent via-brand to-transparent animate-scan-beam pointer-events-none" />
          )}

          <div className="text-center px-5 pointer-events-none space-y-1.5">
            <ScanLine className="w-7 h-7 text-brand mx-auto opacity-85" />
            <p className="text-xs font-black text-ink bg-panel/80 px-3 py-1 rounded-full border border-line backdrop-blur-xs">
              وجّه الكاميرا نحو باركود الصنف
            </p>
          </div>
        </div>

        {/* Live Scan Result HUD */}
        {lastScanEvent && (
          <div
            className={cn(
              'relative z-20 mt-4 px-4 py-2 rounded-2xl border text-xs font-black flex items-center gap-2 shadow-lg backdrop-blur-md animate-in fade-in duration-150',
              lastScanEvent.ok
                ? 'bg-ok-soft border-ok text-ok'
                : 'bg-bad-soft border-bad text-bad'
            )}
          >
            {lastScanEvent.ok ? (
              <>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="tabular-nums">تم مسح الباركود: {lastScanEvent.code}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="tabular-nums">باركود غير مسجل: {lastScanEvent.code}</span>
              </>
            )}
          </div>
        )}

        {/* Camera Permission / Support Error */}
        {(!isSupported || error) && (
          <div className="absolute z-20 inset-x-4 max-w-sm mx-auto bg-bad-soft/95 border border-bad/40 p-4 rounded-2xl text-ink text-xs flex items-start gap-3 backdrop-blur-md shadow-2xl">
            <AlertCircle className="w-5 h-5 text-bad shrink-0 mt-0.5" />
            <div>
              <p className="font-black mb-1">تعذر تشغيل الكاميرا</p>
              <p className="text-2xs leading-relaxed text-muted">
                {error || 'المتصفح لا يدعم الوصول للكاميرا أو تم حظر الصلاحية. يمكنك إدخال الباركود يدوياً بالأسفل.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Manual Fallback + Finish CTA */}
      <div className="p-3.5 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-panel/95 border-t border-line backdrop-blur-md space-y-2.5">
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="أو أدخل رقم الباركود يدوياً..."
            className="flex-1 min-h-[44px] bg-surface-2 border border-line rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand tabular-nums"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!manualCode.trim()}
            rightIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="min-h-[44px] text-xs font-black shrink-0"
          >
            تأكيد
          </Button>
        </form>

        {scanMode === 'continuous' && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onClose}
            leftIcon={<Check className="w-4 h-4 text-ok" />}
            className="w-full min-h-[44px] font-black text-xs"
          >
            {scannedCount > 0 ? `إنهاء والعودة للفاتورة (${scannedCount} أصناف)` : 'إغلاق الماسح'}
          </Button>
        )}
      </div>
    </div>
  );
};
