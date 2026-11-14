import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { RegisterSchema, RegisterInput } from '@pos-mandob/shared';
import { ArrowLeft, Mail, Phone, Sparkles, Store, Zap } from 'lucide-react';
import { useAuthStore } from '../../data/store/useAuthStore';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordField } from '../components/auth/PasswordField';
import { Button, Input } from '../components/ui';

const REGISTER_FEATURES = [
  'فواتير مبيعات سريعة بالباركود والطباعة الحرارية',
  'رقابة كاملة على الخزن المستقلة (كاش، تحويل، بطاقة)',
  'عزل أرباح الفروع وصلاحيات دقيقة للموظفين والمدراء',
  'مزامنة فورية وتلقائية مع متجر ووكومرس الإلكتروني',
] as const;

/** Store trial registration screen built on EngazPRO AuthShell. */
export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register: registerUser, isLoading, error } = useAuthStore();

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
    <AuthShell
      badgeText="تجربة مجانية كاملة لمدة 14 يوم بكافة المميزات"
      headline="ابدأ نقلة نوعية"
      accentHeadline="في إدارة نشاطك التجاري"
      description="انضم الآن لمئات التجار وأصحاب الفروع والمناديب الذين يديرون عملياتهم اليومية بدقة وسرعة قياسية عبر إنجاز برو."
      features={REGISTER_FEATURES}
      showcaseFooter={
        <div className="p-4 rounded-2xl bg-ok-soft/70 border border-ok/30 text-xs text-ink flex items-start gap-3">
          <Zap className="w-5 h-5 text-ok shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>بدون أي التزامات:</strong> حسابك جاهز فور التسجيل خلال 30 ثانية دون الحاجة لبطاقات بنكية، مع دعم فني متكامل طوال فترة التجربة.
          </p>
        </div>
      }
      securityNote="حماية وتشفير متكامل لقواعد البيانات"
      supportHref="https://wa.me/201125030642?text=مرحباً،%20أريد%20الاستفسار%20عن%20فتح%20حساب%20جديد%20في%20إنجاز%20برو"
      supportLabel="تحدث مع المبيعات"
      formTitle="إنشاء حساب تجريبي جديد"
      formHeaderExtra={
        <div className="inline-flex items-center gap-2 p-2.5 px-3 rounded-xl bg-ok-soft border border-ok/30 text-ok text-xs font-bold">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>يشمل 14 يوم تجربة مجانية كاملة لجميع المميزات وفصل الخزن.</span>
        </div>
      }
      error={error}
      footer={
        <div className="text-center pt-3 border-t border-line space-y-1">
          <p className="text-xs text-muted">
            لديك حساب بالفعل في المنظومة؟{' '}
            <Link
              to="/login"
              className="min-h-[44px] inline-flex items-center font-bold text-brand hover:opacity-80 px-1"
            >
              تسجيل الدخول
            </Link>
          </p>
          <div>
            <Link
              to="/"
              className="min-h-[44px] inline-flex items-center justify-center px-3 text-xs font-medium text-muted hover:text-ink transition-colors rounded-xl"
            >
              العودة للصفحة الرئيسية
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('name')}
          type="text"
          label="الاسم التجاري أو اسمك"
          placeholder="مثال: مؤسسة الأمل للتجارة والتوزيع"
          leftIcon={<Store className="w-4 h-4" />}
          error={errors.name?.message}
        />

        <Input
          {...register('phone')}
          type="tel"
          label="رقم الهاتف (اسم المستخدم للدخول)"
          placeholder="01xxxxxxxxx"
          dir="ltr"
          leftIcon={<Phone className="w-4 h-4" />}
          error={errors.phone?.message}
          className="text-right"
        />

        <Input
          {...register('email')}
          type="email"
          label="البريد الإلكتروني (اختياري)"
          placeholder="name@example.com"
          dir="ltr"
          leftIcon={<Mail className="w-4 h-4" />}
          error={errors.email?.message}
          className="text-right"
        />

        <PasswordField
          {...register('password')}
          placeholder="••••••••"
          error={errors.password?.message}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          rightIcon={!isLoading ? <ArrowLeft className="w-4 h-4" /> : undefined}
          className="w-full font-black mt-2"
        >
          {isLoading ? 'جاري تجهيز حسابك...' : 'بدء التجربة المجانية الآن'}
        </Button>
      </form>
    </AuthShell>
  );
};
