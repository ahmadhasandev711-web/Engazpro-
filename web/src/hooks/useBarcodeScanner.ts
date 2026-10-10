import { useEffect, useRef } from 'react';

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  minChars?: number;
  maxIntervalMs?: number;
  enableSound?: boolean;
}

/**
 * Web Audio API synthesizer for a subtle, instant confirmation beep
 */
const playBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz (A5)
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // Non-fatal if audio context blocked by browser policy
  }
};

export const useBarcodeScanner = ({
  onScan,
  minChars = 3,
  maxIntervalMs = 60,
  enableSound = true,
}: UseBarcodeScannerProps) => {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in textareas or inputs that are not meant for scanning
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      // If typing inside standard text input with name/id other than barcode-search, skip global capture
      if (isInput && activeEl?.getAttribute('data-barcode-capture') !== 'true') {
        return;
      }

      const currentTime = Date.now();
      const interval = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Enter key marks end of barcode scanner transmission
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minChars) {
          const barcode = bufferRef.current.trim();
          bufferRef.current = '';
          if (enableSound) {
            playBeep();
          }
          onScan(barcode);
        }
        bufferRef.current = '';
        return;
      }

      // If interval between keystrokes is too long, it was human typing -> reset buffer
      if (interval > maxIntervalMs) {
        bufferRef.current = '';
      }

      // Only buffer single printable characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, minChars, maxIntervalMs, enableSound]);

  return { playBeep };
};
