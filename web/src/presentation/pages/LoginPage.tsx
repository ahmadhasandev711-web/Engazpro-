import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { LoginSchema, LoginInput } from '@pos-mandob/shared';
import { ArrowLeft, Phone, Zap } from 'lucide-react';
import { useAuthStore } from '../../data/store/useAuthStore';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordField } from '../components/auth/PasswordField';
import { Button, Input } from '../components/ui';

const LOGIN_FEATURES = [
  'نقطة بيع سريعة مع دعم الباركود وطباعة الفواتير الحرارية',
  'خزن مستقلة (كاش، إنستاباي، فودافون كاش) لمنع أي عجز',
  'عزل بيانات وصلاحيات الفروع لحماية أرباحك الصافية',
  'يعمل كتطبيق PWA خفيف وسريع على أي كمبيوتر أو موبايل',
] as const;

/** Store owner / staff login screen built on EngazPRO AuthShell. */
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    const success = await login(data);
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <AuthShell
      badgeText="منصة الأعمال الأذكى لإدارة مبيعاتك ووردياتك"
      headline="تحكم كامل في فروعك،"
      accentHeadline="وحسابات دقيقة بالقرش"
      description="سجّل دخولك لمتابعة مبيعات اليوم الحية، جرد الخزائن ومحاضر تسوية الورديات، والتزامن مع متجرك الإلكتروني بكل سهولة."
      features={LOGIN_FEATURES}
      showcaseFooter={
        <div className="p-4 rounded-2xl bg-surface-2/70 border border-line text-xs space-y-2">
          <p className="italic text-ink leading-relaxed">
            «إنجاز برو حل مشكلة تداخل تحويلات إنستاباي مع فلوس الدرج. دلوقتي تقفيل الوردية اليومية بياخد دقيقة واحدة بدون أي لخبطة.»
          </p>
          <div className="flex items-center justify-between text-xs text-muted font-bold pt-2 border-t border-line">
            <span>أحمد فؤاد — مالك مجموعة محلات تجزئة</span>
            <span className="text-warn">★★★★★</span>
          </div>
        </div>
      }
      securityNote="سيرفرات سحابية آمنة ومشفرة 100%"
      supportHref="https://wa.me/201125030642?text=مرحباً،%20أحتاج%20مساعدة%20في%20تسجيل%20الدخول%20لنظام%20إنجاز%20برو"
      supportLabel="الدعم الفني المباشر"
      formTitle="تسجيل الدخول للنظام"
      formSubtitle="أدخل رقم الهاتف المسجل وكلمة المرور للوصول إلى لوحة التحكم."
      error={error}
      footer={
        <div className="space-y-3 pt-1">
          <div className="p-4 rounded-2xl bg-brand-soft/50 border border-brand/25 text-center space-y-1">
            <p className="text-xs text-muted font-medium">
              ليس لديك حساب في المنظومة بعد؟
            </p>
            <Link
              to="/register"
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-black text-brand hover:opacity-80 px-2 rounded-xl transition-opacity"
            >
              <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>إنشاء حساب تجريبي مجاناً (14 يوم بكامل الصلاحيات)</span>
            </Link>
          </div>

          <div className="text-center">
            <Link
              to="/"
              className="min-h-[44px] inline-flex items-center justify-center px-3 text-xs font-medium text-muted hover:text-ink transition-colors rounded-xl"
            >
              العودة إلى الصفحة الرئيسية
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('phone')}
          type="tel"
          label="رقم الهاتف"
          placeholder="01xxxxxxxxx"
          dir="ltr"
          leftIcon={<Phone className="w-4 h-4" />}
          error={errors.phone?.message}
          className="text-right"
        />

        <PasswordField
          {...register('password')}
          placeholder="••••••••"
          error={errors.password?.message}
          labelAction={
            <a
              href="https://wa.me/201125030642?text=مرحباً،%20نسيت%20كلمة%20المرور%20لحسابي%20في%20إنجاز%20برو"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand hover:opacity-80 font-bold py-1"
            >
              نسيت كلمة المرور؟
            </a>
          }
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          rightIcon={!isLoading ? <ArrowLeft className="w-4 h-4" /> : undefined}
          className="w-full font-black mt-2"
        >
          {isLoading ? 'جاري تسجيل الدخول...' : 'دخول للنظام'}
        </Button>
      </form>
    </AuthShell>
  );
};
