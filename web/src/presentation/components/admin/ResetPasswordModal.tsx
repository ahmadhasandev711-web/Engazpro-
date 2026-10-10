import React, { useState } from 'react';
import { Key, Eye, EyeOff, Sparkles, Copy, Check } from 'lucide-react';
import { User } from '@pos-mandob/shared';

interface ResetPasswordModalProps {
  user: User;
  onClose: () => void;
  onReset: (payload: { userId: number; password: string }) => void;
  isPending: boolean;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  user,
  onClose,
  onReset,
  isPending,
}) => {
  const [newPassword, setNewPassword] = useState<string>('123456');
  const [showPassword, setShowPassword] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const generateRandomPassword = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setNewPassword(`Engaz@${randomNum}`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.trim().length < 6) {
      alert('كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام');
      return;
    }
    onReset({ userId: user.id, password: newPassword.trim() });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">تعيين كلمة مرور جديدة</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                المتجر / التاجر: <strong className="text-slate-800">{user.name}</strong> ({user.phone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700">كلمة المرور الجديدة</label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>توليد كلمة سر عشوائية</span>
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل 6 خانات على الأقل..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-left pl-20"
                required
                minLength={6}
              />
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                  title="نسخ كلمة المرور"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              سيتم تشفير كلمة المرور وتعيينها فورياً لهذا الحساب لتزويد العميل بها عبر الواتساب.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isPending || newPassword.length < 6}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isPending ? 'جاري الحفظ...' : 'حفظ كلمة المرور 🔑'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
