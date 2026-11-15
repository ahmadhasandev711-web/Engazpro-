import React, { useState } from 'react';
import { useAuthStore } from '../../data/store/useAuthStore';
import { usePageMeta } from '../../hooks/usePageMeta';
import { usePublicPricing } from '../../hooks/usePublicPricing';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { LandingHeroStage } from '../components/landing/LandingHeroStage';
import { LandingComparisonAndPillars } from '../components/landing/LandingComparisonAndPillars';
import { StoreDesignSection } from '../components/landing/StoreDesignSection';
import { LandingPricingAndFaq } from '../components/landing/LandingPricingAndFaq';
import { StoreInquiryModal } from '../components/landing/StoreInquiryModal';

const SALES_WHATSAPP = import.meta.env.VITE_SALES_WHATSAPP || '201125030642';

/**
 * EngazPRO public landing page built strictly on semantic EngazPRO tokens (Light + Slate Dark).
 */
export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { data: pricing } = usePublicPricing();
  const [isStoreInquiryModalOpen, setIsStoreInquiryModalOpen] = useState(false);

  usePageMeta({
    title: 'إنجاز برو — Engaz PRO | نظام نقاط البيع POS والمخازن والمناديب وربط ووكومرس',
    description:
      'منظومة إنجاز برو السحابية لإدارة نقاط البيع POS والمحلات والفروع والمخازن وعهد المناديب وتقفيل الورديات (Z-Report) مع مزامنة لحظية لمتجر WooCommerce.',
  });

  const handleWhatsApp = (text: string) => {
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
      {/* Subtle Ambient Aura using semantic Brand & Ok tokens */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-28 -right-24 w-96 h-96 rounded-full bg-brand-soft opacity-50 blur-3xl" />
        <div className="absolute top-1/3 -left-24 w-80 h-80 rounded-full bg-ok-soft opacity-40 blur-3xl" />
      </div>

      <LandingNavbar isAuthenticated={isAuthenticated} trialDays={pricing.trial_days} />

      <main>
        <LandingHeroStage trialDays={pricing.trial_days} onWhatsApp={handleWhatsApp} />

        <LandingComparisonAndPillars />

        <StoreDesignSection
          onOpenInquiryModal={() => setIsStoreInquiryModalOpen(true)}
          onWhatsApp={handleWhatsApp}
        />

        <LandingPricingAndFaq pricing={pricing} onWhatsApp={handleWhatsApp} />
      </main>

      <StoreInquiryModal
        isOpen={isStoreInquiryModalOpen}
        onClose={() => setIsStoreInquiryModalOpen(false)}
      />
    </div>
  );
};
