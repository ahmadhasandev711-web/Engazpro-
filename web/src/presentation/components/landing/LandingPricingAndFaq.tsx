import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
} from 'lucide-react';
import type { PublicPricingData } from '../../../hooks/usePublicPricing';
import { BrandLogo } from '../common/BrandLogo';
import { Badge, Button, Card } from '../ui';

interface LandingPricingAndFaqProps {
  pricing: PublicPricingData;
  onWhatsApp: (text: string) => void;
}

const ONBOARDING_STEPS = [
  {
    step: '1',
    title: 'أنشئ حسابك في دقيقة',
    desc: 'أدخل اسم نشاطك وحدد فروعك وخزائنك. تبدأ تجربتك المجانية فوراً بدون بطاقة بنكية.',
  },
  {
    step: '2',
    title: 'استورد أصنافك أو اربط ووكومرس',
    desc: 'ارفع أصنافك من Excel بنقرة واحدة أو فعّل المزامنة مع متجرك الإلكتروني لسحب المنتجات.',
  },
  {
    step: '3',
    title: 'ابدأ البيع وراقب كل جنيه',
    desc: 'أصدر فواتير POS، سلّم عهد المناديب بأذون رسمية، وطابق تقفيل الورديات أولاً بأول.',
  },
] as const;

const PLAN_FEATURES = [
  'نظام كاشير POS لمسي سريع مع باركود والمقاسات والألوان',
  'تعدد الفروع والمخازن والتحويلات الموثقة بالاستلام',
  'حسابات دقيقة لعهَد المناديب والمرتجعات والتحصيلات',
  'فصل الخزن والبنوك والمحافظ وتقفيل الورديات Z-Report',
  'ربط ثنائي الاتجاه مع متجر WooCommerce عبر Webhooks',
  'إصدار فواتير A4 وطابعات حرارية 58mm و 80mm وباركود',
  'أدوار وصلاحيات دقيقة للموظفين + سجل نشاطات',
  'تشغيل سحابي مستقر + وضع PWA على الهاتف والكمبيوتر',
] as const;

const FAQ_ITEMS = [
  {
    question: 'هل أحتاج لجهاز كاشير غالي الثمن لتشغيل إنجاز برو؟',
    answer:
      'لا، يعمل النظام من أي متصفح على الكمبيوتر أو اللابتوب أو التابلت والموبايل، ويدعم طابعات الإيصالات الحرارية 58mm و 80mm وطباعة A4 وقارئات الباركود القياسية.',
  },
  {
    question: 'كيف يحميني النظام من عجز الكاشير أو لخبطة عهد المناديب؟',
    answer:
      'كل كاشير يفتح ويقفل ورديته بمطابقة النقدية الفعلية بالمتوقعة في تقرير Z-Report، ولكل مندوب عهدة منفصلة ولا تنتقل البضاعة بين الفروع والمناديب إلا بأذون تحويل موثقة بالاستلام.',
  },
  {
    question: 'هل الباقة تشمل تصميم متجر إلكتروني أم برنامج الكاشير والمخازن فقط؟',
    answer:
      'اشتراك الباقة السحابية يغطي منظومة الكاشير والمخازن والفروع والمناديب والربط التلقائي مع ووكومرس، بينما تصميم وتطوير متجر إلكتروني خاص بك من الصفر هو خدمة مستقلة اختيارية حسب الطلب.',
  },
  {
    question: 'كيف يعمل تفعيل الباقة بعد انتهاء الفترة التجريبية؟',
    answer:
      'تستمتع بجميع المميزات مجاناً خلال الفترة التجريبية. وعند الترقية يمكنك تفعيل كود اشتراك سنوي أو التواصل مع الدعم عبر واتساب للتفعيل الفوري مع احتفاظك بكافة فواتيرك وبياناتك.',
  },
] as const;

/**
 * Renders onboarding steps, transparent API-driven pricing card, accessible FAQ accordion, final CTA, and footer.
 */
