import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { LoginSchema, LoginInput } from '@pos-mandob/shared';
import { ArrowLeft, AtSign, KeyRound, Mail, Phone, X, Zap } from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { useAuthStore } from '../../data/store/useAuthStore';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getSavedStoreCode, normalizeStoreCodeInput, saveStoreCode } from '../../platform/storeCodeStorage';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordField } from '../components/auth/PasswordField';
import { Button, Input } from '../components/ui';

const LOGIN_FEATURES = [
  'نقطة بيع سريعة مع دعم الباركود وطباعة الفواتير الحرارية',
  'خزن مستقلة (كاش، إنستاباي، فودافون كاش) لمنع أي عجز',
  'عزل بيانات وصلاحيات الفروع لحماية أرباحك الصافية',
  'يعمل كتطبيق PWA خفيف وسريع على أي كمبيوتر أو موبايل',
] as const;

/** Store owner / staff login screen built on EBMS AuthShell. */
export const LoginPage: React.FC = () => {
  usePageMeta({
    title: 'تسجيل الدخول — EBMS | Easy Work',
    description: 'سجّل الدخول إلى نظام EBMS (Easy Business Management System) لإدارة نقاط البيع والمخازن والخزائن وعهد المناديب.',
  });
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();

  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recStep, setRecStep] = useState<'phone' | 'otp' | 'done'>('phone');
  const [recStoreCode, setRecStoreCode] = useState(() => getSavedStoreCode());
  const [recPhone, setRecPhone] = useState('');
  const [recOtp, setRecOtp] = useState('');
  const [recNewPassword, setRecNewPassword] = useState('');
  const [recMessage, setRecMessage] = useState<string | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      store_code: getSavedStoreCode(),
    },
  });

  const openRecovery = () => {
    setRecoveryOpen(true);
    setRecStep('phone');
    setRecStoreCode(getValues('store_code') || getSavedStoreCode());
    setRecOtp('');
    setRecNewPassword('');
    setRecMessage(null);
    setRecError(null);
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError(null);
    setRecMessage(null);
    setRecLoading(true);
    try {
      const cleanStoreCode = normalizeStoreCodeInput(recStoreCode);
      saveStoreCode(cleanStoreCode);
      const res = await apiClient.post('/auth/forgot-password', { store_code: cleanStoreCode, phone: recPhone });
      const data = res.data?.data;
      setRecMessage(res.data?.message || 'تم إرسال الطلب بنجاح.');
      if (data?.mode === 'OTP_EMAIL') {
        setRecStep('otp');
      } else {
        setRecStep('done');
      }
    } catch (err: any) {
      setRecError(err.response?.data?.message || 'تعذر تنفيذ طلب الاستعادة، تأكد من معرّف المتجر ورقم الهاتف.');
    } finally {
      setRecLoading(false);
    }
  };

  const handleSubmitOtpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError(null);
    setRecLoading(true);
    try {
      const cleanStoreCode = normalizeStoreCodeInput(recStoreCode);
      const res = await apiClient.post('/auth/reset-password-otp', {
        store_code: cleanStoreCode,
        phone: recPhone,
        otp: recOtp,
        password: recNewPassword,
      });
      setRecMessage(res.data?.message || 'تم تعيين كلمة المرور الجديدة بنجاح.');
      setRecStep('done');
    } catch (err: any) {
      setRecError(err.response?.data?.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية.');
    } finally {
      setRecLoading(false);
    }
  };

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
            «EBMS حل مشكلة تداخل تحويلات إنستاباي مع فلوس الدرج. دلوقتي تقفيل الوردية اليومية بياخد دقيقة واحدة بدون أي لخبطة.»
          </p>
          <div className="flex items-center justify-between text-xs text-muted font-bold pt-2 border-t border-line">
            <span>أحمد فؤاد — مالك مجموعة محلات تجزئة</span>
            <span className="text-warn">★★★★★</span>
          </div>
        </div>
      }
      securityNote="سيرفرات سحابية آمنة ومشفرة 100%"
      supportHref="https://wa.me/201125030642?text=مرحباً،%20أحتاج%20مساعدة%20في%20تسجيل%20الدخول%20لنظام%20EBMS"
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
            <a
              href="https://ebms.online/"
              className="min-h-[44px] inline-flex items-center justify-center px-3 text-xs font-medium text-muted hover:text-ink transition-colors rounded-xl"
            >
              العودة إلى الموقع الرئيسي (ebms.online)
            </a>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('store_code')}
          type="text"
          autoComplete="off"
          label="معرّف المتجر"
          placeholder="ebms"
          dir="ltr"
          leftIcon={<AtSign className="w-4 h-4" />}
          helperText="يُحفظ تلقائياً على هذا الجهاز بعد أول دخول (مثل: ebms-shop)"
          error={errors.store_code?.message}
          onInput={(e) => {
            e.currentTarget.value = normalizeStoreCodeInput(e.currentTarget.value);
          }}
          className="text-right font-mono"
        />

        <Input
          {...register('phone')}
          type="tel"
          autoComplete="username"
          label="رقم الهاتف"
          placeholder="01xxxxxxxxx"
          dir="ltr"
          leftIcon={<Phone className="w-4 h-4" />}
          error={errors.phone?.message}
          className="text-right"
        />

        <PasswordField
          {...register('password')}
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          labelAction={
            <button
              type="button"
              onClick={openRecovery}
              className="text-xs text-brand hover:opacity-80 font-bold py-1 cursor-pointer"
            >
              نسيت كلمة المرور؟
            </button>
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

      {recoveryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-panel border border-line rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-brand" />
                <h3 className="font-black text-base text-ink">استعادة كلمة المرور</h3>
              </div>
              <button type="button" onClick={() => setRecoveryOpen(false)} aria-label="إغلاق" className="p-2 rounded-lg text-muted hover:bg-surface-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            {recError && <div className="p-3 rounded-xl bg-bad-soft border border-bad/30 text-bad text-xs font-bold">{recError}</div>}
            {recMessage && <div className="p-3 rounded-xl bg-ok-soft border border-ok/30 text-ok text-xs font-bold leading-relaxed">{recMessage}</div>}

            {recStep === 'phone' && (
              <form onSubmit={handleRequestRecovery} className="space-y-3">
                <p className="text-xs text-muted leading-relaxed">
                  أدخل معرّف متجرك ورقم هاتفك المسجل: إن كنت صاحب متجر سيصلك رمز تحقق عبر بريدك، وإن كنت موظفاً سيصل طلبك لمدير متجرك فوراً.
                </p>
                <Input
                  name="recovery_store_code"
                  type="text"
                  autoComplete="off"
                  label="معرّف المتجر"
                  dir="ltr"
                  placeholder="ebms"
                  value={recStoreCode}
                  onChange={(e) => setRecStoreCode(normalizeStoreCodeInput(e.target.value))}
                  className="text-right font-mono"
                  required
                />
                <Input
                  name="recovery_phone"
                  type="tel"
                  autoComplete="tel"
                  label="رقم الهاتف"
                  dir="ltr"
                  placeholder="01xxxxxxxxx"
                  value={recPhone}
                  onChange={(e) => setRecPhone(e.target.value)}
                  required
                />
                <Button type="submit" variant="primary" isLoading={recLoading} className="w-full">
                  إرسال رمز التحقق / طلب الاستعادة
                </Button>
              </form>
            )}

            {recStep === 'otp' && (
              <form onSubmit={handleSubmitOtpReset} autoComplete="off" className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted bg-surface-2 p-2.5 rounded-xl border border-line">
                  <Mail className="w-4 h-4 text-brand shrink-0" />
                  <span>أدخل الرمز المرسل لبريدك وكلمة المرور الجديدة.</span>
                </div>
                <Input
                  name="recovery_otp"
                  type="text"
                  autoComplete="one-time-code"
                  label="رمز التحقق (6 أرقام)"
                  dir="ltr"
                  placeholder="123456"
                  maxLength={6}
                  value={recOtp}
                  onChange={(e) => setRecOtp(e.target.value)}
                  required
                />
                <PasswordField
                  name="recovery_new_password"
                  autoComplete="new-password"
                  label="كلمة المرور الجديدة"
                  placeholder="••••••••"
                  value={recNewPassword}
                  onChange={(e) => setRecNewPassword(e.target.value)}
                  required
                />
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setRecStep('phone')} className="flex-1">رجوع</Button>
                  <Button type="submit" variant="primary" isLoading={recLoading} className="flex-1">تأكيد وتغيير</Button>
                </div>
              </form>
            )}

            {recStep === 'done' && (
              <div className="space-y-3">
                <Button type="button" variant="primary" className="w-full" onClick={() => setRecoveryOpen(false)}>
                  العودة لتسجيل الدخول
                </Button>
              </div>
            )}

            <div className="pt-2 border-t border-line text-center">
              <a
                href="https://wa.me/201125030642?text=مرحباً،%20نسيت%20كلمة%20المرور%20لحسابي%20في%20نظام%20EBMS"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted hover:text-brand font-bold"
              >
                أو تواصل مع الدعم الفني عبر واتساب (01125030642)
              </a>
            </div>
          </div>
        </div>
      )}
    </AuthShell>
  );
};
