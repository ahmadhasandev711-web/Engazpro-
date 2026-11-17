import { useState, useRef, useEffect, useCallback } from 'react';
import { barcodeScannerService, CameraFacingMode } from '../../infrastructure/hardware/barcodeScanner';
import { useHaptic } from './useHaptic';
import { playScanFeedbackTone } from '../utils/scanAudio';

export type CameraScanMode = 'single' | 'continuous';

export interface ScanFeedbackEvent {
  id: number;
  code: string;
  ok: boolean;
}

interface UseCameraScannerProps {
  onScan: (barcode: string) => Promise<boolean> | boolean;
  onClose?: () => void;
  isOpen: boolean;
  mode: CameraScanMode;
}

const SCAN_INTERVAL_MS = 180;
const DUPLICATE_COOLDOWN_MS = 1400;

/**
 * Application Layer - useCameraScanner Hook
 * Conforms to GR-5 (Zero Resource Leaks) & SoC (GR-3).
 * Handles recursive non-overlapping frame detection, torch control, audio/haptic feedback,
 * single vs continuous cart scanning, and per-barcode duplicate cooldown.
 */
export const useCameraScanner = ({ onScan, onClose, isOpen, mode }: UseCameraScannerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const activeRunRef = useRef<boolean>(false);
  const isHandlingScanRef = useRef<boolean>(false);
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const modeRef = useRef<CameraScanMode>(mode);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  modeRef.current = mode;
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  const [facingMode, setFacingMode] = useState<CameraFacingMode>('environment');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isTorchSupported, setIsTorchSupported] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState<number>(0);
  const [lastScanEvent, setLastScanEvent] = useState<ScanFeedbackEvent | null>(null);

  const { success, error: hapticError, selection } = useHaptic();

  const stop = useCallback(() => {
    activeRunRef.current = false;
    isHandlingScanRef.current = false;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      barcodeScannerService.stopCamera(streamRef.current);
      streamRef.current = null;
    }
    setIsStreaming(false);
    setIsTorchSupported(false);
    setIsTorchOn(false);
  }, []);

  const scheduleNextFrame = useCallback(() => {
    if (!activeRunRef.current) return;
    timerRef.current = window.setTimeout(async () => {
      if (!activeRunRef.current || !videoRef.current || isHandlingScanRef.current) {
        scheduleNextFrame();
        return;
      }

      const code = await barcodeScannerService.detectBarcode(videoRef.current);
      if (!activeRunRef.current) return;

      if (code) {
        const now = Date.now();
        const lastSeen = cooldownMapRef.current.get(code) ?? 0;
        if (now - lastSeen >= DUPLICATE_COOLDOWN_MS) {
          cooldownMapRef.current.set(code, now);
          isHandlingScanRef.current = true;
          try {
            const found = await Promise.resolve(onScanRef.current(code));
            if (!activeRunRef.current) return;

            setLastScanEvent({ id: now, code, ok: found });
            if (found) {
              playScanFeedbackTone('success');
              success();
              setScannedCount((c) => c + 1);
              if (modeRef.current === 'single') {
                stop();
                onCloseRef.current?.();
                return;
              }
            } else {
              playScanFeedbackTone('error');
              hapticError();
            }
          } finally {
            isHandlingScanRef.current = false;
          }
        }
      }

      scheduleNextFrame();
    }, SCAN_INTERVAL_MS);
  }, [hapticError, stop, success]);

  const start = useCallback(async () => {
    if (!videoRef.current) return;
    stop();
    activeRunRef.current = true;
    setError(null);

    try {
      const stream = await barcodeScannerService.startCamera(videoRef.current, facingMode);
      if (!activeRunRef.current) {
        barcodeScannerService.stopCamera(stream);
        return;
      }
      streamRef.current = stream;
      setIsStreaming(true);
      setIsTorchSupported(barcodeScannerService.supportsTorch(stream));
      setIsTorchOn(false);
      scheduleNextFrame();
    } catch (err: any) {
      setError(err?.message || 'تعذر تشغيل الكاميرا. يرجى التأكد من إعطاء المتصفح صلاحية الكاميرا.');
      stop();
    }
  }, [facingMode, scheduleNextFrame, stop]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !isTorchSupported) return;
    const next = !isTorchOn;
    const applied = await barcodeScannerService.toggleTorch(streamRef.current, next);
    setIsTorchOn(applied);
    selection();
  }, [isTorchOn, isTorchSupported, selection]);

  const switchCamera = useCallback(() => {
    selection();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, [selection]);

  useEffect(() => {
    if (isOpen) {
      setScannedCount(0);
      setLastScanEvent(null);
      cooldownMapRef.current.clear();
      const bootTimer = window.setTimeout(() => {
        void start();
      }, 90);
      return () => {
        window.clearTimeout(bootTimer);
        stop();
      };
    } else {
      stop();
    }
  }, [isOpen, start, stop]);

  return {
    videoRef,
    isStreaming,
    error,
    isSupported: barcodeScannerService.isSupported(),
    isTorchSupported,
    isTorchOn,
    facingMode,
    scannedCount,
    lastScanEvent,
    toggleTorch,
    switchCamera,
    start,
    stop,
  };
};
