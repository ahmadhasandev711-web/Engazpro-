import React from 'react';
import { formatNumber } from '@pos-mandob/shared';
import { Package, Plus, Boxes } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { ProductsViewModel } from './types';

export const ProductsMobileHero: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { setIsOpeningStockOpen, isMandob, canAddProduct, openCreateModal, totalProducts, totalStock, lowStockCount } = vm;

  return (
    <Card className="md:hidden p-3 sm:p-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-ok-soft text-ok flex items-center justify-center font-black shrink-0 border border-ok/20">
          <Package className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-black text-ink truncate">
              {isMandob ? 'الأصناف والأسعار' : 'الأصناف والمخزون'}
            </h2>
            <Badge tone="neutral" className="text-2xs font-black px-2 py-0.5 shrink-0 tabular-nums">
              {totalProducts}
            </Badge>
          </div>
          <p className="text-2xs text-muted font-medium truncate">
            المخزون: <span className="font-bold text-ink tabular-nums">{formatNumber(totalStock)}</span>
            {lowStockCount > 0 && (
              <span className="text-warn font-black mr-1.5 inline-flex items-center gap-0.5 tabular-nums">
                • {lowStockCount} نواقص
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {canAddProduct && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsOpeningStockOpen(true)}
            leftIcon={<Boxes className="w-3.5 h-3.5 text-brand" />}
            title="رصيد أول المدة"
            className="px-2.5 text-xs font-bold"
          >
            أول المدة
          </Button>
        )}
        {canAddProduct && (
          <Button
            variant="primary"
            size="md"
            onClick={openCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="px-3 text-xs font-bold"
          >
            إضافة
          </Button>
        )}
      </div>
    </Card>
  );
};
