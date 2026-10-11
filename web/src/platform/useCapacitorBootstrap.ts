import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { nativeBackButton } from './nativeBackButton';

/**
 * Platform Layer - Capacitor Bootstrap Hook
 * Conforms to GR-3 (SoC) & GR-7 (DIP)
 * Initializes native Android/iOS lifecycle, status bar, splash screen, and hardware back button.
 */
export const useCapacitorBootstrap = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // 1. Initialize Status Bar
    const initStatusBar = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setBackgroundColor({ color: '#0f172a' });
        }
      } catch (err) {
        // Silently catch if status bar is not supported on device
      }
    };

    // 2. Hide Splash Screen after React DOM is mounted
    const hideSplash = async () => {
      try {
        await SplashScreen.hide();
      } catch (err) {}
    };

    initStatusBar();
    hideSplash();

    // 3. Handle Android Hardware Back Button
    const backButtonHandler = CapApp.addListener('backButton', ({ canGoBack }) => {
      // Prioritize active modals and bottom sheets
      if (nativeBackButton.handleBack()) {
        return;
      }

      const pathname = location.pathname;

      // Top-level root paths where back button exits or minimizes the app
      if (pathname === '/' || pathname === '/dashboard' || pathname === '/login') {
        CapApp.exitApp();
        return;
      }

      // If user is in a sub-page, navigate back
      if (canGoBack || window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/dashboard', { replace: true });
      }
    });

    return () => {
      backButtonHandler.then((handle) => handle.remove()).catch(() => {});
    };
  }, [navigate, location]);
};
