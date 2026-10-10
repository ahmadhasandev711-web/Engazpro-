/**
 * Infrastructure Layer - Haptic Service
 * Conforms to DIP (GR-7) & SoC (GR-3)
 * Provides safe tactile feedback on supported mobile devices with graceful fallback.
 */

export interface IHapticService {
  isSupported(): boolean;
  selection(): void;
  success(): void;
  warning(): void;
  error(): void;
}

class WebHapticService implements IHapticService {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator;
  }

  selection(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate(10);
      } catch {
        // Silently catch browser security or focus restrictions
      }
    }
  }

  success(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([15, 40, 20]);
      } catch {
        // Silently catch
      }
    }
  }

  warning(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([30, 50, 30]);
      } catch {
        // Silently catch
      }
    }
  }

  error(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([50, 100, 50]);
      } catch {
        // Silently catch
      }
    }
  }
}

export const hapticService: IHapticService = new WebHapticService();
