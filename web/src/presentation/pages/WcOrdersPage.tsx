import React from 'react';
import { useWcOrders } from '../../hooks/useWcOrders';
import { WcOrdersToolbar } from '../components/wc-orders/WcOrdersToolbar';
import { WcOrdersList } from '../components/wc-orders/WcOrdersList';
import { WcOrderDetailsModal } from '../components/wc-orders/WcOrderDetailsModal';
import { WcOrderActionModals } from '../components/wc-orders/WcOrderActionModals';
import { WcOrderReceipt } from '../components/wc-orders/WcOrderReceipt';

export const WcOrdersPage: React.FC = () => {
  const vm = useWcOrders();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <WcOrdersToolbar vm={vm} />
      <WcOrdersList vm={vm} />
      <WcOrderDetailsModal vm={vm} />
      <WcOrderActionModals vm={vm} />
      <WcOrderReceipt vm={vm} />
    </div>
  );
};
