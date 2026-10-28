import React from 'react';
import { Search } from 'lucide-react';
import type { ProductsViewModel } from './types';

export const ProductsSearchBar: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { search, setSearch, setPage } = vm;

  return (
    <>
      {/* Search Bar */}
      <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="البحث بالاسم أو الباركود أو الكود أو المتغير..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-4 pr-9 sm:pr-10 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-right"
          />
        </div>
      </div>

    </>
  );
};
