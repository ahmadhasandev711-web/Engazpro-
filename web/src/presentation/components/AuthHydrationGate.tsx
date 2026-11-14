import React from 'react';
import { useAuthStore } from '../../data/store/useAuthStore';
import { LoadingSpinnerView } from './common/LoadingSpinnerView';

/**
 * Blocks routed UI until secure session storage has finished hydrating (native cold start).
 */
export const AuthHydrationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authHydrated = useAuthStore((s) => s.authHydrated);

  if (!authHydrated) {
    return <LoadingSpinnerView message="جاري تجهيز الجلسة..." fullScreen />;
  }

  return <>{children}</>;
};
