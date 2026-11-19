import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Maximize2,
  MessageCircle,
  Play,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import {
  BRAND_IDENTITY,
  HERO_PROOF_STRIP,
  HERO_QUICK_SCREENS,
  HERO_TRUST_PILLS,
} from './landingContent';

interface LandingHeroStageProps {
  trialDays: number;
  onWhatsApp: (text: string) => void;
}

const PROOF_TONE_STYLES = {
  brand: 'bg-brand-soft text-brand border-brand/20',
  ok: 'bg-ok-soft text-ok border-ok/20',
  warn: 'bg-warn-soft text-warn border-warn/20',
  info: 'bg-info-soft text-info border-info/20',
} as const;

/**
 * Two-column RTL conversion Hero with shimmer CTA, real 3D interactive EBMS screenshots,
 * floating live-operation badges, and bottom operational proof bar.
 */
export const LandingHeroStage: React.FC<LandingHeroStageProps> = ({ trialDays, onWhatsApp }) => {
  const [quickIdx, setQuickIdx] = useState(0);
  const currentQuick = HERO_QUICK_SCREENS[quickIdx];

  return (
    <section className="relative z-10 ebms-dot-grid pt-8 sm:pt-14 pb-12 sm:pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Right Column: Conversion Hook & CTAs */}
          <div className="lg:col-span-6 space-y-6 text-right">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-panel border border-brand/25 shadow-xs text-xs font-bold text-brand-ink">
              <span className="relative flex h-2.5 w-2.5 text-ok ebms-pulse-ring">
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ok" />
              </span>
              <span>مصمم لتجار المحلات، الملابس، ومتاجر الأونلاين</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-black text-ink leading-[1.14] tracking-tight">
              محلك ومتجرك
              <span className="block ebms-text-gradient mt-1.5">
                في شاشة واحدة.. بدون جنيه يضيع.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-muted leading-relaxed max-w-xl">
              كاشير سريع، مخزون متزامن لحظياً مع{' '}
              <strong className="text-ink">Shopify و WordPress</strong>، تقفيل وردية بالقرش، وحسابات شركات الشحن والمناديب — منظومة <strong className="text-ink">{BRAND_IDENTITY.arabicFull} ({BRAND_IDENTITY.acronym})</strong> بدل الإكسيل والواتساب.
            </p>

            {/* Primary & Secondary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <Link
                to="/register"
                className="ebms-btn-shimmer min-h-[52px] px-6 py-3.5 rounded-2xl bg-brand text-on-brand text-sm sm:text-base font-black inline-flex items-center justify-center gap-2 shadow-lg"
              >
                <span>ابدأ تجربتك المجانية ({trialDays} يوم)</span>
                <ArrowLeft className="w-4 h-4 shrink-0" />
              </Link>

              <a
                href="#showcase"
                className="min-h-[52px] px-5 py-3.5 rounded-2xl bg-panel hover:bg-brand-soft border border-line-2 hover:border-brand/40 text-ink text-sm font-black inline-flex items-center justify-center gap-2.5 shadow-xs transition-all"
              >
                <span className="w-6 h-6 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <Play className="w-3 h-3 fill-current" />
                </span>
                <span>شوف النظام شغال</span>
              </a>
            </div>

            {/* 3 High-Signal Trust Reassurances + Direct WhatsApp link */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-3 gap-2 max-w-lg">
                {HERO_TRUST_PILLS.map((pill) => (
                  <div key={pill} className="flex items-center gap-1.5 text-2xs sm:text-xs font-bold text-ink">
                    <span className="w-5 h-5 rounded-full bg-ok-soft text-ok border border-ok/20 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span className="truncate">{pill}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  onWhatsApp(
                    `مرحباً فريق إنجاز برو (${BRAND_IDENTITY.acronym})، أرغب في تجربة النظام ومعرفة الباقة المناسبة لنشاطي.`
                  )
                }
                className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ok transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 text-ok shrink-0" />
                <span>هل لديك سؤال سريع؟ تواصل معنا مباشرة عبر واتساب</span>
              </button>
            </div>
          </div>

          {/* Left Column: Real Screenshots Inside 3D Floating Frame */}
          <div className="lg:col-span-6 relative pt-4 lg:pt-0">
            <div
              className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-brand/15 blur-2xl"
              aria-hidden="true"
            />

            <div className="ebms-hero-stage relative rounded-3xl bg-panel border border-line shadow-2xl overflow-hidden">
              {/* Top Browser Chrome + Quick Screen Tabs */}
              <div className="bg-surface-2/85 border-b border-line px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-bad/75" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warn/75" />
                  <span className="w-2.5 h-2.5 rounded-full bg-ok/75" />
                  <span className="text-2xs font-mono text-muted mr-1.5 hidden sm:inline">
                    ebms.online
                  </span>
                </div>

                <div className="flex items-center gap-1" role="tablist" aria-label="معاينة سريعة للنظام">
                  {HERO_QUICK_SCREENS.map((item, idx) => {
                    const active = idx === quickIdx;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setQuickIdx(idx)}
                        className={`px-2.5 py-1 rounded-lg text-2xs font-black transition-all cursor-pointer ${
                          active
                            ? 'bg-brand text-on-brand shadow-xs'
                            : 'bg-panel text-muted border border-line hover:text-ink'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Real Screenshot Canvas */}
              <div className="relative bg-canvas p-2.5 sm:p-3">
                <img
                  key={currentQuick.id}
                  src={currentQuick.image}
                  alt={currentQuick.alt}
                  loading="eager"
                  className="ebms-tab-fade w-full h-auto max-h-[340px] object-contain object-top rounded-2xl border border-line bg-panel block mx-auto"
                />
                <a
                  href="#showcase"
                  className="absolute bottom-5 left-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-panel/95 backdrop-blur-md border border-line text-2xs font-black text-ink shadow-md hover:bg-brand hover:text-on-brand hover:border-brand transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>عرض الشاشات الـ 5 بالحجم الكامل</span>
                </a>
              </div>
            </div>

            {/* Floating Live Event Pill 1 (Top Right) */}
            <div className="ebms-float-1 hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-panel/95 backdrop-blur-md border border-ok/30 shadow-xl absolute -top-4 -right-3 z-20">
              <div className="w-8 h-8 rounded-xl bg-ok-soft text-ok flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="leading-tight text-right">
                <div className="text-2xs font-black text-ink">طلب Shopify جديد (1042)</div>
                <div className="text-2xs font-bold text-ok">حجز مقاس L من الفرع تلقائياً ✓</div>
              </div>
            </div>

            {/* Floating Live Event Pill 2 (Bottom Left) */}
            <div className="ebms-float-2 hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-primary-950 text-on-brand border border-brand/50 shadow-xl absolute -bottom-4 -left-3 z-20">
              <div className="w-8 h-8 rounded-xl bg-brand text-on-brand flex items-center justify-center font-black text-xs shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="leading-tight text-right">
                <div className="text-2xs font-black text-on-brand">تقفيل وردية الكاشير (Z-Report)</div>
                <div className="text-2xs font-bold text-primary-200">العجز / الزيادة: 0.00 ج.م ✓</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom 4-Item Operational Proof Strip */}
        <div className="mt-12 sm:mt-14 pt-6 border-t border-line grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {HERO_PROOF_STRIP.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-panel/90 border border-line shadow-2xs"
              >
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${PROOF_TONE_STYLES[item.tone]}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-xs font-black text-ink truncate">{item.title}</div>
                  <div className="text-2xs text-muted truncate mt-0.5">{item.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
