import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { BRAND_IDENTITY } from './landingContent';

interface LandingNavbarProps {
  isAuthenticated: boolean;
  trialDays: number;
}

const NAV_LINKS = [
  { href: '#showcase', label: 'صور النظام' },
  { href: '#compare', label: 'لماذا إنجاز؟' },
  { href: '#pillars', label: 'المميزات' },
  { href: '#pricing', label: 'الأسعار' },
  { href: '#faq', label: 'الأسئلة' },
] as const;

/**
 * Light-only sticky top navigation bar featuring EBMS brand identity and conversion CTAs.
 */
export const LandingNavbar: React.FC<LandingNavbarProps> = ({ isAuthenticated, trialDays }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="sticky top-0 z-40 px-3 sm:px-6 pt-3">
      <header className="max-w-6xl mx-auto rounded-2xl bg-panel/95 backdrop-blur-md border border-line shadow-sm px-4 sm:px-5 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <BrandLogo size="md" showArabic={false} />
          <div className="hidden sm:flex flex-col leading-tight border-r border-line pr-2.5">
            <span className="text-xs font-black text-ink">{BRAND_IDENTITY.arabicFull}</span>
            <span className="text-2xs font-mono font-bold text-brand tracking-wide">
              {BRAND_IDENTITY.acronym}
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 text-xs font-bold text-muted" aria-label="روابط الصفحة">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-xl hover:text-ink hover:bg-surface-2 transition-colors whitespace-nowrap"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#custom-store"
            className="px-3 py-2 rounded-xl bg-brand-soft text-brand-ink hover:bg-brand/15 transition-colors font-black whitespace-nowrap"
          >
            تصميم المتاجر
          </a>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="min-h-[40px] px-4 rounded-xl bg-brand text-on-brand text-xs sm:text-sm font-black inline-flex items-center gap-2 shadow-sm hover:opacity-95 transition-opacity"
            >
              <span>لوحة التحكم</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden sm:inline-flex min-h-[40px] px-3.5 rounded-xl border border-line bg-surface-2 hover:bg-panel text-xs font-bold text-ink items-center transition-colors"
              >
                دخول
              </Link>
              <Link
                to="/register"
                className="min-h-[40px] px-4 rounded-xl bg-brand text-on-brand text-xs sm:text-sm font-black inline-flex items-center gap-2 shadow-sm hover:opacity-95 transition-opacity whitespace-nowrap"
              >
                <span>جرّب {trialDays} يوم مجاناً</span>
                <ArrowLeft className="w-4 h-4 hidden sm:block" />
              </Link>
            </>
          )}

          <button
            type="button"
            aria-label={isMobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            className="lg:hidden min-h-[40px] min-w-[40px] rounded-xl border border-line bg-surface-2 text-ink flex items-center justify-center cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="lg:hidden mt-2 rounded-3xl bg-panel border border-line p-4 shadow-xl space-y-1.5">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="min-h-[44px] flex items-center px-4 rounded-xl text-sm font-bold text-ink hover:bg-surface-2 transition-colors"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#custom-store"
            onClick={() => setIsMobileMenuOpen(false)}
            className="min-h-[44px] flex items-center px-4 rounded-xl text-sm font-black bg-brand-soft text-brand-ink"
          >
            تصميم متجر Shopify أو WordPress
          </a>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-brand text-on-brand text-sm font-black mt-2"
            >
              <span>لوحة التحكم</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="min-h-[44px] flex items-center justify-center rounded-xl border border-line bg-surface-2 text-sm font-bold text-ink"
              >
                تسجيل الدخول
              </Link>
              <Link
                to="/register"
                onClick={() => setIsMobileMenuOpen(false)}
                className="min-h-[44px] flex items-center justify-center rounded-xl bg-brand text-on-brand text-sm font-black"
              >
                جرّب {trialDays} يوم مجاناً
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
