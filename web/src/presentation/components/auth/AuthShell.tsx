import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, MessageCircle, Moon, Sparkles, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils/cn';
import { BrandLogo } from '../common/BrandLogo';

export interface AuthShellProps {
  badgeText: string;
  headline: string;
  accentHeadline: string;
  description: string;
  features: readonly string[];
  showcaseFooter?: React.ReactNode;
  securityNote: string;
  supportHref: string;
  supportLabel: string;
  formTitle: string;
  formSubtitle?: string;
  formHeaderExtra?: React.ReactNode;
  error?: string | null;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const AuthBrandMark: React.FC = () => (
  <Link
    to="/"
    className="inline-flex items-center gap-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand rounded-xl px-1"
  >
    <BrandLogo size="lg" />
  </Link>
);

/** Shared responsive RTL authentication shell with Light/Slate-Dark parity. */
export const AuthShell: React.FC<AuthShellProps> = ({
  badgeText,
  headline,
  accentHeadline,
  description,
  features,
  showcaseFooter,
  securityNote,
  supportHref,
  supportLabel,
  formTitle,
  formSubtitle,
  formHeaderExtra,
  error,
  footer,
  children,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const themeToggleButton = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الداكن'}
      title={isDark ? 'الوضع النهاري' : 'الوضع الداكن'}
      className={cn(
        'min-h-[44px] min-w-[44px] rounded-xl border border-line bg-surface-2/80 text-muted hover:text-ink hover:bg-surface-2',
        'inline-flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer'
      )}
    >
      {isDark ? <Sun className="w-4 h-4 text-warn" /> : <Moon className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink flex relative overflow-hidden" dir="rtl">
      {/* Ambient Brand & Status Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 right-8 w-[42vw] h-[38vw] max-w-[560px] max-h-[480px] rounded-full bg-brand-soft/60 blur-3xl" />
        <div className="absolute bottom-8 left-8 w-[38vw] h-[38vw] max-w-[520px] max-h-[480px] rounded-full bg-ok-soft/50 blur-3xl" />
      </div>

      {/* Right Side: Showcase Panel (Desktop lg+) */}
      <aside className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-10 xl:p-12 bg-panel/85 backdrop-blur-md border-l border-line">
        <div className="flex items-center justify-between gap-4">
          <AuthBrandMark />
          {themeToggleButton}
        </div>

        <div className="space-y-6 max-w-lg my-auto py-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-brand bg-brand-soft border border-brand/25 px-3.5 py-1.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{badgeText}</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-black text-ink leading-snug">
            {headline}
            <br />
            <span className="text-brand">{accentHeadline}</span>
          </h1>

          <p className="text-sm text-muted leading-relaxed">{description}</p>

          <ul className="space-y-3 pt-1">
            {features.map((item) => (
              <li key={item} className="flex items-center gap-3 text-xs font-semibold text-ink">
                <span className="w-5 h-5 rounded-full bg-ok-soft text-ok flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {showcaseFooter}
        </div>

        <div className="flex items-center justify-between gap-4 text-xs text-muted pt-4 border-t border-line">
          <span>{securityNote}</span>
          <a
            href={supportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] inline-flex items-center gap-1.5 text-brand hover:opacity-80 font-bold px-1"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>{supportLabel}</span>
          </a>
        </div>
      </aside>

      {/* Left Side: Form Column */}
      <main className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative z-10">
        <div className="max-w-md w-full bg-panel border border-line rounded-3xl p-6 sm:p-9 shadow-xl space-y-6">
          {/* Mobile Brand & Theme Header */}
          <div className="lg:hidden space-y-2 pb-3 border-b border-line">
            <div className="flex items-center justify-between gap-2">
              <AuthBrandMark />
              {themeToggleButton}
            </div>
            <p className="text-xs text-muted font-medium">
              منظومة إدارة المبيعات، الفروع، والمخازن
            </p>
          </div>

          {/* Form Header */}
          <div className="space-y-2 text-center sm:text-right">
            <h2 className="text-xl sm:text-2xl font-black text-ink">{formTitle}</h2>
            {formSubtitle && <p className="text-xs text-muted leading-relaxed">{formSubtitle}</p>}
            {formHeaderExtra}
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-3.5 bg-bad-soft border border-bad/30 text-bad text-xs font-bold rounded-2xl flex items-center gap-2.5"
            >
              <span className="w-2 h-2 rounded-full bg-bad shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {children}

          {footer}
        </div>
      </main>
    </div>
  );
};