export const LandingPricingAndFaq: React.FC<LandingPricingAndFaqProps> = ({
  pricing,
  onWhatsApp,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeLegalModal, setActiveLegalModal] = useState<'privacy' | 'terms' | null>(null);

  const displayedPrice =
    billingCycle === 'yearly' ? pricing.yearly_monthly_equivalent : pricing.monthly_price;

  return (
    <>
      {/* 5. Three-Step Onboarding */}
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
              <Card key={item.step} className="space-y-3">
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

      {/* 6. Pricing Section */}
      <section id="pricing" className="scroll-mt-24 relative z-10 py-16 sm:py-20 bg-panel/60 border-y border-line">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-8">
          <div className="space-y-3">
            <Badge tone="ok">أسعار واضحة بدون رسوم خفية</Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-ink">
              باقة شاملة لكل مميزات المنظومة، تبدأ بتجربة مجانية
            </h2>
            <p className="text-sm text-muted">
              جميع الوحدات والتقارير متاحة من اليوم الأول بدون تقسيم مميزات أساسية.
            </p>
          </div>

          {/* Billing Cycle Switcher */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`text-sm font-bold transition-colors ${
                billingCycle === 'monthly' ? 'text-ink' : 'text-muted'
              }`}
            >
              دفع شهري
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={billingCycle === 'yearly'}
              aria-label="تبديل نظام الدفع بين الشهري والسنوي"
              onClick={() =>
                setBillingCycle((prev) => (prev === 'yearly' ? 'monthly' : 'yearly'))
              }
              className={`relative w-14 h-8 rounded-full transition-colors p-1 flex items-center ${
                billingCycle === 'yearly' ? 'bg-brand' : 'bg-surface-2 border border-line'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full transition-transform ${
                  billingCycle === 'yearly'
                    ? '-translate-x-6 bg-panel shadow-sm'
                    : 'translate-x-0 bg-muted'
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`text-sm font-bold flex items-center gap-2 transition-colors ${
                billingCycle === 'yearly' ? 'text-brand-ink' : 'text-muted'
              }`}
            >
              <span>اشتراك سنوي</span>
              <Badge tone="ok">وفّر {pricing.annual_savings.toLocaleString('en-US')} ج.م</Badge>
            </button>
          </div>

          {/* Main Plan Card */}
          <Card className="text-right space-y-6 border-brand/30 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl sm:text-2xl font-black text-ink">
                    الباقة المتكاملة — EngazPRO
                  </h3>
                  <Badge tone="brand">الأكثر توفيراً</Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted">
                  تشمل تجربة مجانية كاملة لمدة {pricing.trial_days} يوماً بدون بطاقة بنكية
                </p>
              </div>

              <div className="sm:text-left shrink-0">
                <div className="flex items-baseline sm:justify-end gap-1.5">
                  <span className="text-4xl font-black text-brand tabular-nums">
                    {displayedPrice.toLocaleString('en-US')}
                  </span>
                  <span className="text-xs font-bold text-muted">ج.م / شهر</span>
                </div>
                {billingCycle === 'yearly' ? (
                  <div className="text-xs font-bold text-ok-ink mt-1 tabular-nums">
                    يُدفع {pricing.annual_price.toLocaleString('en-US')} ج.م سنوياً
                  </div>
                ) : (
                  <div className="text-xs text-muted mt-1 tabular-nums">
                    أو {pricing.annual_price.toLocaleString('en-US')} ج.م سنوياً (شهرين مجاناً)
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm font-medium text-ink">
              {PLAN_FEATURES.map((feat) => (
                <div key={feat} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-surface-2 border border-line text-xs text-muted leading-relaxed">
              <strong className="text-ink">توضيح شفاف:</strong> يشمل الاشتراك برنامج الكاشير، المخازن، الفروع، المناديب، والمزامنة التلقائية مع متاجر WooCommerce. بينما خدمة تصميم متجر إلكتروني من الصفر هي باقة تطوير مستقلة اختيارية.
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <Link to="/register" className="w-full sm:flex-1">
                <Button size="lg" className="w-full font-black" rightIcon={<ArrowLeft className="w-4 h-4 shrink-0" />}>
                  ابدأ تجربتك المجانية ({pricing.trial_days} يوم)
                </Button>
              </Link>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto font-bold"
                leftIcon={<MessageCircle className="w-4 h-4 text-ok shrink-0" />}
                onClick={() =>
                  onWhatsApp(
                    `مرحباً، أريد الاستفسار عن باقة إنجاز برو (${billingCycle === 'yearly' ? 'السنوية' : 'الشهرية'}) وتجربة ${pricing.trial_days} يوم.`
                  )
                }
              >
                اسأل فريق المبيعات
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* 7. FAQ Section (Aligned with JSON-LD Schema in index.html) */}
      <section id="faq" className="scroll-mt-24 relative z-10 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <Badge tone="neutral">أسئلة شائعة</Badge>
            <h2 className="text-2xl sm:text-3xl font-black text-ink">
              إجابات واضحة قبل أن تبدأ
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <Card key={item.question} className="p-0 sm:p-0 overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between gap-4 text-right text-sm sm:text-base font-black text-ink hover:bg-surface-2/60 transition-colors"
                  >
                    <span>{item.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-brand' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 text-xs sm:text-sm text-muted leading-relaxed border-t border-line">
                      {item.answer}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. Final Conversion Banner */}
      <section className="relative z-10 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Card className="bg-brand text-on-brand border-brand text-center space-y-5 shadow-lg">
            <h2 className="text-2xl sm:text-3xl font-black">
              ابدأ تنظيم مبيعاتك ومخازنك اليوم خلال دقيقة واحدة
            </h2>
            <p className="text-xs sm:text-sm opacity-90 max-w-2xl mx-auto leading-relaxed">
              أنشئ متجرك السحابي الآن وجرّب الكاشير، المناديب، وتقفيل الورديات لمدة {pricing.trial_days} يوماً مجاناً بالكامل دون بطاقة بنكية.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <Link to="/register" className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto font-black"
                  rightIcon={<ArrowLeft className="w-4 h-4 shrink-0" />}
                >
                  أنشئ متجرك المجاني الآن
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full sm:w-auto text-on-brand hover:bg-panel/15 border border-on-brand/30"
                >
                  لديك حساب؟ دخول الكاشير
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* 9. Clean Footer */}
      <footer className="relative z-10 border-t border-line bg-panel py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="sm" showArabic={false} />
            <span>— منظومة نقاط البيع والمخازن والمناديب</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 font-semibold">
            <a href="#pricing" className="hover:text-ink transition-colors">
              الأسعار
            </a>
            <a href="#faq" className="hover:text-ink transition-colors">
              الأسئلة الشائعة
            </a>
            <button
              type="button"
              onClick={() => setActiveLegalModal('privacy')}
              className="hover:text-ink transition-colors"
            >
              سياسة الخصوصية
            </button>
            <button
              type="button"
              onClick={() => setActiveLegalModal('terms')}
              className="hover:text-ink transition-colors"
            >
              شروط الخدمة
            </button>
            <button
              type="button"
              onClick={() => onWhatsApp('مرحباً، أود الاستفسار عن منظومة إنجاز برو.')}
              className="hover:text-ok-ink transition-colors"
            >
              الدعم الفوري
            </button>
          </div>
        </div>
      </footer>

      {/* Legal Policy Modal */}
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
                ? 'جميع بيانات متجرك، فواتيرك، وعملائك معزولة بالكامل ومشفرة على خوادم إنجاز برو. لا يتم بيع أو مشاركة أي بيانات مالية أو تجارية مع أي طرف ثالث.'
                : 'يُمنح كل مشترك فترة تجريبية مجانية لتقييم المنظومة قبل الترقية. يلتزم المشترك بحفظ سرية بيانات الدخول وصلاحيات الموظفين داخل حسابه.'}
            </p>
          </Card>
        </div>
      )}
    </>
  );
};
