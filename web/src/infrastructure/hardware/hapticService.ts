/**
 * Browser vibration feedback. Native haptics left with the Capacitor app.
 */

export interface IHapticService {
  isSupported(): boolean;
  selection(): void;
  success(): void;
  warning(): void;
  error(): void;
}

const vibrate = (pattern: number | number[]): void => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* browsers may reject vibration without a user gesture */
  }
};

class BrowserHapticService implements IHapticService {
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  selection(): void {
    vibrate(10);
  }

  success(): void {
    vibrate([15, 40, 20]);
  }

  warning(): void {
    vibrate([30, 50, 30]);
  }

  error(): void {
    vibrate([50, 100, 50]);
  }
}

export const hapticService: IHapticService = new BrowserHapticService();
