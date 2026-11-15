import { useEffect } from 'react';

interface PageMetaOptions {
  title: string;
  description?: string;
}

/**
 * Synchronizes document title and meta description for public SEO routes.
 */
export function usePageMeta({ title, description }: PageMetaOptions): void {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const metaDesc = document.querySelector('meta[name="description"]');
    const previousDesc = metaDesc?.getAttribute('content') ?? null;

    if (description && metaDesc) {
      metaDesc.setAttribute('content', description);
    }

    return () => {
      document.title = previousTitle;
      if (metaDesc && previousDesc !== null) {
        metaDesc.setAttribute('content', previousDesc);
      }
    };
  }, [title, description]);
}
