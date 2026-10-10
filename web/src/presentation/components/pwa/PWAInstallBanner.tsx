import React, { useState } from 'react';
import { Download, Smartphone, Monitor, X, Share, PlusSquare, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../../hooks/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
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
      alert('لتثبيت التطبيق على جهازك: اضغط على أيقونة التثبيت ⊕ في شريط عنوان المتصفح أو اختر "تثبيت تطبيق إنجاز برو" من خيارات المتصفح.');
    }
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-lg border border-emerald-900/40 mb-6">
        {/* Glow effect background */}
        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
        <div className="absolute right-1/4 -bottom-10 h-32 w-32 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Content & Icon */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md border border-white/20">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-slate-900 rounded-full border border-slate-800 text-amber-400">
                <Download className="w-3 h-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white">
                  حمّل تطبيق إنجاز برو على جهازك (موبايل أو كمبيوتر)
                </h3>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Monitor className="w-3 h-3 hidden sm:inline" />
                  <Smartphone className="w-3 h-3" />
                  <span>تطبيق سريع وخفيف</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                وصول فوري بزر واحد من الشاشة الرئيسية بدون متصفح، تجربة شاشة كاملة، وسرعة فائقة في تحرير الفواتير وتسليم الورديات.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-5 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md shadow-emerald-900/40"
            >
              <Download className="w-4 h-4" />
              <span>{isInstalling ? 'جاري التثبيت...' : 'تثبيت التطبيق الآن'}</span>
            </button>

            <button
              onClick={handleDismiss}
              title="إغلاق التنبيه"
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-slate-900 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black">تثبيت إنجاز برو على iPhone / iPad</h4>
                  <p className="text-[11px] text-slate-400">إضافة التطبيق للشاشة الرئيسية</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-4 text-xs">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl flex-shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">1. اضغط على زر المشاركة:</span>
                  <span className="text-slate-500 text-[11px]">
                    ستجده في أسفل شاشة متصفح Safari على الآيفون (أو أعلى الشاشة في الآيباد).
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl flex-shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">2. اختر "إضافة إلى الصفحة الرئيسية":</span>
                  <span className="text-slate-500 text-[11px]">
                    مرر القائمة لأسفل ثم انقر على "Add to Home Screen".
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 p-2.5 rounded-xl font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>سيظهر التطبيق كأيقونة مستقلة تعمل بكامل الشاشة فوراً!</span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-2xl text-xs font-bold transition-colors"
            >
              فهمت، حسناً
            </button>
          </div>
        </div>
      )}
    </>
  );
};
