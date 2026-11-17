import React from 'react';
import { Search } from 'lucide-react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { ProductsViewModel } from './types';

export const ProductsSearchBar: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const {
    search,
    setSearch,
    setPage,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedBranchId,
    setSelectedBranchId,
    categories,
    branches,
    isMandob,
  } = vm;

  return (
    <Card className="p-2.5 sm:p-4 rounded-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="lg:col-span-2">
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
        </div>

        <Select
          value={selectedCategoryId}
          onChange={(e) => {
            setSelectedCategoryId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">كل الأقسام</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        {!isMandob && (
          <Select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">كل الفروع (إجمالي الأرصدة)</option>
            {branches.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        )}
      </div>
    </Card>
  );
};
