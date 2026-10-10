import React, { useState } from 'react';
import { Download, Smartphone, X, Share, PlusSquare, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
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
      alert('لتثبيت التطبيق على جهازك: اضغط على أيقونة التثبيت ⊕ في شريط عنوان المتصفح.');
    }
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          onClick={handleClick}
          disabled={loading}
          title="تثبيت تطبيق إنجاز برو على جهازك"
          className={`inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300/80 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
        </button>
      ) : (
        <button
          onClick={handleClick}
          disabled={loading}
          className={`w-full flex items-center justify-between p-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold transition-all ${className}`}
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>تثبيت إنجاز برو على جهازك</span>
          </div>
          <Download className="w-4 h-4 text-emerald-600" />
        </button>
      )}

      {/* iOS Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-slate-900 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h4 className="text-sm font-black">تثبيت إنجاز برو على iPhone / iPad</h4>
              <button onClick={() => setShowIOSModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4 space-y-3 text-xs">
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl">
                <Share className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <span>1. اضغط على زر المشاركة أسفل متصفح Safari.</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl">
                <PlusSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>2. اختر "إضافة إلى الصفحة الرئيسية" (Add to Home Screen).</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-xl font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>سيفتح كبرنامج شاشة كاملة بدون متصفح.</span>
              </div>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
};
