import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { ProductsViewModel } from './types';

export const ProductsNotifications: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { errorMessage, successMessage } = vm;

  return (
    <>
      {successMessage && (
        <div className="p-3 sm:p-4 bg-ok-soft border border-ok/25 text-ok text-xs sm:text-sm rounded-xl flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-ok flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 sm:p-4 bg-bad-soft border border-bad/25 text-bad text-xs sm:text-sm rounded-xl flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-bad flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </>
  );
};
