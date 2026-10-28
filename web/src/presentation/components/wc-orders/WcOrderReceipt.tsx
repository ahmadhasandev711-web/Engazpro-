import React from 'react';
import { PosReceiptModal } from '../pos/PosReceiptModal';
import { cleanItemName } from './helpers';
import type { WcOrdersViewModel } from './types';

export const WcOrderReceipt: React.FC<{ vm: WcOrdersViewModel }> = ({ vm }) => {
  const { printOrder, setPrintOrder } = vm;

  return (
    <>
      {/* Universal POS Receipt Modal for WooCommerce Order Invoices */}
      {printOrder && (
        <PosReceiptModal
          isOpen={Boolean(printOrder)}
          onClose={() => setPrintOrder(null)}
          invoice={
            printOrder.invoice
              ? {
                  ...printOrder.invoice,
                  party: printOrder.party || {
                    name: printOrder.customer_name,
                    phone: printOrder.customer_phone,
                    address: printOrder.customer_address,
                  },
                  customer_phone: printOrder.customer_phone || printOrder.party?.phone,
                  customer_address: [
                    printOrder.customer_address || printOrder.party?.address,
                    printOrder.city,
                    printOrder.governorate,
                  ]
                    .filter(Boolean)
                    .join(' - '),
                  items: printOrder.invoice.items?.length
                    ? printOrder.invoice.items
                    : (printOrder.items_snapshot || []).map((i: any) => ({
                        product_name: cleanItemName(i.name),
                        unit_price: i.price || (i.total && i.quantity ? Number(i.total) / Number(i.quantity) : 0),
                        quantity: i.quantity,
                        total: i.total || Number(i.price || 0) * Number(i.quantity || 1),
                      })),
                  courier_name: printOrder.courier_name,
                  tracking_number: printOrder.tracking_number,
                }
              : {
                  id: printOrder.id,
                  invoice_number: `WC-${printOrder.wc_order_id}`,
                  date: (printOrder.order_date || printOrder.created_at || '').split('T')[0],
                  created_at: printOrder.order_date || printOrder.created_at,
                  party: printOrder.party || {
                    name: printOrder.customer_name,
                    phone: printOrder.customer_phone,
                    address: printOrder.customer_address,
                  },
                  customer_phone: printOrder.customer_phone || printOrder.party?.phone,
                  customer_address: [
                    printOrder.customer_address || printOrder.party?.address,
                    printOrder.city,
                    printOrder.governorate,
                  ]
                    .filter(Boolean)
                    .join(' - '),
                  party_name: printOrder.customer_name,
                  items: (printOrder.items_snapshot || []).map((i: any) => ({
                    product_name: cleanItemName(i.name),
                    unit_price: i.price || (i.total && i.quantity ? Number(i.total) / Number(i.quantity) : 0),
                    quantity: i.quantity,
                    total: i.total || Number(i.price || 0) * Number(i.quantity || 1),
                  })),
                  subtotal:
                    Number(printOrder.total) -
                    Number(printOrder.shipping_cost || 0) +
                    Number(printOrder.discount_total || 0),
                  discount: printOrder.discount_total,
                  shipping_amount: printOrder.shipping_cost,
                  total: printOrder.total,
                  paid_amount:
                    printOrder.payment_status === 'PAID_ONLINE' ||
                    (printOrder.wc_payment_method && printOrder.wc_payment_method !== 'cod')
                      ? printOrder.total
                      : 0,
                  payment_method:
                    printOrder.payment_status === 'PAID_ONLINE' ||
                    (printOrder.wc_payment_method && printOrder.wc_payment_method !== 'cod')
                      ? 'CARD'
                      : printOrder.courier_party_id
                        ? 'COURIER_COD'
                        : 'CASH',
                  courier_name: printOrder.courier_name,
                  tracking_number: printOrder.tracking_number,
                }
          }
        />
      )}
    </>
  );
};
