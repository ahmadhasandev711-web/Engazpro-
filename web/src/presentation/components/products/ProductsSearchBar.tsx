import React from 'react';
import { Search } from 'lucide-react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import type { ProductsViewModel } from './types';

export const ProductsSearchBar: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { search, setSearch, setPage } = vm;

  return (
    <Card className="p-2.5 sm:p-4 rounded-xl">
      <Input
        type="text"
        placeholder="بحث بالاسم أو الباركود أو الكود"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        leftIcon={<Search className="w-4 h-4 sm:w-5 sm:h-5 text-muted" />}
        className="bg-surface-2/50 focus:bg-panel text-xs sm:text-sm"
      />
    </Card>
  );
};
