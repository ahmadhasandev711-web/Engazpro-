import React from 'react';
import { BarcodePrintModal } from './BarcodePrintModal';
import type { ProductsViewModel } from './types';

export const ProductsBarcodePrint: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { selectedPrintProduct, setSelectedPrintProduct } = vm;

  return (
    <>
      {/* Barcode Label Print Modal */}
      <BarcodePrintModal
        product={selectedPrintProduct}
        isOpen={Boolean(selectedPrintProduct)}
        onClose={() => setSelectedPrintProduct(null)}
      />

    </>
  );
};
