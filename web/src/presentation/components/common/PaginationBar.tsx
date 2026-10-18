import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

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

  return (
    <div
      className={`px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs no-print transition-opacity ${
        isFetching ? 'opacity-65' : ''
      }`}
      dir="rtl"
    >
      <div className="text-slate-500 font-medium">
        عرض <span className="font-bold text-slate-800 font-mono">{fromItem}</span> إلى{' '}
        <span className="font-bold text-slate-800 font-mono">{toItem}</span> من إجمالي{' '}
        <span className="font-black text-primary-700 font-mono">{total}</span> {itemLabel}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none font-bold flex items-center gap-1 transition-colors shadow-2xs"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          <span>السابق</span>
        </button>

        <div className="flex items-center gap-1 px-1">
          {pageNumbers[0] > 1 && (
            <>
              <button
                type="button"
                onClick={() => onPageChange(1)}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 font-mono font-bold text-xs transition-colors"
              >
                1
              </button>
              {pageNumbers[0] > 2 && <span className="text-slate-400 px-0.5">...</span>}
            </>
          )}

          {pageNumbers.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onPageChange(num)}
              className={`w-7 h-7 rounded-lg font-mono font-bold text-xs transition-all ${
                num === currentPage
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {num}
            </button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < lastPage && (
            <>
              {pageNumbers[pageNumbers.length - 1] < lastPage - 1 && (
                <span className="text-slate-400 px-0.5">...</span>
              )}
              <button
                type="button"
                onClick={() => onPageChange(lastPage)}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 font-mono font-bold text-xs transition-colors"
              >
                {lastPage}
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          disabled={currentPage >= lastPage}
          onClick={() => onPageChange(Math.min(lastPage, currentPage + 1))}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none font-bold flex items-center gap-1 transition-colors shadow-2xs"
        >
          <span>التالي</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
