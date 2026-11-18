import React, { useState } from 'react';
import { CheckCircle2, Layers, XCircle } from 'lucide-react';
import { Badge, Card } from '../ui';
import { INTEGRATIONS_LIST, SYSTEM_PILLARS } from './landingContent';

const BEFORE_POINTS = [
  'اختلاط الفلوس الكاش بالتحويلات الإلكترونية وصعوبة اكتشاف العجز آخر اليوم.',
  'ضياع بضاعة مع المناديب أو بين الفروع بسبب غياب أذون الاستلام الرسمية.',
  'بيع قطعة على متجر WordPress أو Shopify رغم أنها بيعت في المحل قبل دقائق.',
  'عدم معرفة صافي الربح الحقيقي بعد خصم تكلفة البضاعة والمصروفات والشحن.',
] as const;

const AFTER_POINTS = [
  {
    title: 'تقفيل ورديات بالقرش:',
    desc: 'فصل كامل للدرج النقدي، الفيزا، إنستاباي وفودافون كاش مع إثبات العجز أو الزيادة.',
  },
  {
    title: 'أذون تحويل وعهد موثقة:',
    desc: 'كل حركة بضاعة بين المخازن والفروع والمناديب لا تُعتمد إلا بتأكيد الاستلام.',
  },
  {
    title: 'ربط Shopify و WordPress لحظياً:',
    desc: 'حجز أوتوماتيك للكميات فور وصول الطلب أونلاين لمنع أي بيع مزدوج.',
  },
  {
    title: 'صافي الربح الحقيقي فوراً:',
    desc: 'تقارير دقيقة توضح تكلفة البضاعة والمصروفات وصافي المكسب لكل فرع ووردية.',
  },
] as const;

/**
 * Renders the business comparison, interactive 6-pillar module explorer, and integrations strip.
 */
export const LandingComparisonAndPillars: React.FC = () => {
  const [activePillar, setActivePillar] = useState(0);
  const currentPillar = SYSTEM_PILLARS[activePillar];
  const PillarIcon = currentPillar.icon;

  return (
    <>
      <section id="compare" className="scroll-mt-24 relative z-20 max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge tone="brand">لماذا يختار التجار إنجاز برو؟</Badge>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-3">
            وداعاً لتسريب الأرباح ولخبطة الجرد آخر الشهر
          </h2>
          <p className="text-sm text-muted mt-2">
            الفرق بين الإدارة العشوائية ونظام متكامل يحفظ لك فلوسك وبضاعتك في كل وردية.
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
              {BEFORE_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <span className="text-bad font-black">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="space-y-4 border-brand/40 shadow-lg">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 font-black text-ok">
                <CheckCircle2 className="w-5 h-5" />
                <span>الانضباط الكامل مع إنجاز برو (EBMS)</span>
              </div>
              <Badge tone="ok" dot>
                رقابة محكمة
              </Badge>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-ink font-medium">
              {AFTER_POINTS.map((item) => (
                <li key={item.title} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                  <span>
                    <strong>{item.title}</strong> {item.desc}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section id="pillars" className="scroll-mt-24 relative z-20 max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge tone="brand">أركان المنظومة الستة</Badge>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-3">
            كل أدوات التشغيل والمحاسبة والمتاجر في مكان واحد
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-2.5">
            {SYSTEM_PILLARS.map((pillar, idx) => {
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
                    className={`text-2xs px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap ${
                      isSelected ? 'bg-panel/20 text-on-brand' : 'bg-surface-2 text-muted'
                    }`}
                  >
                    {pillar.badge}
                  </span>
                </button>
              );
            })}
          </div>

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

            <div className="p-4 rounded-2xl bg-ok-soft border border-ok/20 text-ok-ink text-xs sm:text-sm font-bold flex items-center gap-2.5">
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

      <section id="integrations" className="scroll-mt-24 relative z-10 py-14 border-y border-line bg-panel">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-8">
            <Badge tone="info">جاهز للتشغيل والربط</Badge>
            <h2 className="text-2xl sm:text-3xl font-black text-ink mt-2">
              يعمل بانسجام مع متاجرك الإلكترونية ومعدات محلك
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {INTEGRATIONS_LIST.map((item) => (
              <Card key={item.name} className="flex flex-col justify-between gap-2 bg-canvas">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-black text-ink">{item.name}</span>
                  <Badge tone="neutral">{item.badge}</Badge>
                </div>
                <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
