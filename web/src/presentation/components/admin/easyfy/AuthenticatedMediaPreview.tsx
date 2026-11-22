import React, { useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2, Maximize2, X } from 'lucide-react';
import { apiClient } from '../../../../data/api/client';
import { Button } from '../../ui';

interface AuthenticatedMediaPreviewProps {
  endpoint: string;
  alt: string;
  compact?: boolean;
}

export const AuthenticatedMediaPreview: React.FC<AuthenticatedMediaPreviewProps> = ({
  endpoint,
  alt,
  compact = false,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    setIsLoading(true);
    setHasError(false);

    apiClient
      .get(endpoint, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        const blob = res.data as Blob;
        objectUrl = URL.createObjectURL(blob);
        setMimeType(blob.type || '');
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [endpoint]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted py-2">
        <Loader2 className="w-4 h-4 animate-spin text-brand" />
        <span>جاري تحميل المرفق المؤمّن...</span>
      </div>
    );
  }

  if (hasError || !blobUrl) {
    return <p className="text-xs text-bad font-medium">تعذر تحميل الملف المرفق.</p>;
  }

  const isPdf = mimeType.includes('pdf');

  if (isPdf) {
    return (
      <a
        href={blobUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-surface-2 text-xs font-bold text-ink hover:border-brand transition-colors"
      >
        <FileText className="w-4 h-4 text-brand" />
        <span>فتح ملف التصميم (PDF)</span>
        <ExternalLink className="w-3.5 h-3.5 text-muted" />
      </a>
    );
  }

  return (
    <>
      <div className="relative group inline-block">
        <img
          src={blobUrl}
          alt={alt}
          onClick={() => setIsZoomed(true)}
          className={
            compact
              ? 'w-20 h-20 object-cover rounded-xl border border-line cursor-pointer hover:opacity-90 transition-opacity'
              : 'max-h-56 w-auto object-contain rounded-xl border border-line bg-canvas cursor-pointer hover:opacity-95 transition-opacity'
          }
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setIsZoomed(true)}
          className="mt-2"
          leftIcon={<Maximize2 className="w-3.5 h-3.5" />}
        >
          تكبير الصورة
        </Button>
      </div>

      {isZoomed && (
        <div
          className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
          dir="rtl"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-panel border border-line rounded-2xl p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              className="absolute top-3 left-3 w-9 h-9 rounded-full bg-panel border border-line flex items-center justify-center text-ink hover:bg-surface-2"
              aria-label="إغلاق المعاينة"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={blobUrl} alt={alt} className="max-h-[82vh] max-w-full object-contain rounded-xl" />
          </div>
        </div>
      )}
    </>
  );
};
