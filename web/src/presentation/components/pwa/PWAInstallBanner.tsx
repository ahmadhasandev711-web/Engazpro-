import React, { useState } from 'react';
import { Download, Smartphone, Monitor, X } from 'lucide-react';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Card } from '../ui';
import { IOSInstallGuideModal } from './IOSInstallGuideModal';

export const PWAInstallBanner: React.FC = () => {
  const toast = useToast();
  const { canInstall, isInstalled, isIOS, installApp } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return sessionStorage.getItem('cashat_pwa_dismissed') === 'true';
  });
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  // If already installed or dismissed this session, don't show
  if (isInstalled || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('cashat_pwa_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (canInstall) {
      setIsInstalling(true);
      await installApp();
      setIsInstalling(false);
    } else {
      // For browsers that haven't triggered prompt yet, inform them
      toast.info('لتثبيت التطبيق على جهازك: اضغط على أيقونة التثبيت ⊕ في شريط عنوان المتصفح أو اختر "تثبيت تطبيق إنجاز برو" من خيارات المتصفح.');
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden rounded-3xl border-ok/30 bg-panel p-5 shadow-sm mb-6">
        {/* Soft accent highlight */}
        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-ok-soft blur-2xl pointer-events-none opacity-80" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Content & Icon */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-ok-soft border border-ok/30 flex items-center justify-center text-ok shadow-xs">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-panel rounded-full border border-line text-warn">
                <Download className="w-3 h-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-ink">
                  حمّل تطبيق إنجاز برو على جهازك (موبايل أو كمبيوتر)
                </h3>
                <Badge tone="ok" className="gap-1 text-2xs font-bold">
                  <Monitor className="w-3 h-3 hidden sm:inline" />
                  <Smartphone className="w-3 h-3" />
                  <span>تطبيق سريع وخفيف</span>
                </Badge>
              </div>
              <p className="text-xs text-muted mt-1 max-w-xl leading-relaxed">
                وصول فوري بزر واحد من الشاشة الرئيسية بدون متصفح، تجربة شاشة كاملة، وسرعة فائقة في تحرير الفواتير وتسليم الورديات.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end md:self-center">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleInstallClick}
              disabled={isInstalling}
              isLoading={isInstalling}
              leftIcon={<Download className="w-4 h-4" />}
              className="text-xs font-black rounded-2xl bg-ok hover:bg-ok/90"
            >
              {isInstalling ? 'جاري التثبيت...' : 'تثبيت التطبيق الآن'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={handleDismiss}
              title="إغلاق التنبيه"
              aria-label="إغلاق التنبيه"
              className="px-2.5 text-muted hover:text-ink"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      <IOSInstallGuideModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
    </>
  );
};
