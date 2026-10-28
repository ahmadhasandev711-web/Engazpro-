import React from 'react';
import { MobileFilterChips } from '../mobile/MobileFilterChips';
import type { ProductsViewModel } from './types';

export const ProductsFilterChips: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { filterTab, setFilterTab, setPage, filterOptions } = vm;

  return (
    <>
      {/* Mobile Filter Chips Bar */}
      <MobileFilterChips
        options={filterOptions}
        selectedId={filterTab}
        onSelect={(tab) => {
          setFilterTab(tab as any);
          setPage(1);
        }}
      />

    </>
  );
};
