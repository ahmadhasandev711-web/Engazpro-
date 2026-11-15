import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Menu, Moon, Sun, X, Zap } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Badge, Button } from '../ui';

interface LandingNavbarProps {
  isAuthenticated: boolean;
  trialDays: number;
}

const NAV_LINKS = [
  { href: '#simulator', label: 'محاكي النظام' },
  { href: '#compare', label: 'لماذا إنجاز برو؟' },
  { href: '#pillars', label: 'أركان المنظومة' },
  { href: '#integrations', label: 'التكاملات' },
  { href: '#pricing', label: 'الأسعار' },
  { href: '#faq', label: 'الأسئلة' },
] as const;

/** Sticky glass capsule navbar for the public landing page with Dark/Light mode toggle. */
export const LandingNavbar: React.FC<LandingNavbarProps> = ({ isAuthenticated, trialDays }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="sticky top-3 z-40 max-w-6xl mx-auto px-4 sm:px-6 pt-3">
      <header className="rounded-full bg-panel/90 backdrop-blur-md border border-line px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shadow-lg">
        {/* Brand Wordmark (LTR isolated so Engaz.PRO never reverses in RTL) */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-brand text-on-brand flex items-center justify-center shadow-xs">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-1.5 font-black text-lg sm:text-xl tracking-tight text-ink" dir="ltr">
            <span>Engaz</span>
            <Badge tone="brand">PRO</Badge>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav aria-label="التنقل الرئيسي" className="hidden lg:flex items-center gap-1 text-xs font-bold text-muted">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-full hover:text-ink hover:bg-surface-2 transition-colors whitespace-nowrap"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#custom-store"
            className="px-3 py-1.5 rounded-full bg-brand-soft text-brand-ink border border-brand/20 font-black hover:bg-brand hover:text-on-brand transition-colors whitespace-nowrap"
          >
            تصميم المتاجر 🛍️
          </a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
            className="min-h-[44px] min-w-[44px] rounded-full px-2.5"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-warn" /> : <Moon className="w-4 h-4" />}
          </Button>

          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="hidden sm:inline-flex min-h-[44px] px-5 rounded-full bg-brand text-on-brand text-xs sm:text-sm font-black items-center gap-1.5 hover:bg-brand-ink transition-colors shadow-sm whitespace-nowrap"
            >
              <span>لوحة التحكم</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden sm:inline-flex min-h-[44px] items-center px-3 text-xs sm:text-sm font-bold text-ink hover:text-brand transition-colors whitespace-nowrap"
              >
                تسجيل الدخول
              </Link>
              <Link
                to="/register"
                className="hidden sm:inline-flex min-h-[44px] px-4 sm:px-5 rounded-full bg-brand text-on-brand text-xs sm:text-sm font-black items-center gap-1.5 hover:bg-brand-ink transition-colors shadow-sm whitespace-nowrap"
              >
                <span>جرّب {trialDays} يوم مجاناً</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={isMobileMenuOpen}
            className="lg:hidden min-h-[44px] min-w-[44px] rounded-full bg-surface-2 border border-line flex items-center justify-center text-ink"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
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
            تصميم المتاجر الإلكترونية 🛍️
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
