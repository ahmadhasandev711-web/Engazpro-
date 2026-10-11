import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * Infrastructure Layer - Haptic Service
 * Conforms to DIP (GR-7) & SoC (GR-3)
 * Provides safe tactile feedback with Capacitor Native Haptics and web fallback.
 */

export interface IHapticService {
  isSupported(): boolean;
  selection(): void;
  success(): void;
  warning(): void;
  error(): void;
}

class HybridHapticService implements IHapticService {
  isSupported(): boolean {
    if (Capacitor.isNativePlatform()) return true;
    return typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator;
  }

  selection(): void {
    if (Capacitor.isNativePlatform()) {
      Haptics.selectionChanged().catch(() => {});
      return;
    }
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  }

  success(): void {
    if (Capacitor.isNativePlatform()) {
      Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      return;
    }
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate([15, 40, 20]);
      } catch {}
    }
  }

  warning(): void {
    if (Capacitor.isNativePlatform()) {
      Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
      return;
    }
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate([30, 50, 30]);
      } catch {}
    }
  }

  error(): void {
    if (Capacitor.isNativePlatform()) {
      Haptics.notification({ type: NotificationType.Error }).catch(() => {});
      return;
    }
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate([50, 100, 50]);
      } catch {}
    }
  }
}

export const hapticService: IHapticService = new HybridHapticService();
