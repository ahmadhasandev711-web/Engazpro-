import React from 'react';
import clsx from 'clsx';
import { useHaptic } from '../../hooks/useHaptic';

export interface FilterChipOption<T = string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'primary' | 'warning' | 'danger' | 'success';
}

interface MobileFilterChipsProps<T = string> {
  options: FilterChipOption<T>[];
  selectedId: T;
  onSelect: (id: T) => void;
  className?: string;
}

/**
 * Presentation Layer - MobileFilterChips
 * Horizontal swipeable pill filter bar for quick status/category selection on mobile.
 */
export function MobileFilterChips<T extends string>({
  options,
  selectedId,
  onSelect,
  className = '',
}: MobileFilterChipsProps<T>) {
  const { selection } = useHaptic();

  const handleSelect = (id: T) => {
    selection();
    onSelect(id);
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-2 overflow-x-auto no-scrollbar py-2 px-1 scroll-smooth select-none',
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = selectedId === opt.id;
        const Icon = opt.icon;

        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelect(opt.id)}
            className={clsx(
              'flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 active:scale-95 cursor-pointer border',
              isSelected
                ? 'bg-brand text-on-brand border-brand shadow-sm'
                : 'bg-panel text-muted border-line hover:bg-surface-2 hover:text-ink'
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={clsx(
                  'px-1.5 py-0.5 rounded-full text-2xs font-black',
                  isSelected
                    ? 'bg-on-brand/20 text-on-brand'
                    : 'bg-surface-2 text-muted'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
