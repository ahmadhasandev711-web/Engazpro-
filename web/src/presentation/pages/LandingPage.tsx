import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../data/store/useAuthStore';
import { useTheme } from '../context/ThemeContext';
import { usePageMeta } from '../../hooks/usePageMeta';
import { usePublicPricing } from '../../hooks/usePublicPricing';
import { LandingComparisonAndPillars } from '../components/landing/LandingComparisonAndPillars';
import { LandingHeroStage } from '../components/landing/LandingHeroStage';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { LandingPricingAndFaq } from '../components/landing/LandingPricingAndFaq';
import { StoreDesignSection } from '../components/landing/StoreDesignSection';
import { StoreInquiryModal } from '../components/landing/StoreInquiryModal';
import { BRAND_IDENTITY } from '../components/landing/landingContent';

const SALES_WHATSAPP = import.meta.env.VITE_SALES_WHATSAPP || '201125030642';

/**
 * Light-only public landing page orchestrating navigation, hero showcase, value proof,
 * custom WordPress/Shopify store design, single-source dynamic pricing, FAQ, and inquiry modal.
 */
export const LandingPage: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { resolvedTheme } = useTheme();
  const { data: pricing } = usePublicPricing();
  const [inquiryOpen, setInquiryOpen] = useState(false);

  usePageMeta({
    title: `${BRAND_IDENTITY.shortName} (${BRAND_IDENTITY.acronym}) — ${BRAND_IDENTITY.arabicFull} | كاشير ومخازن ومتاجر Shopify و WordPress`,
    description:
      'نظام إنجاز لإدارة الأعمال (EBMS - Engaz Business Management System): كاشير POS، مخازن وفروع، عهد مناديب وشركات شحن، تقفيل ورديات، وربط مباشر مع Shopify و WordPress. جرّب 14 يوم مجاناً.',
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
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 right-[15%] w-[640px] h-[640px] rounded-full bg-brand-soft/60 blur-3xl" />
        <div className="absolute top-[42%] -left-32 w-[480px] h-[480px] rounded-full bg-ok-soft/45 blur-3xl" />
      </div>

      <LandingNavbar isAuthenticated={isAuthenticated} trialDays={pricing.trial_days} />

      <main>
        <LandingHeroStage trialDays={pricing.trial_days} onWhatsApp={handleOpenWhatsApp} />
        <LandingComparisonAndPillars />
        <StoreDesignSection
          onOpenInquiry={() => setInquiryOpen(true)}
          onWhatsApp={handleOpenWhatsApp}
        />
        <LandingPricingAndFaq pricing={pricing} onWhatsApp={handleOpenWhatsApp} />
      </main>

      <StoreInquiryModal isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} />
    </div>
  );
};

export default LandingPage;
