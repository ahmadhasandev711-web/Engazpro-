import React from 'react';
import { useWcOrders } from '../../hooks/useWcOrders';
import { WcOrdersToolbar } from '../components/wc-orders/WcOrdersToolbar';
import { WcOrdersList } from '../components/wc-orders/WcOrdersList';
import { WcOrderDetailsPanel } from '../components/wc-orders/WcOrderDetailsPanel';
import { WcOrderDetailsModal } from '../components/wc-orders/WcOrderDetailsModal';
import { WcOrderActionModals } from '../components/wc-orders/WcOrderActionModals';
import { WcOrderReceipt } from '../components/wc-orders/WcOrderReceipt';

export const WcOrdersPage: React.FC = () => {
  const vm = useWcOrders();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <WcOrdersToolbar vm={vm} />

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          <WcOrdersList vm={vm} />
        </div>
        <aside className="hidden xl:block w-[420px] shrink-0 sticky top-6">
          <WcOrderDetailsPanel vm={vm} isAside={true} />
        </aside>
      </div>

      <WcOrderDetailsModal vm={vm} />
      <WcOrderActionModals vm={vm} />
      <WcOrderReceipt vm={vm} />
    </div>
  );
};
