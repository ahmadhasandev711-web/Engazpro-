import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { ProductsViewModel } from './types';

export const ProductsNotifications: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { errorMessage, successMessage } = vm;

  return (
    <>
      {/* Notifications */}
      {successMessage && (
        <div className="p-3 sm:p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 sm:p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

    </>
  );
};
