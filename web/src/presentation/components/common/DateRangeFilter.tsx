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
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 touch-manipulation ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/20'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
                }`}
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
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 touch-manipulation ${
              activePreset === 'custom' || isCustomOpen
                ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/20'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>مخصص</span>
          </button>
        </div>

        {/* Desktop Inline Custom Date Inputs (hidden on mobile, shown on sm+) */}
        {(isCustomOpen || activePreset === 'custom') && (
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-xs shadow-sm animate-in fade-in duration-150 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">من:</span>
              <input
                type="date"
                value={internalFrom}
                onChange={(e) => handleCustomDateChange(e.target.value, internalTo)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">إلى:</span>
              <input
                type="date"
                value={internalTo}
                onChange={(e) => handleCustomDateChange(internalFrom, e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {(internalFrom || internalTo) && (
              <button
                type="button"
                onClick={() => handleSelectPreset('all')}
                className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
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
        <div className="sm:hidden w-full bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs shadow-sm animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 mb-1 block">من تاريخ:</label>
              <input
                type="date"
                value={internalFrom}
                onChange={(e) => handleCustomDateChange(e.target.value, internalTo)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 mb-1 block">إلى تاريخ:</label>
              <input
                type="date"
                value={internalTo}
                onChange={(e) => handleCustomDateChange(internalFrom, e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {(internalFrom || internalTo) && (
            <button
              type="button"
              onClick={() => handleSelectPreset('all')}
              className="w-full py-1 text-center text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-100 transition-colors flex items-center justify-center gap-1 active:scale-95"
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
