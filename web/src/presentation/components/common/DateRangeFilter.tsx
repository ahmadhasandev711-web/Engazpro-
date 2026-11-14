import React, { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

export type DatePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export interface DateRangeFilterProps {
  fromDate?: string;
  toDate?: string;
  defaultPreset?: DatePreset;
  onChange: (from: string, to: string, preset: DatePreset) => void;
  className?: string;
  showAllOption?: boolean;
}

const formatLocalYMD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculatePresetDates = (preset: DatePreset): { from: string; to: string } => {
  const now = new Date();
  const todayStr = formatLocalYMD(now);

  switch (preset) {
    case 'today':
      return { from: todayStr, to: todayStr };

    case 'yesterday': {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = formatLocalYMD(y);
      return { from: yStr, to: yStr };
    }

    case 'this_week': {
      // In Arab region (Egypt/Gulf), week starts on Saturday
      const day = now.getDay(); // 0 is Sunday, 6 is Saturday
      const diff = (day + 1) % 7; // days since Saturday
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - diff);
      return { from: formatLocalYMD(startOfWeek), to: todayStr };
    }

    case 'this_month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: formatLocalYMD(firstDay), to: todayStr };
    }

    case 'all':
    default:
      return { from: '', to: '' };
  }
};

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  fromDate = '',
  toDate = '',
  defaultPreset = 'all',
  onChange,
  className = '',
  showAllOption = true,
}) => {
  const [activePreset, setActivePreset] = useState<DatePreset>(defaultPreset);
  const [internalFrom, setInternalFrom] = useState<string>(fromDate);
  const [internalTo, setInternalTo] = useState<string>(toDate);
  const [isCustomOpen, setIsCustomOpen] = useState<boolean>(activePreset === 'custom');

  useEffect(() => {
    setInternalFrom(fromDate);
    setInternalTo(toDate);
    if (!fromDate && !toDate) {
      setActivePreset('all');
    }
  }, [fromDate, toDate]);

  const handleSelectPreset = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset === 'custom') {
      setIsCustomOpen(true);
      return;
    }

    setIsCustomOpen(false);
    const { from, to } = calculatePresetDates(preset);
    setInternalFrom(from);
    setInternalTo(to);
    onChange(from, to, preset);
  };

  const handleCustomDateChange = (newFrom: string, newTo: string) => {
    setInternalFrom(newFrom);
    setInternalTo(newTo);
    setActivePreset('custom');
    onChange(newFrom, newTo, 'custom');
  };

  const presets: Array<{ id: DatePreset; label: string }> = [
    ...(showAllOption ? [{ id: 'all' as DatePreset, label: 'الكل' }] : []),
    { id: 'today', label: 'اليوم' },
    { id: 'yesterday', label: 'أمس' },
    { id: 'this_week', label: 'هذا الأسبوع' },
    { id: 'this_month', label: 'هذا الشهر' },
  ];

  const presetBtnClass = (isActive: boolean) =>
    `flex-shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 touch-manipulation cursor-pointer ${
      isActive
        ? 'bg-brand text-on-brand shadow-sm ring-2 ring-brand/25'
        : 'bg-surface-2 hover:bg-line text-muted hover:text-ink border border-line'
    }`;

  const dateInputClass =
    'bg-panel border border-line rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand';

  return (
    <div className={`w-full max-w-full min-w-0 flex flex-col gap-2 ${className}`}>
      <div className="w-full min-w-0 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        {/* Quick Preset Buttons (Mobile-first horizontal scroll track) */}
        <div className="w-full sm:w-auto min-w-0 flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 no-scrollbar flex-nowrap scroll-smooth">
          {presets.map((p) => {
            const isActive = activePreset === p.id && !isCustomOpen;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p.id)}
                className={presetBtnClass(isActive)}
              >
                {p.label}
              </button>
            );
          })}

          {/* Custom Preset Trigger */}
          <button
            type="button"
            onClick={() => {
              const next = !isCustomOpen;
              setIsCustomOpen(next);
              if (next) {
                setActivePreset('custom');
              }
            }}
            className={`inline-flex items-center gap-1.5 ${presetBtnClass(
              activePreset === 'custom' || isCustomOpen
            )}`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>مخصص</span>
          </button>
        </div>

        {/* Desktop Inline Custom Date Inputs (hidden on mobile, shown on sm+) */}
        {(isCustomOpen || activePreset === 'custom') && (
          <div className="hidden sm:flex items-center gap-2 bg-surface-2 border border-line px-3 py-1 rounded-xl text-xs shadow-sm animate-in fade-in duration-150 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-muted font-medium">من:</span>
              <input
                type="date"
                value={internalFrom}
                onChange={(e) => handleCustomDateChange(e.target.value, internalTo)}
                className={dateInputClass}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-muted font-medium">إلى:</span>
              <input
                type="date"
                value={internalTo}
                onChange={(e) => handleCustomDateChange(internalFrom, e.target.value)}
                className={dateInputClass}
              />
            </div>

            {(internalFrom || internalTo) && (
              <button
                type="button"
                onClick={() => handleSelectPreset('all')}
                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-muted hover:text-bad rounded-lg transition-colors cursor-pointer"
                title="إلغاء التصفية الزمنية"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile Dedicated Custom Date Panel (sm:hidden, perfectly fits mobile width) */}
      {(isCustomOpen || activePreset === 'custom') && (
        <div className="sm:hidden w-full bg-surface-2 border border-line p-2.5 rounded-xl text-xs shadow-sm animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-2xs font-bold text-muted mb-1 block">من تاريخ:</label>
              <input
                type="date"
                value={internalFrom}
                onChange={(e) => handleCustomDateChange(e.target.value, internalTo)}
                className={`w-full font-bold ${dateInputClass}`}
              />
            </div>
            <div>
              <label className="text-2xs font-bold text-muted mb-1 block">إلى تاريخ:</label>
              <input
                type="date"
                value={internalTo}
                onChange={(e) => handleCustomDateChange(internalFrom, e.target.value)}
                className={`w-full font-bold ${dateInputClass}`}
              />
            </div>
          </div>

          {(internalFrom || internalTo) && (
            <button
              type="button"
              onClick={() => handleSelectPreset('all')}
              className="w-full min-h-[44px] py-1.5 text-center text-xs font-bold text-bad hover:bg-bad-soft rounded-lg border border-bad/20 transition-colors flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>إلغاء التصفية الزمنية والرجوع للكل</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
