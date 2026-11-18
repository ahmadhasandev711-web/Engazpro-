import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card } from '../ui';
import { BRAND_IDENTITY, HERO_CAPABILITIES } from './landingContent';
import { SystemScreenshotShowcase } from './SystemScreenshotShowcase';

interface LandingHeroStageProps {
  trialDays: number;
  onWhatsApp: (text: string) => void;
}

const TRUST_KPI_STRIP = [
  { value: '100%', label: 'تقفيل دقيق للدرج والورديات' },
  { value: 'Shopify + WP', label: 'ربط مباشر للمتاجر الإلكترونية' },
  { value: 'مقاسات وألوان', label: 'متابعة دقيقة للملابس والأحذية' },
  { value: 'COD + محافظ', label: 'مناديب الشحن وإنستاباي وفيزا' },
] as const;

/**
 * Light hero section introducing EBMS (Engaz Business Management System) and real interactive screenshots.
 */
export const LandingHeroStage: React.FC<LandingHeroStageProps> = ({ trialDays, onWhatsApp }) => {
  return (
    <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-12 text-center">
      <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full bg-panel border border-line text-xs font-bold text-ink mb-6 shadow-xs">
        <ShieldCheck className="w-4 h-4 text-ok shrink-0" />
        <span className="font-mono font-black text-brand">{BRAND_IDENTITY.acronym}</span>
        <span className="text-muted">•</span>
        <span>{BRAND_IDENTITY.englishFull}</span>
        <Badge tone="ok">{BRAND_IDENTITY.arabicFull}</Badge>
      </div>

      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-ink leading-[1.16] max-w-4xl mx-auto mb-5">
        كاشير ومخازن وفروع محلك..
        <span className="block mt-2 text-brand">ومبيعات Shopify و WordPress في شاشة واحدة</span>
      </h1>

      <p className="text-sm sm:text-lg text-muted max-w-3xl mx-auto leading-relaxed mb-8">
        منظومة <strong className="text-ink">{BRAND_IDENTITY.arabicFull} ({BRAND_IDENTITY.acronym})</strong> مصممة لتجار التجزئة، الملابس والأحذية، وشركات الأونلاين: تمنع عجز الكاشير، تتابع عهد المناديب وشركات الشحن، وتحسب صافي ربحك الحقيقي لحظة بلحظة.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
        <Link to="/register" className="w-full sm:w-auto">
          <Button
            variant="primary"
            size="lg"
            className="w-full sm:w-auto shadow-md"
            rightIcon={<ArrowLeft className="w-4 h-4 shrink-0" />}
          >
            ابدأ تجربتك المجانية ({trialDays} يوم)
          </Button>
        </Link>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full sm:w-auto"
          leftIcon={<MessageCircle className="w-4 h-4 text-ok shrink-0" />}
          onClick={() =>
            onWhatsApp(
              `مرحباً فريق إنجاز برو (${BRAND_IDENTITY.acronym})، أرغب في تجربة النظام ومعرفة التفاصيل المناسبة لنشاطي.`
            )
          }
        >
          تواصل معنا عبر واتساب
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted mb-10">
        {HERO_CAPABILITIES.map((cap) => (
          <span key={cap} className="inline-flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-ok shrink-0" />
            {cap}
          </span>
        ))}
      </div>

      <SystemScreenshotShowcase />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 max-w-5xl mx-auto mt-10 text-right">
        {TRUST_KPI_STRIP.map((kpi) => (
          <Card key={kpi.label} className="p-4 sm:p-5">
            <div className="text-lg sm:text-xl font-black text-brand tabular-nums" dir="ltr">
              {kpi.value}
            </div>
            <div className="text-xs font-bold text-ink mt-1">{kpi.label}</div>
          </Card>
        ))}
      </div>
    </section>
  );
};
