import React from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';
import { usePWAInstall } from '../../../hooks/usePWAInstall';

export const OfflineBanner: React.FC = () => {
  const { isOffline } = usePWAInstall();

  if (!isOffline) return null;

  return (
    <div className="bg-warn text-on-brand px-4 py-2.5 flex items-center justify-between text-xs font-bold shadow-md animate-in slide-in-from-top-2 duration-200 z-50">
      <div className="flex items-center gap-2.5">
        <div className="p-1 bg-on-brand/20 rounded-lg">
          <WifiOff className="w-4 h-4 animate-pulse" />
        </div>
        <span>
          أنت الآن في وضع عدم الاتصال (Offline) — يمكنك متابعة العمل، وسيتم استئناف الاتصال تلقائياً فور عودة الشبكة.
        </span>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 text-2xs bg-on-brand/15 px-2.5 py-1 rounded-full border border-on-brand/30">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>تجنب تحديث الصفحة</span>
      </div>
    </div>
  );
};
