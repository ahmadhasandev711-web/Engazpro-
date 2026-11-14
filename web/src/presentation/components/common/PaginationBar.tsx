import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '../ui';

export interface PaginationBarProps {
  currentPage: number;
  lastPage: number;
  total: number;
  perPage?: number;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  lastPage,
  total,
  perPage = 20,
  isFetching = false,
  onPageChange,
  itemLabel = 'سجل',
}) => {
  if (total === 0 || lastPage <= 1) {
    return null;
  }

  const fromItem = (currentPage - 1) * perPage + 1;
  const toItem = Math.min(currentPage * perPage, total);

  // Build visible page numbers window (up to 5 pages around currentPage)
  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(lastPage, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();
  const pageBtnClass = (isActive: boolean) =>
    `min-w-[44px] min-h-[44px] rounded-xl font-bold text-xs transition-all cursor-pointer ${
      isActive
        ? 'bg-brand text-on-brand shadow-xs'
        : 'border border-line bg-panel text-muted hover:bg-surface-2 hover:text-ink'
    }`;

  return (
    <div
      className={`px-4 py-3 bg-surface-2/60 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs no-print transition-opacity ${
        isFetching ? 'opacity-65' : ''
      }`}
      dir="rtl"
    >
      <div className="text-muted font-medium">
        عرض <span className="font-bold text-ink">{fromItem}</span> إلى{' '}
        <span className="font-bold text-ink">{toItem}</span> من إجمالي{' '}
        <span className="font-black text-brand-ink">{total}</span> {itemLabel}
      </div>

      <div className="flex items-center gap-1 flex-wrap justify-center">
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          leftIcon={<ChevronRight className="w-3.5 h-3.5" />}
          className="text-xs font-bold px-3 bg-panel"
        >
          السابق
        </Button>

        <div className="flex items-center gap-1 px-1">
          {pageNumbers[0] > 1 && (
            <>
              <button type="button" onClick={() => onPageChange(1)} className={pageBtnClass(false)}>
                1
              </button>
              {pageNumbers[0] > 2 && <span className="text-muted px-0.5">...</span>}
            </>
          )}

          {pageNumbers.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onPageChange(num)}
              className={pageBtnClass(num === currentPage)}
            >
              {num}
            </button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < lastPage && (
            <>
              {pageNumbers[pageNumbers.length - 1] < lastPage - 1 && (
                <span className="text-muted px-0.5">...</span>
              )}
              <button
                type="button"
                onClick={() => onPageChange(lastPage)}
                className={pageBtnClass(false)}
              >
                {lastPage}
              </button>
            </>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={currentPage >= lastPage}
          onClick={() => onPageChange(Math.min(lastPage, currentPage + 1))}
          rightIcon={<ChevronLeft className="w-3.5 h-3.5" />}
          className="text-xs font-bold px-3 bg-panel"
        >
          التالي
        </Button>
      </div>
    </div>
  );
};
