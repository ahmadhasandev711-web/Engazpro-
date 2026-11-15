import React, { useState } from 'react';
import { Key, Eye, EyeOff, Sparkles, Copy, Check, X, CheckCircle2 } from 'lucide-react';
import { User } from '@pos-mandob/shared';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui';

interface ResetPasswordModalProps {
  user: User;
  onClose: () => void;
  onReset: (payload: { userId: number; password: string }) => Promise<void>;
  isPending: boolean;
}

function generateSecurePassword(length = 12): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$!';
  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, (n) => charset[n % charset.length]).join('');
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  user,
  onClose,
  onReset,
  isPending,
}) => {
  const toast = useToast();
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(true);
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleGenerate = () => {
    setNewPassword(generateSecurePassword(12));
    setCopied(false);
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPassword.trim();
    if (trimmed.length < 8) {
      toast.error('كلمة المرور يجب ألا تقل عن 8 أحرف أو أرقام');
      return;
    }
    try {
      await onReset({ userId: user.id, password: trimmed });
      setSavedPassword(trimmed);
      setCopied(false);
    } catch {
      // Handled by mutation onError toast
    }
  };

  return (
    <div
      className="fixed inset-0 bg-canvas/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-panel rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-line space-y-5">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-soft border border-brand/20 flex items-center justify-center text-brand">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-ink">تعيين كلمة مرور جديدة</h3>
              <p className="text-xs text-muted font-medium mt-0.5">
                المتجر: <strong className="text-ink">{user.name}</strong> ({user.phone})
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="إغلاق" className="min-h-[44px] min-w-[44px]">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {savedPassword ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-ok-soft border border-ok/20 space-y-3">
              <div className="flex items-center gap-2 text-ok font-black text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>تم حفظ كلمة المرور وإبطال الجلسات القديمة</span>
              </div>
              <p className="text-xs text-muted">
                انسخ كلمة المرور التالية وأرسلها للتاجر (لن تظهر مرة أخرى بعد إغلاق النافذة):
              </p>
              <div className="flex items-center justify-between gap-2 bg-panel border border-line rounded-xl px-3.5 py-2.5">
                <code className="font-mono font-black text-sm text-ink select-all dir-ltr">
                  {savedPassword}
                </code>
                <Button
                  size="sm"
                  variant={copied ? 'primary' : 'secondary'}
                  leftIcon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  onClick={() => handleCopy(savedPassword)}
                  className="min-h-[40px]"
                >
                  {copied ? 'تم النسخ' : 'نسخ'}
                </Button>
              </div>
            </div>

            <Button className="w-full" variant="primary" onClick={onClose}>
              تم — إغلاق النافذة
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-ink">كلمة المرور الجديدة (8 خانات فأكثر)</label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleGenerate}
                  leftIcon={<Sparkles className="w-3.5 h-3.5 text-brand" />}
                  className="min-h-[36px] text-brand"
                >
                  توليد عشوائي آمن
                </Button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل 8 أحرف أو أرقام على الأقل..."
                  className="w-full min-h-[44px] bg-surface border border-line rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-ink placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand outline-none text-left pl-20"
                  required
                  minLength={8}
                />
                <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {newPassword.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopy(newPassword)}
                      className="p-2 text-muted hover:text-ink rounded-lg transition-colors"
                      title="نسخ كلمة المرور"
                    >
                      {copied ? <Check className="w-4 h-4 text-ok" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-2 text-muted hover:text-ink rounded-lg transition-colors"
                    aria-label="إظهار أو إخفاء كلمة المرور"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-muted">
                سيتم تشفير كلمة المرور فوراً وإبطال توكنات المالك السابقة لتأمين الحساب.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-line">
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                isLoading={isPending}
                disabled={newPassword.trim().length < 8}
                leftIcon={<Key className="w-4 h-4" />}
              >
                حفظ كلمة المرور
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                إلغاء
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
