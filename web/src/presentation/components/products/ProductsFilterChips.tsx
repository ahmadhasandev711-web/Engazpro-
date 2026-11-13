import React, { useMemo } from 'react';
import { Tabs, TabItem } from '../ui/Tabs';
import type { ProductsViewModel } from './types';

export const ProductsFilterChips: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { filterTab, setFilterTab, setPage, filterOptions } = vm;

  const tabs: TabItem[] = useMemo(
    () =>
      filterOptions.map((opt) => {
        const Icon = opt.icon;
        return {
          id: opt.id,
          label: opt.label,
          count: opt.count,
          icon: Icon ? <Icon className="w-3.5 h-3.5 shrink-0" /> : undefined,
        };
      }),
    [filterOptions]
  );

  return (
    <Tabs
      tabs={tabs}
      activeTab={filterTab}
      onChange={(tab) => {
        setFilterTab(tab as any);
        setPage(1);
      }}
    />
  );
};
