import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Layers,
  ShoppingBag,
  Store,
  TrendingUp,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Badge, Card } from '../ui';

const CAPABILITIES = [
  { metric: '60 ثانية', label: 'لإنشاء متجرك وبدء البيع السحابي', tone: 'text-brand' },
  { metric: '100% عزل', label: 'صلاحيات دقيقة لكل فرع وموظف', tone: 'text-ok' },
  { metric: '58/80mm & A4', label: 'دعم كامل لطابعات الإيصالات والباركود', tone: 'text-info' },
  { metric: 'Web + PWA', label: 'يعمل على الكمبيوتر والتابلت والموبايل', tone: 'text-warn' },
] as const;

const PILLARS = [
  {
    id: 0,
    title: 'نقطة بيع سريعة (POS) للمحلات والمعارض',
    shortTitle: 'كاشير POS ذكي',
    badge: 'السرعة والسهولة',
    icon: Store,
    desc: 'كاشير لمسي فائق السرعة يدعم قارئ الباركود، المقاسات والألوان، الدفع المجزأ (نقدي + إنستاباي/شبكة)، وتعليق الفواتير مع مشاركة الإيصال.',
    proofTitle: 'فاتورة خلال ثوانٍ مع خصم تلقائي من رصيد الفرع وتسوية الدرج.',
    features: [
      'متوافق مع شاشات اللمس والموبايل والتابلت',
      'دعم قارئات الباركود والمقاسات والألوان',
      'طباعة حرارية 58mm و 80mm أو مشاركة واتساب',
    ],
  },
  {
    id: 1,
    title: 'فصل الخزن والعهد والرقابة على الورديات',
    shortTitle: 'الخزن والورديات',
    badge: 'صفر عجز مالي',
    icon: Wallet,
    desc: 'افصل خزينة المحل الرئيسية عن أدراج الكاشير وعهد المناديب وحسابات البنوك والمحافظ الإلكترونية، مع تقرير تقفيل Z-Report صارم يمنع التلاعب.',
    proofTitle: 'مطابقة دقيقة لنقدية الدرج وإظهار أي عجز أو زيادة فور تسليم الوردية.',
    features: [
      'خزينة رئيسية + أدراج كاشير + محافظ وبنوك مستقلة',
      'تقرير تسوية نهاية الوردية (Z-Report) بالمطابقة الفعلية',
      'دفتر أستاذ زمني (Ledger) لكل حركة وارد ومنصرف',
    ],
  },
  {
    id: 2,
    title: 'إدارة الفروع والمخازن وأذون التحويل الرسمية',
    shortTitle: 'الفروع والمخازن',
    badge: 'مركزية متكاملة',
    icon: Building2,
    desc: 'راقب أرصدة بضائعك عبر كل الفروع والمستودعات من شاشة واحدة. انقل البضائع بأذون تحويل رسمية تتطلب تأكيد الاستلام لمنع فقدان الأصناف.',
    proofTitle: 'تتبع حركة البضاعة المنقولة بين المستودع والمعارض وسيارات المناديب.',
    features: [
      'جرد حي متزامن على مستوى الصنف والفرع والمقاس',
      'أذون تحويل بضاعة موثقة بإجراءات تسليم واستلام',
      'تقييم المخزون بسعر التكلفة وسعر البيع',
    ],
  },
  {
    id: 3,
    title: 'مبيعات المناديب والتحصيل الميداني (Van Sales)',
    shortTitle: 'المناديب والشحن',
    badge: 'مبيعات ميدانية',
    icon: Truck,
    desc: 'جهّز المندوب بعهدة بضاعة رسمية وأصدر فواتير وسندات قبض من المتصفح، مع طباعة مانيفست تسليم شركات الشحن وحساب مبالغ COD بدقة.',
    proofTitle: 'إغلاق كامل للفجوة بين ما خرج من المخزن وما عاد من نقدية أو مرتجع.',
    features: [
      'مانيفست شحن يومي وبوالص COD لشركات التوصيل',
      'كشف حساب لحظي للعملاء والموردين بالآجل',
      'توريد نقدية المندوب للخزينة بسندات معتمدة',
    ],
  },
  {
    id: 4,
    title: 'الربط المباشر وثنائي الاتجاه مع WooCommerce',
    shortTitle: 'ربط ووكومرس',
    badge: 'تزامن لحظي',
    icon: ShoppingBag,
    desc: 'سحب تلقائي لطلبات متجرك الإلكتروني عبر Webhook وتوليد فواتير فورية مع حجز الرصيد من الفروع المحددة لمنع بيع أصناف نفدت من المعرض.',
    proofTitle: 'تحديث آلي للكميات بين المعرض والمتجر الإلكتروني دون إدخال يدوي.',
    features: [
      'سحب أوردرات المتجر الإلكتروني تلقائياً فور إنشائها',
      'خصم الكميات المحجوزة لحظياً لمنع البيع المزدوج',
      'تجهيز وشحن الطلبات وربطها بالمناديب والخزن',
    ],
  },
  {
    id: 5,
    title: 'تقارير الأرباح الصافية (COGS) وعمولات الموظفين',
    shortTitle: 'الأرباح الحقيقية',
    badge: 'دقة محاسبية',
    icon: TrendingUp,
    desc: 'اعرف صافي ربحك الحقيقي بعد خصم تكلفة البضاعة المباعة (COGS) والمصروفات التشغيلية، مع حساب آلي لعمولات البائعين والكاشير والمناديب.',
    proofTitle: 'تقارير مالية دقيقة قابلة للطباعة بصيغة A4 أو التصدير إلى Excel.',
    features: [
      'تقرير الأرباح والخسائر التفصيلي وهامش الربح',
      'كشوف حساب العملاء والموردين وملخص الخزائن',
      'تصدير Excel وتقارير رسمية جاهزة للطباعة',
    ],
  },
] as const;

