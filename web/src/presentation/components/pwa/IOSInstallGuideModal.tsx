import React from 'react';
import { Smartphone, X, Share, PlusSquare, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui';

interface IOSInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Pure presentational guide modal explaining how to install EngazPRO on iOS Safari.
 */
export const IOSInstallGuideModal: React.FC<IOSInstallGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-panel text-ink rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-line animate-in zoom-in-95 duration-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-ok text-on-brand flex items-center justify-center shadow-sm">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-ink">تثبيت إنجاز برو على iPhone / iPad</h4>
              <p className="text-2xs text-muted">إضافة التطبيق للشاشة الرئيسية</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            aria-label="إغلاق"
            className="px-2 text-muted hover:text-ink"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3 p-3 bg-surface-2 rounded-2xl border border-line">
            <div className="p-2 bg-brand-soft text-brand rounded-xl shrink-0">
              <Share className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-ink block">1. اضغط على زر المشاركة:</span>
              <span className="text-muted text-2xs">
                ستجده في أسفل شاشة متصفح Safari على الآيفون (أو أعلى الشاشة في الآيباد).
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-surface-2 rounded-2xl border border-line">
            <div className="p-2 bg-ok-soft text-ok rounded-xl shrink-0">
              <PlusSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-ink block">2. اختر &quot;إضافة إلى الصفحة الرئيسية&quot;:</span>
              <span className="text-muted text-2xs">
                مرر القائمة لأسفل ثم انقر على &quot;Add to Home Screen&quot;.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-2xs text-ok bg-ok-soft p-2.5 rounded-xl font-bold border border-ok/20">
            <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
            <span>سيظهر التطبيق كأيقونة مستقلة تعمل بكامل الشاشة فوراً!</span>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onClose}
          className="w-full text-xs font-bold"
        >
          فهمت، حسناً
        </Button>
      </div>
    </div>
  );
};
