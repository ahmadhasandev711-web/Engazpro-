import { useState, useRef, useEffect, useCallback } from 'react';
import { barcodeScannerService } from '../../infrastructure/hardware/barcodeScanner';
import { useHaptic } from './useHaptic';

interface UseCameraScannerProps {
  onScan: (barcode: string) => void;
  isOpen: boolean;
}

/**
 * Application Layer - useCameraScanner Hook
 * Conforms to GR-5 (Zero Resource Leaks) & SoC (GR-3)
 * Manages video feed, barcode polling interval, and camera hardware release.
 */
export const useCameraScanner = ({ onScan, isOpen }: UseCameraScannerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { success } = useHaptic();

  const stop = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (streamRef.current) {
      barcodeScannerService.stopCamera(streamRef.current);
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const start = useCallback(async () => {
    if (!videoRef.current) return;
    setError(null);

    try {
      const stream = await barcodeScannerService.startCamera(videoRef.current);
      streamRef.current = stream;
      setIsStreaming(true);

      // Start detection loop every 200ms
      pollIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        const code = await barcodeScannerService.detectBarcode(videoRef.current);
        if (code) {
          success();
          stop();
          onScan(code);
        }
      }, 200);
    } catch (err: any) {
      setError(err?.message || 'تعذر تشغيل الكاميرا. يرجى التأكد من إعطاء المتصفح صلاحية الكاميرا.');
      stop();
    }
  }, [onScan, stop, success]);

  // Clean lifecycle handling based on isOpen
  useEffect(() => {
    if (isOpen) {
      // Delay camera initialization slightly to allow DOM video element to mount
      const timer = setTimeout(() => {
        start();
      }, 100);
      return () => {
        clearTimeout(timer);
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
    start,
    stop,
  };
};
