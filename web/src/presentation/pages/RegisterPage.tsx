import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { RegisterSchema, RegisterInput } from '@pos-mandob/shared';
import { useAuthStore } from '../../data/store/useAuthStore';
import {
  Lock,
  Phone,
  Mail,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  Store,
  Zap,
  MessageCircle,
} from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register: registerUser, isLoading, error } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    const success = await registerUser(data);
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#EBF0F8] flex text-slate-800 relative overflow-hidden" dir="rtl">
      {/* Soft Ambient Pastel Blooms */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-20 right-10 w-[45vw] h-[40vw] max-w-[600px] max-h-[500px] bg-gradient-to-br from-emerald-200/40 via-teal-100/25 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-[40vw] h-[40vw] max-w-[550px] max-h-[500px] bg-gradient-to-tr from-sky-200/50 via-indigo-100/20 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Right Side: Celadon Soft Clay Showcase Panel (Desktop lg+) */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12 bg-white/70 backdrop-blur-xl border-l border-white shadow-[0_20px_40px_-15px_rgba(35,45,60,0.06),inset_0_1px_0_0_rgba(255,255,255,1)]">
        {/* Brand Header */}
        <Link to="/" className="inline-flex items-center gap-2 group">
          <span className="font-black text-3xl tracking-tighter text-slate-900 font-sans flex items-center">
            Engaz<span className="text-emerald-500">.</span>
            <span className="mr-1.5 text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300/80 px-2 py-0.5 rounded-lg shadow-2xs">
              PRO
            </span>
          </span>
          <span className="text-xs font-bold text-slate-400 border-r border-slate-200 pr-2 mr-1">
            إنجاز برو
          </span>
        </Link>

        {/* Central Value Pitch */}
        <div className="space-y-6 max-w-lg my-auto py-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-3.5 py-1.5 rounded-full shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>تجربة مجانية كاملة لمدة 14 يوم بكافة المميزات</span>
          </div>

          <h2 className="text-4xl font-black text-slate-900 leading-snug">
            ابدأ نقلة نوعية
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-700">
              في إدارة نشاطك التجاري
            </span>
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed">
            انضم الآن لمئات التجار وأصحاب الفروع والمناديب الذين يديرون عملياتهم اليومية بدقة وسرعة قياسية عبر إنجاز برو.
          </p>

          <div className="space-y-3 pt-2">
            {[
              'فواتير مبيعات سريعة بالباركود والطباعة الحرارية',
              'رقابة كاملة على 3 خزن مستقلة (كاش، تحويل، بطاقة)',
              'عزل أرباح الفروع وصلاحيات دقيقة للموظفين والمدراء',
              'مزامنة فورية وتلقائية مع متجر ووكومرس الإلكتروني',
              'ربط متجرك الالكتروني ووككومرس لحظيا',
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-xs font-semibold text-slate-700">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* Trial Guarantee Soft Plate */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-900 flex items-start gap-3 shadow-xs">
            <Zap className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>بدون أي التزامات:</strong> حسابك جاهز فور التسجيل خلال 30 ثانية دون الحاجة لبطاقات بنكية، مع دعم فني متكامل طوال فترة التجربة.
            </p>
          </div>
        </div>

        {/* Footer Support Notice */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-200/60">
          <span>حماية وتشفير متكامل لقواعد البيانات</span>
          <a
            href="https://wa.me/201125030642?text=مرحباً،%20أريد%20الاستفسار%20عن%20فتح%20حساب%20جديد%20في%20إنجاز%20برو"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 font-bold"
          >
            <MessageCircle className="w-4 h-4" />
            <span>تحدث مع المبيعات</span>
          </a>
        </div>
      </div>

      {/* Left Side: Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-8 sm:p-10 border border-white shadow-[0_20px_45px_-12px_rgba(35,45,60,0.08),0_4px_16px_-4px_rgba(35,45,60,0.04),inset_0_1px_0_0_rgba(255,255,255,1)] space-y-6">
          {/* Mobile Header Branding */}
          <div className="lg:hidden text-center space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 justify-center">
              <span className="font-black text-3xl tracking-tighter text-slate-900 font-sans flex items-center">
                Engaz<span className="text-emerald-500">.</span>
                <span className="mr-1.5 text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300/80 px-2 py-0.5 rounded-lg shadow-2xs">
                  PRO
                </span>
              </span>
              <span className="text-xs font-bold text-slate-400 border-r border-slate-200 pr-2 mr-1">
                إنجاز برو
              </span>
            </Link>
            <p className="text-xs text-slate-500 font-medium">منظومة إدارة المبيعات، الفروع، والمخازن</p>
          </div>

          {/* Form Title & Trial Callout */}
          <div className="space-y-2 text-center sm:text-right">
            <h2 className="text-2xl font-black text-slate-900">إنشاء حساب تجريبي جديد</h2>
            <div className="inline-flex items-center gap-2 p-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
              <span>يشمل 14 يوم تجربة مجانية كاملة لجميع المميزات وفصل الخزن.</span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الاسم التجاري أو اسمك</label>
              <div className="relative">
                <Store className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('name')}
                  type="text"
                  placeholder="مثال: مؤسسة الأمل للتجارة والتوزيع"
                  className="w-full pl-4 pr-11 py-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 shadow-[inset_0_2px_4px_rgba(35,45,60,0.03)] transition-all text-right"
                />
              </div>
              {errors.name && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم الهاتف (اسم المستخدم للدخول)</label>
              <div className="relative">
                <Phone className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('phone')}
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="w-full pl-4 pr-11 py-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 shadow-[inset_0_2px_4px_rgba(35,45,60,0.03)] transition-all text-right"
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{errors.phone.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">البريد الإلكتروني (اختياري)</label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="name@example.com"
                  dir="ltr"
                  className="w-full pl-4 pr-11 py-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 shadow-[inset_0_2px_4px_rgba(35,45,60,0.03)] transition-all text-right"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 shadow-[inset_0_2px_4px_rgba(35,45,60,0.03)] transition-all text-right"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-b from-emerald-500 via-emerald-600 to-teal-700 hover:from-emerald-400 hover:to-teal-600 disabled:opacity-50 text-white font-black rounded-2xl shadow-[0_10px_22px_-5px_rgba(16,185,129,0.45),inset_0_1px_0_0_rgba(255,255,255,0.35)] transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {isLoading ? 'جاري تجهيز حسابك...' : 'بدء التجربة المجانية الآن 🚀'}
              {!isLoading && <ArrowLeft className="w-4 h-4" />}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="text-center pt-2 border-t border-slate-100 space-y-2">
            <p className="text-xs text-slate-600">
              لديك حساب بالفعل في المنظومة؟{' '}
              <Link to="/login" className="font-bold text-emerald-700 hover:text-emerald-800">
                تسجيل الدخول
              </Link>
            </p>
            <div>
              <Link to="/" className="text-xs text-slate-500 hover:text-slate-700">
                العودة للصفحة الرئيسية
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
