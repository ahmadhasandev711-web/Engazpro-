import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Maximize2, X } from 'lucide-react';
import { Badge, Button } from '../ui';
import { SHOWCASE_SCREENS } from './landingContent';

/**
 * Dedicated real-screenshot interactive showcase displaying authentic EBMS screens
 * with category tabs, operational highlights, and a full-resolution lightbox modal.
 */
export const SystemScreenshotShowcase: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  const activeScreen = SHOWCASE_SCREENS[activeIndex];

  useEffect(() => {
    if (!zoomed) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomed]);

  return (
    <section
      id="showcase"
      data-reveal
      className="scroll-mt-24 relative z-10 py-14 sm:py-20 bg-panel border-y border-line"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2.5">
          <Badge tone="ok">صور حية من داخل النظام</Badge>
          <h2 className="text-2xl sm:text-4xl font-black text-ink">
            شاهد النظام على الطبيعة — واضغط للتبديل بين الشاشات
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            واجهات عربية واضحة وسريعة مصممة لسهولة استخدام الكاشير والمندوب وصاحب العمل من اليوم الأول.
          </p>
        </div>

        <div className="rounded-3xl bg-panel border border-line shadow-2xl overflow-hidden text-right">
          {/* Browser Chrome + Tabs */}
          <div className="bg-surface-2/85 border-b border-line px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-bad/75" />
              <span className="w-2.5 h-2.5 rounded-full bg-warn/75" />
              <span className="w-2.5 h-2.5 rounded-full bg-ok/75" />
              <span className="text-xs font-mono text-muted mr-2 hidden sm:inline">
                app.ebms.online — لقطات حقيقية
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="شاشات النظام الحقيقية">
              {SHOWCASE_SCREENS.map((screen, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={screen.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveIndex(idx)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-brand text-on-brand shadow-sm'
                        : 'bg-panel text-muted border border-line hover:text-ink hover:bg-surface-2'
                    }`}
                  >
                    {screen.tabLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Screen Stage + Operational Highlights */}
          <div
            key={activeScreen.id}
            className="ebms-tab-fade grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch bg-canvas/50"
          >
            <div className="lg:col-span-8 p-4 sm:p-6 flex flex-col justify-center">
              <div className="relative group rounded-2xl overflow-hidden border border-line bg-panel shadow-md">
                <img
                  src={activeScreen.image}
                  alt={activeScreen.alt}
                  loading={activeIndex === 0 ? 'eager' : 'lazy'}
                  className="w-full h-auto max-h-[430px] object-contain object-top bg-panel block mx-auto"
                />
                <button
                  type="button"
                  onClick={() => setZoomed(true)}
                  aria-label="تكبير صورة الشاشة"
                  className="absolute bottom-3 left-3 min-h-[38px] px-3 py-1.5 rounded-xl bg-panel/95 border border-line text-xs font-bold text-ink shadow-md flex items-center gap-1.5 hover:bg-brand hover:text-on-brand hover:border-brand transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>تكبير الشاشة</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 p-5 sm:p-6 border-t lg:border-t-0 lg:border-r border-line bg-panel flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <Badge tone="brand">من واقع التشغيل الفعلي</Badge>
                <h3 className="text-lg sm:text-xl font-black text-ink leading-snug">
                  {activeScreen.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted leading-relaxed">
                  {activeScreen.subtitle}
                </p>

                <ul className="space-y-2.5 pt-3 border-t border-line">
                  {activeScreen.highlights.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs sm:text-sm font-semibold text-ink">
                      <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2.5 pt-2">
                <Link
                  to="/register"
                  className="ebms-btn-shimmer w-full min-h-[44px] px-4 rounded-xl bg-brand text-on-brand text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-md"
                >
                  <span>جرّب هذه الشاشة بنفسك مجاناً</span>
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={activeScreen.title}
          onClick={(e) => {
            if (e.target === e.currentTarget) setZoomed(false);
          }}
        >
          <div className="relative w-full max-w-5xl rounded-3xl bg-panel border border-line p-4 sm:p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-right">
                <h4 className="text-sm sm:text-base font-black text-ink">{activeScreen.title}</h4>
                <p className="text-xs text-muted">{activeScreen.subtitle}</p>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={() => setZoomed(false)}>
                <X className="w-4 h-4" />
                <span>إغلاق</span>
              </Button>
            </div>
            <div className="rounded-2xl overflow-hidden border border-line bg-canvas max-h-[75vh] overflow-y-auto">
              <img
                src={activeScreen.image}
                alt={activeScreen.alt}
                className="w-full h-auto block mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