const INTEGRATIONS = [
  { name: 'WooCommerce', desc: 'مزامنة الطلبات والمخزون', badge: 'تلقائي' },
  { name: 'InstaPay / بنوك', desc: 'حسابات تحويل منفصلة', badge: 'مالي' },
  { name: 'فودافون كاش', desc: 'خزن ومحافظ إلكترونية', badge: 'محافظ' },
  { name: 'طابعات 58/80mm', desc: 'إيصالات حرارية وباركود', badge: 'طباعة' },
  { name: 'قارئات الباركود', desc: 'دعم USB ولاسلكي', badge: 'POS' },
  { name: 'تصدير Excel', desc: 'كافة التقارير والجرد', badge: 'تقارير' },
  { name: 'واتساب', desc: 'مشاركة الفواتير والإيصالات', badge: 'عملاء' },
  { name: 'تطبيق PWA', desc: 'تثبيت على أندرويد و iOS', badge: 'موبايل' },
] as const;

/** Capabilities strip, chaos-vs-discipline comparison, 6 interactive pillars, onboarding steps, and integrations. */
export const LandingComparisonAndPillars: React.FC = () => {
  const [activePillar, setActivePillar] = useState(0);
  const currentPillar = PILLARS[activePillar];
  const PillarIcon = currentPillar.icon;

  return (
    <>
      {/* 1. Verifiable Capabilities Strip */}
      <section className="relative z-10 py-10 border-y border-line bg-panel/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
          {CAPABILITIES.map((cap) => (
            <Card key={cap.metric} className="shadow-xs">
              <div className={`text-xl sm:text-2xl font-black font-mono ${cap.tone}`}>{cap.metric}</div>
              <p className="text-xs font-medium text-muted mt-1.5">{cap.label}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 2. Chaos vs Discipline Comparison */}
      <section id="compare" className="scroll-mt-24 relative z-20 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge tone="brand">مقارنة عملية</Badge>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-3">
            وداعاً لتسريب الأرباح ولخبطة الجرد آخر الشهر
          </h2>
          <p className="text-sm text-muted mt-2">
            الفرق بين الإدارة العشوائية ونظام مالي محكم يبدأ من إقفال أول وردية.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 font-black text-bad">
                <XCircle className="w-5 h-5" />
                <span>الدفاتر أو برامج الكاشير التقليدية</span>
              </div>
              <Badge tone="bad">ثغرات وهدر</Badge>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-muted">
              <li className="flex items-start gap-2.5">
                <span className="text-bad font-black">•</span>
                <span>اختلاط النقدية بالتحويلات الإلكترونية وغياب مطابقة فعلية عند إقفال الشيفت.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-bad font-black">•</span>
                <span>بضاعة تخرج مع المناديب أو بين الفروع بدون إذن تحويل موثق للاستلام.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-bad font-black">•</span>
                <span>بيع قطعة من المتجر الإلكتروني رغم أنها بيعت داخل المعرض قبل قليل.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-bad font-black">•</span>
                <span>الخلط بين إجمالي المبيعات وصافي الربح الحقيقي بعد التكلفة والمصروفات.</span>
              </li>
            </ul>
          </Card>

          <Card className="space-y-4 border-brand/40 shadow-lg">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 font-black text-ok">
                <CheckCircle2 className="w-5 h-5" />
                <span>الانضباط الكامل مع إنجاز برو</span>
              </div>
              <Badge tone="ok" dot>
                رقابة محكمة
              </Badge>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-ink font-medium">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                <span>
                  <strong>تقرير Z-Report صارم:</strong> فصل الخزن وإثبات العجز أو الزيادة بالقرش عند تسليم الدرج.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                <span>
                  <strong>أذون تحويل وعهد موثقة:</strong> لا تُضاف بضاعة لعهدة فرع أو مندوب إلا بتأكيد الاستلام.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                <span>
                  <strong>حجز مخزون ووكومرس ذكي:</strong> خصم الطلبات الجارية أونلاين لحظياً لمنع البيع المزدوج.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                <span>
                  <strong>قائمة دخل COGS حقيقية:</strong> متابعة الربح الصافي لكل فاتورة ووردية وفرع بنقرة زر.
                </span>
              </li>
            </ul>
          </Card>
        </div>
      </section>

      {/* 3. Interactive 6 System Pillars */}
      <section id="pillars" className="scroll-mt-24 relative z-20 max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge tone="brand">أركان المنظومة الستة</Badge>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-3">
            كل أدوات التشغيل والمحاسبة في مكان واحد
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Pillar Selector Tabs */}
          <div className="lg:col-span-5 space-y-2.5">
            {PILLARS.map((pillar, idx) => {
              const Icon = pillar.icon;
              const isSelected = activePillar === idx;
              return (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => setActivePillar(idx)}
                  className={`w-full min-h-[56px] text-right px-4 py-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-brand text-on-brand border-brand shadow-md'
                      : 'bg-panel text-ink border-line hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-panel/20 text-on-brand' : 'bg-brand-soft text-brand'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-black">{pillar.shortTitle}</span>
                  </div>
                  <span
                    className={`text-2xs px-2.5 py-0.5 rounded-full font-bold ${
                      isSelected ? 'bg-panel/20 text-on-brand' : 'bg-surface-2 text-muted'
                    }`}
                  >
                    {pillar.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Pillar Detail Panel */}
          <Card className="lg:col-span-7 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-soft border border-brand/20 text-brand flex items-center justify-center shrink-0">
                  <PillarIcon className="w-6 h-6" />
                </div>
                <div>
                  <Badge tone="brand">{currentPillar.badge}</Badge>
                  <h3 className="text-lg sm:text-xl font-black text-ink mt-1">{currentPillar.title}</h3>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted leading-relaxed">{currentPillar.desc}</p>

            <div className="p-4 rounded-2xl bg-ok-soft border border-ok/20 text-ok text-xs sm:text-sm font-bold flex items-center gap-2.5">
              <Layers className="w-4 h-4 shrink-0" />
              <span>{currentPillar.proofTitle}</span>
            </div>

            <div className="space-y-2.5 pt-1">
              {currentPillar.features.map((feat) => (
                <div key={feat} className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-ink">
                  <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* 4. Integrations Ecosystem */}
      <section id="integrations" className="scroll-mt-24 relative z-10 py-14 border-y border-line bg-panel/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-8">
            <Badge tone="info">جاهز للتشغيل والربط</Badge>
            <h2 className="text-2xl sm:text-3xl font-black text-ink mt-2">
              يعمل بانسجام مع أدوات ومعدات متجرك
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {INTEGRATIONS.map((item) => (
              <Card key={item.name} className="flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-black text-ink">{item.name}</span>
                  <Badge tone="neutral">{item.badge}</Badge>
                </div>
                <p className="text-xs text-muted">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
