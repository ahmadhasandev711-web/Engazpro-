import { useState, useEffect } from 'react';

// Module-level variable to preserve prompt across component re-renders/page changes
let globalDeferredPrompt: any = null;

export const usePWAInstall = () => {
  const [canInstall, setCanInstall] = useState<boolean>(!!globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  // Check if device is iOS / iPadOS
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  useEffect(() => {
    // 1. Detect if running in standalone mode (already installed)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsInstalled(isStandaloneMode);
      if (isStandaloneMode) {
        setCanInstall(false);
      }
    };

    checkStandalone();

    // 2. Capture beforeinstallprompt event (Desktop Chrome/Edge & Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setCanInstall(true);
    };

    // 3. Capture appinstalled event
    const handleAppInstalled = () => {
      globalDeferredPrompt = null;
      setCanInstall(false);
      setIsInstalled(true);
      console.log('[PWA] Application successfully installed.');
    };

    // 4. Offline & Online detection
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const installApp = async (): Promise<boolean> => {
    if (!globalDeferredPrompt) {
      return false;
    }

    try {
      globalDeferredPrompt.prompt();
      const choiceResult = await globalDeferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        globalDeferredPrompt = null;
        setCanInstall(false);
        setIsInstalled(true);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PWA] Install prompt failed:', err);
      return false;
    }
  };

  return {
    canInstall,
    isInstalled,
    isOffline,
    isIOS,
    installApp,
  };
};
