import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Loader2, Search, X, Check } from 'lucide-react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { cn } from '../../utils/cn';

export interface AsyncSearchOption<T = unknown> {
  value: string | number;
  label: string;
  sublabel?: string;
  raw?: T;
}

export interface AsyncSearchSelectProps<T = unknown> {
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  value?: string | number | null;
  selectedOption?: AsyncSearchOption<T> | null;
  onChange: (option: AsyncSearchOption<T> | null) => void;
  loadOptions: (search: string) => Promise<AsyncSearchOption<T>[]>;
  queryKeyPrefix: string | unknown[];
  enabled?: boolean;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  error?: string;
  className?: string;
}

export function AsyncSearchSelect<T = unknown>({
  label,
  placeholder = '-- اختر --',
  searchPlaceholder = 'ابحث هنا...',
  emptyText = 'لا توجد نتائج مطابقة',
  value,
  selectedOption = null,
  onChange,
  loadOptions,
  queryKeyPrefix,
  enabled = true,
  disabled = false,
  required = false,
  allowClear = true,
  clearLabel = 'إلغاء التحديد',
  error,
  className,
}: AsyncSearchSelectProps<T>) {
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [cachedOption, setCachedOption] = useState<AsyncSearchOption<T> | null>(selectedOption);

  useEffect(() => {
    if (selectedOption && String(selectedOption.value) === String(value ?? '')) {
      setCachedOption(selectedOption);
    } else if (value === undefined || value === null || value === '') {
      setCachedOption(null);
    }
  }, [value, selectedOption]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => searchInputRef.current?.focus(), 30);
      return () => window.clearTimeout(timer);
    }
    setSearch('');
  }, [isOpen]);

  const prefixKey = Array.isArray(queryKeyPrefix) ? queryKeyPrefix : [queryKeyPrefix];
  const { data: options = [], isLoading, isFetching } = useQuery<AsyncSearchOption<T>[]>({
    queryKey: [...prefixKey, debouncedSearch],
    queryFn: () => loadOptions(debouncedSearch),
    enabled: enabled && isOpen && !disabled,
    placeholderData: (prev) => prev,
  });

  const activeOption =
    options.find((opt) => String(opt.value) === String(value ?? '')) ||
    (cachedOption && String(cachedOption.value) === String(value ?? '') ? cachedOption : null) ||
    (selectedOption && String(selectedOption.value) === String(value ?? '') ? selectedOption : null);

  const hasValue = value !== undefined && value !== null && String(value) !== '';

  const handleSelect = (opt: AsyncSearchOption<T> | null) => {
    setCachedOption(opt);
    onChange(opt);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('w-full space-y-1.5 text-right relative', className)} dir="rtl">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold text-ink select-none">
          {label}
        </label>
      )}

      {/* Hidden input for native HTML required form validation if requested */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required={required}
          value={hasValue ? String(value) : ''}
          onChange={() => {}}
          className="sr-only"
        />
      )}

      <div className="relative flex items-center">
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          className={cn(
            'w-full min-h-[44px] px-3.5 py-2 text-sm bg-panel text-ink border border-line rounded-xl outline-none transition-colors flex items-center justify-between gap-2 text-right cursor-pointer focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-50 disabled:bg-surface-2 disabled:cursor-not-allowed',
            error && 'border-bad focus:border-bad focus:ring-bad'
          )}
        >
          <span className={cn('truncate', !activeOption && 'text-muted')}>
            {activeOption ? activeOption.label : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {allowClear && hasValue && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label={clearLabel}
                title={clearLabel}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(null);
                }}
                className="p-1 rounded-md text-muted hover:text-bad hover:bg-surface-2 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown className={cn('w-4 h-4 text-muted transition-transform', isOpen && 'rotate-180')} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-panel border border-line rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-2 border-b border-line bg-surface-2/60">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-muted absolute right-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full min-h-[38px] pr-9 pl-8 py-1.5 text-xs bg-panel text-ink border border-line rounded-lg outline-none focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-muted"
                />
                {(isLoading || isFetching) && (
                  <Loader2 className="w-3.5 h-3.5 text-brand animate-spin absolute left-2.5" />
                )}
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-line/60">
              {allowClear && hasValue && (
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className="w-full px-3.5 py-2.5 text-right text-xs text-muted hover:bg-surface-2 hover:text-ink transition-colors cursor-pointer"
                >
                  {clearLabel}
                </button>
              )}

              {isLoading ? (
                <div className="py-6 text-center text-xs text-muted">جاري البحث...</div>
              ) : options.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted">{emptyText}</div>
              ) : (
                options.map((opt) => {
                  const isSelected = String(opt.value) === String(value ?? '');
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={cn(
                        'w-full px-3.5 py-2.5 text-right flex items-center justify-between gap-2 transition-colors cursor-pointer hover:bg-surface-2',
                        isSelected && 'bg-brand-soft/60 text-brand-ink'
                      )}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink truncate">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="text-[11px] text-muted truncate mt-0.5">{opt.sublabel}</div>
                        )}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-brand shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-bad font-medium">{error}</p>}
    </div>
  );
}
