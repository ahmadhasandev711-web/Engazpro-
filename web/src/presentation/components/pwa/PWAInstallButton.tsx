import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { useToast } from '../../context/ToastContext';
import { IOSInstallGuideModal } from './IOSInstallGuideModal';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const toast = useToast();
  const { canInstall, isInstalled, isIOS, installApp } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (canInstall) {
      setLoading(true);
      await installApp();
      setLoading(false);
    } else {
      toast.info('لتثبيت التطبيق على جهازك: اضغط على أيقونة التثبيت ⊕ في شريط عنوان المتصفح.');
    }
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          title="تثبيت تطبيق إنجاز برو على جهازك"
          className={`inline-flex items-center gap-1.5 min-h-[44px] bg-ok-soft hover:bg-ok/20 text-ok border border-ok/30 px-3 py-2 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 bg-ok-soft hover:bg-ok/20 border border-ok/30 rounded-xl text-ok text-xs font-bold transition-all cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-ok" />
            <span>تثبيت إنجاز برو على جهازك</span>
          </div>
          <Download className="w-4 h-4 text-ok" />
        </button>
      )}

      <IOSInstallGuideModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
    </>
  );
};
