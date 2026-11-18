import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import type { PublicPricingData, TierPricingData } from '../../../hooks/usePublicPricing';
import { BrandLogo } from '../common/BrandLogo';
import { Badge, Button, Card } from '../ui';
import {
  BASIC_PLAN_FEATURES,
  BRAND_IDENTITY,
  FAQ_ITEMS,
  ONBOARDING_STEPS,
  PRO_PLAN_FEATURES,
} from './landingContent';

interface LandingPricingAndFaqProps {
  pricing: PublicPricingData;
  onWhatsApp: (text: string) => void;
}

interface PricingTierCardProps {
  badge: string;
  badgeTone: 'neutral' | 'brand';
  title: string;
  subtitle: string;
  tier: TierPricingData;
  billingCycle: 'monthly' | 'yearly';
  trialDays: number;
  features: readonly string[];
  featured?: boolean;
  whatsAppText: string;
  onWhatsApp: (text: string) => void;
}

const PricingTierCard: React.FC<PricingTierCardProps> = ({
  badge,
  badgeTone,
  title,
  subtitle,
  tier,
  billingCycle,
  trialDays,
  features,
  featured = false,
  whatsAppText,
  onWhatsApp,
}) => {
  const isYearly = billingCycle === 'yearly';
  const mainPrice = isYearly
    ? Math.round(tier.yearly_monthly_equivalent)
    : tier.monthly_price;

  return (
    <Card
      className={`text-right p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-panel ${
        featured ? 'border-brand ring-2 ring-brand/15 shadow-xl' : 'border-line shadow-md'
      }`}
    >
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-line pb-5">
          <div className="space-y-1.5">
            <Badge tone={badgeTone}>{badge}</Badge>
            <h3 className="text-xl font-black text-ink pt-1">{title}</h3>
            <p className="text-xs text-muted leading-relaxed">{subtitle}</p>
          </div>

          <div className="sm:text-left shrink-0">
            <div className="flex items-baseline gap-1.5 sm:justify-end">
              <span className="text-3xl sm:text-4xl font-black text-brand tabular-nums">
                {mainPrice.toLocaleString('en-US')}
              </span>
              <span className="text-xs font-bold text-muted">ج.م / شهرياً</span>
            </div>
            <p className="text-2xs font-bold text-muted mt-1">
              {isYearly
                ? `يُدفع ${tier.annual_price.toLocaleString('en-US')} ج.م سنوياً (توفير ${tier.annual_savings.toLocaleString('en-US')} ج)`
                : `أو ${tier.annual_price.toLocaleString('en-US')} ج.م سنوياً`}
            </p>
          </div>
        </div>

        <ul className="space-y-2.5 text-xs sm:text-sm font-semibold text-ink">
          {features.map((feat) => (
            <li key={feat} className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 pt-2">
        <div className="p-3 rounded-2xl bg-brand-soft border border-brand/20 text-xs text-brand-ink font-bold text-center">
          تبدأ بتجربة {trialDays} يوم مجاناً بدون بطاقة بنكية
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <Link to="/register" className="flex-1">
            <Button
              variant={featured ? 'primary' : 'secondary'}
              size="lg"
              className="w-full"
              rightIcon={<ArrowLeft className="w-4 h-4 shrink-0" />}
            >
              ابدأ التجربة المجانية
            </Button>
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => onWhatsApp(whatsAppText)}
            leftIcon={<MessageCircle className="w-4 h-4 text-ok shrink-0" />}
          >
            استفسر واتساب
          </Button>
        </div>
      </div>
    </Card>
  );
};

/**
 * Renders onboarding steps, two-tier API-driven pricing (Monthly default + Annual switch), FAQ accordion, light CTA, and footer.
 */
export const LandingPricingAndFaq: React.FC<LandingPricingAndFaqProps> = ({
  pricing,
  onWhatsApp,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeLegalModal, setActiveLegalModal] = useState<'privacy' | 'terms' | null>(null);

  return (
    <>
      <section className="relative z-10 py-14 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-10">
          <div className="space-y-2">
            <Badge tone="brand">انطلاق سريع بدون تعقيد</Badge>
            <h2 className="text-2xl sm:text-3xl font-black text-ink">
              ثلاث خطوات فقط، ثم يعمل محلك بالنظام التلقائي
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
            {ONBOARDING_STEPS.map((item) => (
              <Card key={item.step} className="space-y-3 bg-panel">
                <div className="w-11 h-11 rounded-2xl bg-brand text-on-brand font-black text-lg flex items-center justify-center tabular-nums">
                  {item.step}
                </div>
                <h3 className="text-base sm:text-lg font-black text-ink">{item.title}</h3>
                <p className="text-xs sm:text-sm text-muted leading-relaxed">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 relative z-10 py-16 sm:py-20 bg-panel border-y border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-9">
          <div className="space-y-3 max-w-2xl mx-auto">
            <Badge tone="ok">أسعار واضحة وعادلة بالنظام الشهري أو السنوي</Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-ink">
              اختر الباقة المناسبة لنشاطك وابدأ مجاناً
            </h2>
            <p className="text-sm text-muted">
              جميع الوحدات والتقارير الأساسية متاحة من اليوم الأول، مع خصم شهرين مجاناً عند الاشتراك السنوي.
            </p>
          </div>

          {/* Monthly (Default) vs Yearly Switcher */}
          <div className="inline-flex items-center gap-2 p-1.5 rounded-2xl bg-surface-2 border border-line">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`min-h-[40px] px-5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-panel text-ink shadow-sm border border-line'
                  : 'text-muted hover:text-ink'
              }`}
            >
              اشتراك شهري
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`min-h-[40px] px-5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
                billingCycle === 'yearly'
                  ? 'bg-brand text-on-brand shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>اشتراك سنوي</span>
              <span className="text-2xs px-2 py-0.5 rounded-full bg-ok-soft text-ok-ink font-black">
                شهرين مجاناً
              </span>
            </button>
          </div>

          {/* Two Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <PricingTierCard
              badge="الباقة الأساسية"
              badgeTone="neutral"
              title="باقة المحلات والمخازن"
              subtitle="مثالية للمحلات، معارض الملابس والأحذية، الفروع، والمناديب."
              tier={pricing.basic}
              billingCycle={billingCycle}
              trialDays={pricing.trial_days}
              features={BASIC_PLAN_FEATURES}
              whatsAppText="مرحباً، أرغب في الاستفسار عن باقة المحلات والمخازن (الأساسية) في إنجاز برو EBMS."
              onWhatsApp={onWhatsApp}
            />

            <PricingTierCard
              badge="الأكثر تكاملاً"
              badgeTone="brand"
              title="باقة المتاجر المتكاملة (برو)"
              subtitle="تشمل كامل المحلات والمخازن + ربط لحظي مع متاجر Shopify و WordPress."
              tier={pricing.pro}
              billingCycle={billingCycle}
              trialDays={pricing.trial_days}
              features={PRO_PLAN_FEATURES}
              featured
              whatsAppText="مرحباً، أرغب في الاشتراك بباقة المتاجر المتكاملة (برو) الشاملة لربط Shopify و WordPress."
              onWhatsApp={onWhatsApp}
            />
          </div>

          <p className="text-xs text-muted">
            ملاحظة: خدمة تصميم وبناء متجر إلكتروني خاص بك من الصفر (WordPress أو Shopify) خدمة مستقلة يُحدد سعرها حسب تفاصيل المتجر.
          </p>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 relative z-10 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <Badge tone="neutral">الأسئلة الشائعة</Badge>
            <h2 className="text-2xl sm:text-3xl font-black text-ink">إجابات واضحة قبل أن تبدأ</h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <Card key={item.question} className="p-0 sm:p-0 overflow-hidden bg-panel">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between gap-4 text-right text-sm sm:text-base font-black text-ink hover:bg-surface-2/60 transition-colors cursor-pointer"
                  >
                    <span>{item.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-brand' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 pt-2 text-xs sm:text-sm text-muted leading-relaxed border-t border-line">
                      {item.answer}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Light-Only Conversion Banner */}
      <section className="relative z-10 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Card className="bg-brand-soft border-2 border-brand/25 text-center space-y-5 shadow-md p-6 sm:p-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-panel border border-brand/20 text-xs font-black text-brand mx-auto">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{BRAND_IDENTITY.acronym} • {BRAND_IDENTITY.arabicFull}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-ink">
              ابدأ تنظيم مبيعاتك ومخازنك ومتجرك اليوم خلال دقيقة واحدة
            </h2>
            <p className="text-xs sm:text-sm text-muted max-w-2xl mx-auto leading-relaxed">
              أنشئ حسابك السحابي الآن وجرّب الكاشير، المناديب، تقفيل الورديات، وربط Shopify أو WordPress لمدة {pricing.trial_days} يوماً مجاناً بالكامل دون بطاقة بنكية.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <Link to="/register" className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto font-black shadow-sm"
                  rightIcon={<ArrowLeft className="w-4 h-4 shrink-0" />}
                >
                  أنشئ حسابك المجاني الآن
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  لديك حساب؟ دخول الكاشير
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      <footer className="relative z-10 border-t border-line bg-panel py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <BrandLogo size="sm" showArabic={false} />
            <span>— {BRAND_IDENTITY.arabicFull} ({BRAND_IDENTITY.englishFull} · {BRAND_IDENTITY.acronym})</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 font-semibold">
            <a href="#showcase" className="hover:text-ink transition-colors">
              صور النظام
            </a>
            <a href="#pricing" className="hover:text-ink transition-colors">
              الأسعار
            </a>
            <a href="#custom-store" className="hover:text-ink transition-colors">
              تصميم المتاجر
            </a>
            <button
              type="button"
              onClick={() => setActiveLegalModal('privacy')}
              className="hover:text-ink transition-colors cursor-pointer"
            >
              سياسة الخصوصية
            </button>
            <button
              type="button"
              onClick={() => setActiveLegalModal('terms')}
              className="hover:text-ink transition-colors cursor-pointer"
            >
              شروط الخدمة
            </button>
            <button
              type="button"
              onClick={() => onWhatsApp('مرحباً، أود الاستفسار عن منظومة إنجاز برو EBMS.')}
              className="hover:text-ok-ink transition-colors cursor-pointer"
            >
              الدعم الفوري
            </button>
          </div>
        </div>
      </footer>

      {activeLegalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveLegalModal(null);
          }}
        >
          <Card className="w-full max-w-lg text-right space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-black text-ink">
                {activeLegalModal === 'privacy' ? 'سياسة الخصوصية وحماية البيانات' : 'شروط استخدام الخدمة'}
              </h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setActiveLegalModal(null)}>
                إغلاق
              </Button>
            </div>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              {activeLegalModal === 'privacy'
                ? 'جميع بيانات متجرك، فواتيرك، وعملائك معزولة بالكامل ومشفرة على خوادم إنجاز برو (EBMS). لا يتم بيع أو مشاركة أي بيانات مالية أو تجارية مع أي طرف ثالث.'
                : 'يُمنح كل مشترك فترة تجريبية مجانية لتقييم المنظومة قبل الترقية. يلتزم المشترك بحفظ سرية بيانات الدخول وصلاحيات الموظفين داخل حسابه.'}
            </p>
          </Card>
        </div>
      )}
    </>
  );
};
