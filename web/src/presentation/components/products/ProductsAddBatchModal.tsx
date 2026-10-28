import React from 'react';
import { AddBatchModal } from './AddBatchModal';
import type { ProductsViewModel } from './types';

export const ProductsAddBatchModal: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { setSuccessMessage, selectedBatchProduct, setSelectedBatchProduct } = vm;

  return (
    <>
      {/* Add Batch Modal */}
      <AddBatchModal
        product={selectedBatchProduct}
        isOpen={Boolean(selectedBatchProduct)}
        onClose={() => setSelectedBatchProduct(null)}
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(null), 3500);
        }}
      />

    </>
  );
};
