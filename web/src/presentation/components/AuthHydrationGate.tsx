import React from 'react';
import { useAuthStore } from '../../data/store/useAuthStore';

/**
 * Blocks routed UI until secure session storage has finished hydrating (native cold start).
 */
export const AuthHydrationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authHydrated = useAuthStore((s) => s.authHydrated);

  if (!authHydrated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-slate-50" dir="rtl">
        <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
        <span className="mt-3 text-xs font-bold text-slate-500 font-sans">جاري تجهيز الجلسة...</span>
      </div>
    );
  }

  return <>{children}</>;
};
