import React from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { WcOrderDetailsPanel } from './WcOrderDetailsPanel';
import type { WcOrdersViewModel } from './types';

export const WcOrderDetailsModal: React.FC<{ vm: WcOrdersViewModel }> = ({ vm }) => {
  const isXl = useMediaQuery('(min-width: 1280px)');
  const { viewingOrder, setViewingOrder } = vm;

  // Strictly do not render modal on xl (>= 1280px) to prevent scroll lock or focus trap
  if (isXl || !viewingOrder) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-canvas/80 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <WcOrderDetailsPanel vm={vm} onClose={() => setViewingOrder(null)} isAside={false} />
      </div>
    </div>
  );
};
