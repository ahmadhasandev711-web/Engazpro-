import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../data/store/useAuthStore';
import { usePageMeta } from '../../hooks/usePageMeta';
import { usePublicPricing } from '../../hooks/usePublicPricing';
import { useLandingScrollMetrics, useScrollRevealObserver } from '../../hooks/useScrollReveal';
import { useTheme } from '../context/ThemeContext';
import { LandingComparisonAndPillars } from '../components/landing/LandingComparisonAndPillars';
import { LandingHeroStage } from '../components/landing/LandingHeroStage';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { LandingPricingAndFaq } from '../components/landing/LandingPricingAndFaq';
import { StoreDesignSection } from '../components/landing/StoreDesignSection';
import { StoreInquiryModal } from '../components/landing/StoreInquiryModal';
import { SystemScreenshotShowcase } from '../components/landing/SystemScreenshotShowcase';
import { BRAND_IDENTITY } from '../components/landing/landingContent';

const SALES_WHATSAPP = import.meta.env.VITE_SALES_WHATSAPP || '201125030642';

/**
 * Light-only public landing page V2 orchestrating interactive 3D hero, pain-to-gain transformation,
 * business persona matcher, live Bento grid, ROI calculator, real screenshots showcase,
 * dark Shopify/WP integration + custom store hub, dynamic pricing, FAQ, and mobile sticky CTA.
 */
export const LandingPage: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { resolvedTheme } = useTheme();
  const { data: pricing } = usePublicPricing();
  const [inquiryOpen, setInquiryOpen] = useState(false);

  const { progress, showStickyMobileCta } = useLandingScrollMetrics();
  useScrollRevealObserver();

  usePageMeta({
    title: `${BRAND_IDENTITY.shortName} (${BRAND_IDENTITY.acronym}) — محلك ومتجرك في شاشة واحدة | كاشير ومخازن وShopify وWordPress`,
    description:
      'نظام إنجاز لإدارة الأعمال (EBMS): كاشير سريع، مخازن وفروع بمقاسات وألوان، عهد مناديب وشركات شحن، تقفيل ورديات بالقرش، ومزامنة لحظية مع Shopify و WordPress. جرّب 14 يوم مجاناً.',
  });

  // Enforce bright Light-Only theme on the public landing page while preserving internal app preference.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    return () => {
      if (resolvedTheme === 'dark') {
        root.classList.add('dark');
      }
    };
  }, [resolvedTheme]);

  const handleOpenWhatsApp = (text: string) => {
    window.open(
      `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-canvas text-ink font-sans overflow-x-clip relative selection:bg-brand-soft selection:text-brand-ink"
    >
      {/* Subtle Light Ambient Background Accents */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-40 right-[15%] w-[640px] h-[640px] rounded-full bg-brand-soft/65 blur-3xl" />
        <div className="absolute top-[42%] -left-32 w-[480px] h-[480px] rounded-full bg-ok-soft/45 blur-3xl" />
      </div>

      <LandingNavbar
        isAuthenticated={isAuthenticated}
        trialDays={pricing.trial_days}
        scrollProgress={progress}
      />

      <main>
        <LandingHeroStage trialDays={pricing.trial_days} onWhatsApp={handleOpenWhatsApp} />
        <LandingComparisonAndPillars proMonthlyPrice={pricing.pro.monthly_price} />
        <SystemScreenshotShowcase />
        <StoreDesignSection
          onOpenInquiry={() => setInquiryOpen(true)}
          onWhatsApp={handleOpenWhatsApp}
        />
        <LandingPricingAndFaq pricing={pricing} onWhatsApp={handleOpenWhatsApp} />
      </main>

      {/* Mobile Sticky Conversion Bar */}
      {!isAuthenticated && showStickyMobileCta && (
        <div className="md:hidden fixed bottom-3 inset-x-3 z-40 pb-safe">
          <div className="rounded-2xl bg-panel/95 backdrop-blur-xl border border-brand/25 shadow-2xl p-2 flex items-center gap-2">
            <Link
              to="/register"
              className="ebms-btn-shimmer flex-1 min-h-[44px] px-4 rounded-xl bg-brand text-on-brand text-xs font-black inline-flex items-center justify-center gap-1.5 shadow-md"
            >
              <span>ابدأ {pricing.trial_days} يوم مجاناً</span>
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            </Link>
            <button
              type="button"
              aria-label="تواصل عبر واتساب"
              onClick={() =>
                handleOpenWhatsApp(
                  `مرحباً فريق إنجاز برو (${BRAND_IDENTITY.acronym})، أرغب في تجربة النظام والبدء فوراً.`
                )
              }
              className="min-h-[44px] min-w-[44px] rounded-xl bg-ok-soft border border-ok/25 text-ok flex items-center justify-center shrink-0 cursor-pointer"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <StoreInquiryModal isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} />
    </div>
  );
};

export default LandingPage;
