import React from 'react';
import { ArrowLeft, CheckCircle2, Globe, MessageCircle, Sparkles } from 'lucide-react';
import { HARDWARE_BADGES, STORE_CUSTOM_FEATURES } from './landingContent';

interface StoreDesignSectionProps {
  onOpenInquiry: () => void;
  onWhatsApp: (text: string) => void;
}

/**
 * Dark-brand luxury integration hub combining live bidirectional Shopify & WordPress sync
 * with our integrated custom-store design service and hardware readiness strip.
 */
export const StoreDesignSection: React.FC<StoreDesignSectionProps> = ({
  onOpenInquiry,
  onWhatsApp,
}) => {
  return (
    <section
      id="integrations"
      data-reveal
      className="scroll-mt-24 relative z-10 py-14 sm:py-20 px-4 sm:px-6"
    >
      <div className="max-w-6xl mx-auto rounded-3xl sm:rounded-[2.25rem] bg-primary-950 ebms-dark-grid text-on-brand p-6 sm:p-11 relative overflow-hidden shadow-2xl border border-brand/40">
        {/* Ambient Spotlights */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[260px] rounded-full bg-brand/35 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-8 w-[340px] h-[240px] rounded-full bg-ok/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 space-y-10">
          {/* Top Half: Bidirectional Shopify + WordPress Animated Diagram */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4 text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/35 border border-primary-300/30 text-primary-100 text-xs font-bold">
                <Globe className="w-3.5 h-3.5" />
                <span>تكامل حي ثنائي الاتجاه</span>
              </span>

              <h2 className="text-2xl sm:text-4xl font-black leading-tight">
                متجرك على <span className="text-primary-300">Shopify</span> أو{' '}
                <span className="text-ok">WordPress</span> شغال بروح واحدة مع محلك
              </h2>

              <p className="text-xs sm:text-sm text-primary-100/85 leading-relaxed">
                أول ما يوصل أوردر أونلاين، يُحجز المقاس واللون من فرعك فوراً، وتظهر الفاتورة عند الكاشير جاهزة للتسليم لشركة الشحن — بدون بيع مزدوج أو جرد يدوي.
              </p>

              <ul className="space-y-2.5 pt-1 text-xs sm:text-sm font-bold text-on-brand/95">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                  <span>استيراد تلقائي للطلبات والعملاء وتفاصيل الشحن</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                  <span>تحديث كميات المخزون والمقاسات لحظياً في الاتجاهين</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                  <span>تقارير مبيعات وأرباح مجمعة للأونلاين والأوفلاين</span>
                </li>
              </ul>
            </div>

            {/* Animated SVG Sync Pipeline */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl bg-on-brand/5 backdrop-blur-md border border-on-brand/15 p-5 sm:p-7">
                <div className="grid grid-cols-11 items-center gap-2">
                  {/* Source Storefronts (Right in RTL) */}
                  <div className="col-span-4 space-y-3.5 text-right">
                    <div className="p-3 sm:p-3.5 rounded-2xl bg-on-brand/10 border border-on-brand/15 flex items-center gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-ok/25 border border-ok/40 text-ok flex items-center justify-center font-black text-base shrink-0">
                        S
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-black truncate">Shopify</div>
                        <div className="text-2xs text-primary-200 truncate">مزامنة حية</div>
                      </div>
                    </div>

                    <div className="p-3 sm:p-3.5 rounded-2xl bg-on-brand/10 border border-on-brand/15 flex items-center gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand/40 border border-primary-300/40 text-primary-100 flex items-center justify-center font-black text-base shrink-0">
                        W
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-black truncate">WordPress</div>
                        <div className="text-2xs text-primary-200 truncate">WooCommerce</div>
                      </div>
                    </div>
                  </div>

                  {/* Animated Light Beams */}
                  <div className="col-span-3 flex items-center justify-center" aria-hidden="true">
                    <svg viewBox="0 0 120 120" className="w-full h-24 sm:h-28 overflow-visible">
                      <path
                        d="M115 28 C70 28, 60 60, 8 60"
                        fill="none"
                        className="stroke-primary-300/30"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M115 28 C70 28, 60 60, 8 60"
                        fill="none"
                        className="stroke-ok ebms-beam-flow"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M115 92 C70 92, 60 60, 8 60"
                        fill="none"
                        className="stroke-primary-300/30"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M115 92 C70 92, 60 60, 8 60"
                        fill="none"
                        className="stroke-primary-300 ebms-beam-flow-slow"
                        strokeWidth="2.5"
                      />
                      <circle cx="8" cy="60" r="5" className="fill-primary-300" />
                    </svg>
                  </div>

                  {/* Central EBMS Core */}
                  <div className="col-span-4">
                    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-brand to-primary-800 border border-primary-300/40 text-center space-y-2 shadow-xl">
                      <div className="w-10 h-10 rounded-2xl bg-on-brand/15 mx-auto flex items-center justify-center font-black text-base">
                        EB
                      </div>
                      <div className="text-xs sm:text-sm font-black">إنجاز برو EBMS</div>
                      <div className="text-2xs text-primary-100 leading-snug">
                        كاشير + مخازن + فروع + شحن
                      </div>
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-ok/25 border border-ok/40 text-on-brand text-2xs font-bold">
                        مخزون موحد 100%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Half: Merged Custom Store Design Banner (#custom-store anchor preserved) */}
          <div
            id="custom-store"
            className="scroll-mt-24 rounded-3xl bg-on-brand/5 backdrop-blur-md border border-on-brand/15 p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
          >
            <div className="lg:col-span-7 space-y-4 text-right">
              <div className="inline-flex items-center gap-2 text-2xs sm:text-xs font-black text-primary-100">
                <span className="px-2.5 py-0.5 rounded-full bg-brand text-on-brand inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> خدمة تصميم المتاجر
                </span>
                <span>بناء كامل من الصفر + ربط فوري بمخازنك</span>
              </div>

              <h3 className="text-lg sm:text-2xl font-black text-on-brand leading-snug">
                معندكش متجر لسه؟ بنصمملك متجر Shopify أو WordPress ونربطه بالكاشير فوراً
              </h3>

              <ul className="space-y-2 text-xs sm:text-sm text-primary-100/90 font-semibold">
                {STORE_CUSTOM_FEATURES.map((feat) => (
                  <li key={feat} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onOpenInquiry}
                  className="min-h-[46px] px-5 py-3 rounded-2xl bg-panel text-brand-ink hover:bg-brand-soft font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
                >
                  <span>اطلب تصميم متجرك الآن</span>
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onWhatsApp(
                      'مرحباً، أرغب في الحصول على عرض سعر لتصميم متجر إلكتروني (WordPress أو Shopify) مربوط بنظام إنجاز برو EBMS.'
                    )
                  }
                  className="min-h-[46px] px-5 py-3 rounded-2xl bg-on-brand/10 hover:bg-on-brand/15 border border-on-brand/20 text-on-brand font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-ok shrink-0" />
                  <span>استشارة وعرض سعر واتساب</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl overflow-hidden border border-on-brand/15 bg-panel shadow-xl">
                <div className="bg-surface-2 border-b border-line px-3 py-2 flex items-center justify-between text-2xs font-bold text-ink">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-brand" />
                    شاشة طلبات المتجر داخل EBMS
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-ok-soft text-ok font-black">
                    مزامنة حية
                  </span>
                </div>
                <img
                  src="/screenshots/store-orders.webp"
                  alt="لقطة حقيقية لشاشة استلام وإدارة طلبات متاجر WordPress و Shopify داخل إنجاز برو"
                  loading="lazy"
                  className="w-full h-auto block"
                />
              </div>
            </div>
          </div>

          {/* Hardware Readiness Compact Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {HARDWARE_BADGES.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="px-3.5 py-3 rounded-2xl bg-on-brand/5 border border-on-brand/10 flex items-center gap-2.5 text-xs font-bold text-primary-100"
                >
                  <Icon className="w-4 h-4 text-primary-300 shrink-0" />
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
