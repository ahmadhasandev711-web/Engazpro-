import { useEffect, useState } from 'react';

interface LandingScrollMetrics {
  progress: number;
  showStickyMobileCta: boolean;
}

/**
 * Tracks reading progress percentage and mobile sticky CTA visibility cleanly via rAF throttling.
 */
export function useLandingScrollMetrics(): LandingScrollMetrics {
  const [metrics, setMetrics] = useState<LandingScrollMetrics>({
    progress: 0,
    showStickyMobileCta: false,
  });

  useEffect(() => {
    let rafId = 0;

    const updateMetrics = () => {
      rafId = 0;
      const docEl = document.documentElement;
      const scrollY = window.scrollY || docEl.scrollTop;
      const scrollable = Math.max(1, docEl.scrollHeight - window.innerHeight);
      const progress = Math.min(100, Math.max(0, Math.round((scrollY / scrollable) * 100)));
      const distanceFromBottom = docEl.scrollHeight - (scrollY + window.innerHeight);
      const showStickyMobileCta = scrollY > 480 && distanceFromBottom > 520;

      setMetrics((prev) =>
        prev.progress === progress && prev.showStickyMobileCta === showStickyMobileCta
          ? prev
          : { progress, showStickyMobileCta }
      );
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateMetrics);
      }
    };

    updateMetrics();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return metrics;
}

/**
 * Observes [data-reveal] sections once per mount and triggers smooth scroll-in classes.
 */
export function useScrollRevealObserver(): void {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (targets.length === 0) return undefined;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.classList.add('ebms-reveal-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('ebms-reveal-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );

    targets.forEach((el) => {
      el.classList.add('ebms-reveal');
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);
}
