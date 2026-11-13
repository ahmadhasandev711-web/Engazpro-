import React from 'react';
import { cn } from '../../utils/cn';

export interface TabItem {
  id: string;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className }) => {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        'flex items-center gap-1.5 p-1 bg-surface-2 border border-line rounded-xl overflow-x-auto select-none max-w-full min-w-0',
        className
      )}
      dir="rtl"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:pointer-events-none',
              isActive
                ? 'bg-panel text-brand shadow-2xs font-black'
                : 'text-muted hover:text-ink hover:bg-panel/50'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-black',
                  isActive ? 'bg-brand-soft text-brand-ink' : 'bg-line text-muted'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
