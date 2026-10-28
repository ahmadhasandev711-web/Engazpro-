import React from 'react';
import { OpeningStockModal } from './OpeningStockModal';
import type { ProductsViewModel } from './types';

export const ProductsOpeningStock: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { setSuccessMessage, isOpeningStockOpen, setIsOpeningStockOpen, products } = vm;

  return (
    <>
      {/* Opening Stock Balance Modal */}
      <OpeningStockModal
        isOpen={isOpeningStockOpen}
        onClose={() => setIsOpeningStockOpen(false)}
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(null), 4000);
        }}
        products={products}
      />
    </>
  );
};
