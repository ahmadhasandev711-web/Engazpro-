import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Lock,
  Printer,
  ShieldCheck,
  TrendingUp,
  Truck,
  XCircle,
  Zap,
} from 'lucide-react';
import { Badge, Card } from '../ui';
import { LandingRoiWidget } from './LandingRoiWidget';
import { MERCHANT_PERSONAS, PAIN_VS_GAIN_DATA } from './landingContent';

interface LandingComparisonAndPillarsProps {
  proMonthlyPrice: number;
}

/**
 * Interactive Before/After transformation, target-merchant persona switcher,
 * asymmetric motion Bento Grid, and practical ROI calculator.
 */
export const LandingComparisonAndPillars: React.FC<LandingComparisonAndPillarsProps> = ({
  proMonthlyPrice,
}) => {
  const [compareMode, setCompareMode] = useState<'pain' | 'gain'>('pain');
  const [activePersonaIdx, setActivePersonaIdx] = useState(0);

  const isPain = compareMode === 'pain';
  const currentPersona = MERCHANT_PERSONAS[activePersonaIdx];
  const PersonaIcon = currentPersona.icon;

  return (
    <>
      {/* SECTION 2: Interactive Pain -> Transformation */}
      <section
        id="problem-solution"
        data-reveal
        className="scroll-mt-24 relative z-10 py-14 sm:py-20 bg-panel border-y border-line"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-9">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl text-right">
              <Badge tone={isPain ? 'bad' : 'ok'}>
                {isPain ? 'نزيف يومي بدون ما تحس' : 'الحل من أول يوم تشغيل'}
              </Badge>
              <h2 className="text-2xl sm:text-4xl font-black text-ink leading-tight">
                شغلك يكبر.. بس الفوضى بين المحل والأونلاين بتضيع المكسب
              </h2>
            </div>

            <div
              className="inline-flex p-1.5 rounded-2xl bg-surface-2 border border-line self-start md:self-auto"
              role="tablist"
              aria-label="مقارنة الوضع قبل وبعد النظام"
            >
              <button
                type="button"
                role="tab"
                aria-selected={isPain}
                onClick={() => setCompareMode('pain')}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  isPain ? 'bg-panel text-bad shadow-sm border border-bad/20' : 'text-muted hover:text-ink'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>قبل إنجاز برو</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isPain}
                onClick={() => setCompareMode('gain')}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  !isPain ? 'bg-brand text-on-brand shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>مع إنجاز برو</span>
              </button>
            </div>
          </div>

          <div key={compareMode} className="ebms-tab-fade grid grid-cols-1 md:grid-cols-3 gap-5">
            {PAIN_VS_GAIN_DATA[compareMode].map((item) => (
              <Card
                key={item.title}
                className={`rounded-3xl p-6 space-y-3 text-right ${
                  isPain ? 'bg-bad-soft/45 border-bad/25' : 'bg-ok-soft/50 border-ok/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`w-10 h-10 rounded-2xl bg-panel border flex items-center justify-center ${
                      isPain ? 'border-bad/25 text-bad' : 'border-ok/25 text-ok'
                    }`}
                  >
                    {isPain ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                  </span>
                  <Badge tone={isPain ? 'bad' : 'ok'}>{item.tag}</Badge>
                </div>
                <h3 className="text-base sm:text-lg font-black text-ink">{item.title}</h3>
                <p className="text-xs sm:text-sm text-muted leading-relaxed">{item.desc}</p>
              </Card>
            ))}
          </div>

          {/* Solution Bridge Banner */}
          <div className="rounded-3xl p-5 sm:p-6 bg-gradient-to-l from-brand via-primary-700 to-primary-900 text-on-brand flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5 text-center lg:text-right">
              <div className="w-12 h-12 rounded-2xl bg-on-brand/15 backdrop-blur-md flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6 text-on-brand" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black">
                  الحل: كل حاجة في شاشة واحدة — توفير 6 إلى 10 ساعات أسبوعياً
                </div>
                <div className="text-xs sm:text-sm text-primary-100">
                  كل فاتورة بيع، سند صرف شحن أو مورد، إذن تحويل فرع، أو طلب أونلاين يُحدّث المخزون والخزينة والأرباح أوتوماتيك.
                </div>
              </div>
            </div>
            <a
              href="#showcase"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-panel text-brand-ink hover:bg-brand-soft font-black text-xs sm:text-sm inline-flex items-center gap-2 transition-colors shrink-0 shadow-md"
            >
              <span>شوف الشاشات الحقيقية</span>
              <ArrowLeft className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 3: Persona Selector + Modern Bento Grid + ROI Anchor */}
      <section id="bento" data-reveal className="scroll-mt-24 relative z-10 py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          {/* Interactive Target Business Selector */}
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2.5">
              <Badge tone="brand">مفصّل على طبيعة شغلك</Badge>
              <h2 className="text-2xl sm:text-4xl font-black text-ink">
                اختر نوع نشاطك وشوف النظام هيفرق معاك إزاي
              </h2>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2" role="tablist" aria-label="اختر نوع النشاط">
              {MERCHANT_PERSONAS.map((persona, idx) => {
                const Icon = persona.icon;
                const active = idx === activePersonaIdx;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActivePersonaIdx(idx)}
                    className={`min-h-[44px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-black inline-flex items-center gap-2 transition-all cursor-pointer ${
                      active
                        ? 'bg-brand text-on-brand shadow-md'
                        : 'bg-panel text-muted border border-line hover:text-ink hover:bg-surface-2'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{persona.label}</span>
                  </button>
                );
              })}
            </div>

            <Card
              key={currentPersona.id}
              className="ebms-tab-fade p-6 sm:p-7 rounded-3xl bg-panel border-brand/25 shadow-lg"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center text-right">
                <div className="lg:col-span-6 space-y-3">
                  <div className="inline-flex items-center gap-2 text-xs font-black text-brand">
                    <PersonaIcon className="w-4 h-4" />
                    <span>{currentPersona.label}</span>
                  </div>
                  <h3 className="text-lg sm:text-2xl font-black text-ink leading-snug">
                    {currentPersona.headline}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted leading-relaxed">
                    {currentPersona.painSolved}
                  </p>
                </div>

                <div className="lg:col-span-6 space-y-2.5 border-t lg:border-t-0 lg:border-r border-line pt-4 lg:pt-0 lg:pr-6">
                  {currentPersona.highlights.map((pt) => (
                    <div key={pt} className="flex items-start gap-2.5 text-xs sm:text-sm font-bold text-ink">
                      <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Asymmetric Bento Grid */}
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <Badge tone="neutral">مميزات مصممة لسرعة البيع وإحكام الرقابة</Badge>
              <h3 className="text-2xl sm:text-3xl font-black text-ink">
                كل تفصيلة معمولة عشان تحمي شغلك وتوفر وقتك
              </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-right">
              {/* Bento Card 1 (7 Cols): Fast POS + Barcode Laser */}
              <Card className="ebms-bento-card lg:col-span-7 rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-6">
                <div className="space-y-2">
                  <span className="text-xs font-black text-brand">01 · نقطة بيع بدون طوابير</span>
                  <h4 className="text-xl sm:text-2xl font-black text-ink">
                    اقفل فاتورة العميل في 8 ثواني بالباركود والمقاس
                  </h4>
                  <p className="text-xs sm:text-sm text-muted leading-relaxed">
                    قسّم الدفع في نفس الفاتورة بين الكاش وإنستاباي والفيزا، واطبع الإيصال الحراري 58/80mm فوراً بدون لخبطة درج.
                  </p>
                </div>

                <div className="rounded-2xl bg-surface-2/80 border border-line p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div
                    className="relative w-32 h-20 rounded-xl bg-panel border border-line-2 flex items-center justify-center overflow-hidden shrink-0"
                    aria-hidden="true"
                  >
                    <div className="flex items-end gap-1 h-12">
                      <span className="w-1 h-11 bg-ink" />
                      <span className="w-2 h-12 bg-ink" />
                      <span className="w-0.5 h-10 bg-ink" />
                      <span className="w-1.5 h-12 bg-ink" />
                      <span className="w-1 h-9 bg-ink" />
                      <span className="w-2 h-11 bg-ink" />
                      <span className="w-1 h-12 bg-ink" />
                      <span className="w-1.5 h-10 bg-ink" />
                    </div>
                    <div className="ebms-barcode-laser absolute left-2 right-2 h-0.5 bg-bad" />
                  </div>

                  <div className="flex-1 w-full space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-black text-ink">
                      <span>سويت شيرت أوفر سايز · أسود / L</span>
                      <span className="text-brand tabular-nums">750 ج.م</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-2xs font-bold">
                      <span className="px-2.5 py-1 rounded-lg bg-ok-soft text-ok border border-ok/20">
                        كاش 450
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-brand-soft text-brand-ink border border-brand/20">
                        إنستاباي 300
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-panel text-muted border border-line inline-flex items-center gap-1">
                        <Printer className="w-3 h-3" /> طبع فوري
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Bento Card 2 (5 Cols): Owner Profit Privacy */}
              <Card className="ebms-bento-card lg:col-span-5 rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-6 bg-gradient-to-br from-brand-soft via-panel to-panel border-brand/25">
                <div className="space-y-2">
                  <span className="text-xs font-black text-brand">02 · خصوصية الأرباح والتكلفة</span>
                  <h4 className="text-xl font-black text-ink">صافي مكسبك ظاهر ليك لوحدك</h4>
                  <p className="text-xs sm:text-sm text-muted leading-relaxed">
                    الكاشير والمندوب عمرهم ما يشوفوا سعر الشراء أو هامش الربح — بينما إنت تتابع ربح كل فرع لحظياً.
                  </p>
                </div>

                <div className="rounded-2xl bg-panel border border-line p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-muted flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-brand" />
                      هامش الربح الصافي اليوم
                    </span>
                    <Badge tone="ok">33.2%</Badge>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden flex">
                    <div className="bg-brand h-full" style={{ width: '67%' }} />
                    <div className="bg-ok h-full" style={{ width: '33%' }} />
                  </div>
                  <div className="flex justify-between text-2xs font-bold tabular-nums">
                    <span className="text-muted">تكلفة ومصاريف: 12,330 ج</span>
                    <span className="text-ok">صافي ربح: +6,120 ج</span>
                  </div>
                </div>
              </Card>

              {/* Bento Card 3 (5 Cols): Couriers, Vouchers & Shift Custody */}
              <Card className="ebms-bento-card lg:col-span-5 rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-5">
                <div className="space-y-2">
                  <span className="text-xs font-black text-warn flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> 03 · شركات الشحن والمناديب والورديات
                  </span>
                  <h4 className="text-xl font-black text-ink">ولا جنيه يتوه عند شحن أو مورد</h4>
                  <p className="text-xs sm:text-sm text-muted leading-relaxed">
                    أي سند صرف لشركة شحن أو مورد يتخصم لحظياً من درج الكاشير/المندوب ويتطابق مع الـ Z-Report.
                  </p>
                </div>

                <div className="rounded-2xl bg-surface-2/80 border border-line p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-muted">تحصيل أوردر #INV-016</span>
                    <span className="text-ok tabular-nums">+2,900 ج.م</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-muted">سند صرف شحن (كاش)</span>
                    <span className="text-bad tabular-nums">-60 ج.م</span>
                  </div>
                  <div className="pt-2 border-t border-line flex justify-between font-black text-ink">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand" /> صافي الدرج المتوقع
                    </span>
                    <span className="text-brand tabular-nums">2,840 ج.م ✓</span>
                  </div>
                </div>
              </Card>

              {/* Bento Card 4 (7 Cols): Multi-branch & Transfers */}
              <Card className="ebms-bento-card lg:col-span-7 rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-5">
                <div className="space-y-2">
                  <span className="text-xs font-black text-brand flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> 04 · فروع ومخازن محكومة
                  </span>
                  <h4 className="text-xl sm:text-2xl font-black text-ink">
                    تحويلات بضاعة مؤمّنة بالاستلام وتنبيهات نواقص تلقائية
                  </h4>
                  <p className="text-xs sm:text-sm text-muted leading-relaxed">
                    أدِر مخزنك الرئيسي وفروعك ومناديب الفان في نظام واحد؛ لا تُضاف قطعة في فرع إلا بإذن استلام رسمي موثق.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 rounded-2xl bg-surface-2/80 border border-line">
                    <div className="text-xs font-black text-ink">المخزن الرئيسي</div>
                    <div className="text-2xs font-bold text-brand mt-1 tabular-nums">1,420 قطعة</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-brand-soft border border-brand/25 flex flex-col items-center justify-center">
                    <div className="text-xs font-black text-brand-ink">تحويل #TR-41</div>
                    <div className="text-2xs font-bold text-ok mt-0.5">✓ تأكيد استلام</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-surface-2/80 border border-line">
                    <div className="text-xs font-black text-ink">فرع مدينة نصر</div>
                    <div className="text-2xs font-bold text-ok mt-1 tabular-nums flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3" /> +85 قطعة
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <LandingRoiWidget proMonthlyPrice={proMonthlyPrice} />
        </div>
      </section>
    </>
  );
};
