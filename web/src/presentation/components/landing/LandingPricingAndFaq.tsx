import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Headphones,
  Lock,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
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
  const mainPrice = isYearly ? Math.round(tier.yearly_monthly_equivalent) : tier.monthly_price;
  const dailyEquivalent = (Math.round((mainPrice / 30) * 10) / 10).toLocaleString('en-US');

  return (
    <Card
      className={`relative text-right p-6 sm:p-8 rounded-3xl flex flex-col justify-between space-y-6 ${
        featured
          ? 'border-2 border-brand bg-gradient-to-b from-brand-soft/75 via-panel to-panel shadow-2xl'
          : 'border border-line bg-panel shadow-md'
      }`}
    >
      {featured && (
        <div className="absolute -top-3.5 left-6 px-3.5 py-1 rounded-full bg-brand text-on-brand text-xs font-black shadow-md inline-flex items-center gap-1">
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>الأكثر اختياراً</span>
        </div>
      )}

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
            <p className="text-2xs font-bold text-ok mt-1 tabular-nums">
              ~{dailyEquivalent} ج.م فقط يومياً
            </p>
            <p className="text-2xs font-semibold text-muted mt-0.5 tabular-nums">
              {isYearly
                ? `يُدفع ${tier.annual_price.toLocaleString('en-US')} ج.م سنوياً (توفير ${tier.annual_savings.toLocaleString('en-US')} ج)`
                : `أو ${tier.annual_price.toLocaleString('en-US')} ج.م سنوياً (شهرين مجاناً)`}
            </p>
          </div>
        </div>

        <ul className="space-y-2.5 text-xs sm:text-sm font-semibold text-ink">
          {features.map((feat) => (
            <li key={feat} className="flex items-start gap-2.5">
              <CheckCircle2
                className={`w-4 h-4 shrink-0 mt-0.5 ${featured ? 'text-brand' : 'text-ok'}`}
              />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Link to="/register" className="flex-1">
            <Button
              variant={featured ? 'primary' : 'secondary'}
              size="lg"
              className={`w-full font-black ${featured ? 'ebms-btn-shimmer shadow-lg' : 'border-brand/40 text-brand-ink'}`}
              rightIcon={<ArrowLeft className="w-4 h-4 shrink-0" />}
            >
              ابدأ {trialDays} يوم مجاناً
            </Button>
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => onWhatsApp(whatsAppText)}
            leftIcon={<MessageCircle className="w-4 h-4 text-ok shrink-0" />}
          >
            واتساب
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-2xs font-bold text-muted">
          <Lock className="w-3 h-3 text-ok shrink-0" />
          <span>آمن وموثوق • بدون بطاقة بنكية • إلغاء في أي وقت</span>
        </div>
      </div>
    </Card>
  );
};

/**
 * Connected onboarding steps, live API-driven pricing tiers, compact FAQ accordion,
 * high-contrast closing CTA banner, and legal footer.
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
      {/* 3 Connected Steps + Live Pricing */}
      <section id="pricing" data-reveal className="scroll-mt-24 relative z-10 py-14 sm:py-20 bg-panel border-y border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-16">
          {/* 3 Steps */}
          <div className="space-y-8 text-center">
            <div className="space-y-2">
              <Badge tone="brand">انطلاق سريع</Badge>
              <h2 className="text-2xl sm:text-3xl font-black text-ink">
                ثلاث خطوات فقط.. ثم يعمل محلك بالنظام التلقائي
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative">
              <div
                className="hidden md:block absolute top-11 right-[18%] left-[18%] h-0.5 bg-gradient-to-l from-primary-200 via-brand to-primary-200"
                aria-hidden="true"
              />
              {ONBOARDING_STEPS.map((item, idx) => (
                <Card key={item.step} className="relative space-y-3 bg-canvas rounded-3xl p-6 text-center">
                  <div
                    className={`w-11 h-11 rounded-2xl text-on-brand font-black text-lg flex items-center justify-center tabular-nums mx-auto shadow-md relative z-10 ${
                      idx === 2 ? 'bg-ok' : 'bg-brand'
                    }`}
                  >
                    {item.step}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-ink">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted leading-relaxed">{item.desc}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Pricing Header + Cycle Toggle + Cards */}
          <div className="space-y-9 text-center">
            <div className="space-y-3 max-w-2xl mx-auto">
              <Badge tone="ok">أسعار واضحة وعادلة بدون أي عمولة على مبيعاتك</Badge>
              <h2 className="text-2xl sm:text-4xl font-black text-ink">
                اختر الباقة المناسبة لنشاطك وابدأ مجاناً
              </h2>
              <p className="text-xs sm:text-sm text-muted">
                جرّب المنظومة كاملة لمدة {pricing.trial_days} يوم مجاناً — ووفر شهرين عند الاشتراك السنوي.
              </p>
            </div>

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
                <span className="text-2xs px-2 py-0.5 rounded-full bg-ok-soft text-ok font-black">
                  شهرين مجاناً
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto items-stretch">
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
                badge="المتكاملة (برو)"
                badgeTone="brand"
                title="المحلات + Shopify & WordPress"
                subtitle="كامل إدارة المحلات والفروع + مزامنة لحظية مع متجرك الإلكتروني."
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
              ملاحظة: خدمة تصميم وبناء متجر إلكتروني من الصفر (WordPress أو Shopify) خدمة مستقلة يُحدد سعرها حسب متطلبات المتجر.
            </p>
          </div>
        </div>
      </section>

      {/* Compact FAQ */}
      <section id="faq" data-reveal className="scroll-mt-24 relative z-10 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <Badge tone="neutral">الأسئلة الشائعة</Badge>
            <h2 className="text-2xl sm:text-3xl font-black text-ink">إجابات صريحة قبل أن تبدأ</h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <Card key={item.question} className="p-0 sm:p-0 overflow-hidden bg-panel rounded-2xl">
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

      {/* Monumental High-Contrast Closing CTA */}
      <section id="closing-cta" data-reveal className="relative z-10 pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto rounded-3xl sm:rounded-[2.25rem] bg-gradient-to-br from-primary-950 via-primary-800 to-brand text-on-brand p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl border border-brand/40">
          <div
            className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-on-brand/10 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-16 w-80 h-80 rounded-full bg-ok/20 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-2xl mx-auto space-y-5">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-on-brand/10 border border-on-brand/20 text-xs font-bold text-primary-100 mx-auto">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{BRAND_IDENTITY.acronym} • {BRAND_IDENTITY.arabicFull}</span>
            </div>

            <h2 className="text-2xl sm:text-5xl font-black leading-tight">
              ابدأ إدارة محلك بطريقة أذكى اليوم
            </h2>

            <p className="text-xs sm:text-base text-primary-100 leading-relaxed">
              جرّب الكاشير، تقفيل الورديات، عهد المناديب، وربط Shopify أو WordPress لمدة {pricing.trial_days} يوماً مجاناً بالكامل دون بطاقة بنكية.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                to="/register"
                className="w-full sm:w-auto min-h-[52px] px-7 py-3.5 rounded-2xl bg-panel text-brand-ink hover:bg-brand-soft font-black text-sm sm:text-base inline-flex items-center justify-center gap-2 shadow-xl transition-transform hover:-translate-y-0.5"
              >
                <span>ابدأ تجربتك المجانية الآن</span>
                <ArrowLeft className="w-4 h-4 shrink-0" />
              </Link>

              <button
                type="button"
                onClick={() =>
                  onWhatsApp('مرحباً فريق إنجاز برو EBMS، أريد حجز عرض سريع وتجربة المنظومة لنشاطي.')
                }
                className="w-full sm:w-auto min-h-[52px] px-6 py-3.5 rounded-2xl bg-on-brand/10 hover:bg-on-brand/15 border border-on-brand/25 text-on-brand font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-ok shrink-0" />
                <span>تواصل عبر واتساب</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-on-brand/15 text-xs font-bold text-primary-100">
              <div className="flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-ok shrink-0" />
                <span>بيانات معزولة وآمنة</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <Headphones className="w-4 h-4 text-primary-200 shrink-0" />
                <span>دعم فني عربي مباشر</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                <span>بدون التزام أو بطاقة</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-line bg-panel py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <BrandLogo size="sm" showArabic={false} />
            <span>— {BRAND_IDENTITY.arabicFull} ({BRAND_IDENTITY.englishFull} · {BRAND_IDENTITY.acronym})</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 font-semibold">
            <a href="#showcase" className="hover:text-ink transition-colors">
              صور النظام
            </a>
            <a href="#integrations" className="hover:text-ink transition-colors">
              التكامل والمتاجر
            </a>
            <a href="#pricing" className="hover:text-ink transition-colors">
              الأسعار
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
              className="hover:text-ok transition-colors cursor-pointer"
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
