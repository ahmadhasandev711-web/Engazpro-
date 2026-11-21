import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExchangeRecord, Invoice, OnlineOrder, StoreCreditTransactionRecord } from '@pos-mandob/shared';
import { apiClient } from '../data/api/client';

export interface ExecutePosExchangePayload {
  original_invoice_id?: number | null;
  branch_id?: number | null;
  party_id?: number | null;
  replacement_salesperson_id?: number | null;
  returned_items: Array<{
    product_id: number;
    product_variant_id?: number | null;
    product_batch_id?: number | null;
    quantity: number;
    unit_price?: number;
    condition?: 'SELLABLE' | 'DAMAGED';
  }>;
  replacement_items: Array<{
    product_id: number;
    product_variant_id?: number | null;
    product_batch_id?: number | null;
    quantity: number;
    unit_price?: number;
  }>;
  exchange_shipping_fee?: number;
  store_credit_used?: number;
  surplus_settlement?: 'STORE_CREDIT' | 'REFUND_CASH';
  payment_method?: string;
  refund_method?: string;
  store_credit_expires_at?: string | null;
  idempotency_key?: string;
  notes?: string;
}

export function useExchanges(filters: Record<string, unknown>) {
  return useQuery<{ data: ExchangeRecord[]; meta: any }>({
    queryKey: ['exchanges', filters],
    queryFn: async () => {
      const res = await apiClient.get('/exchanges', { params: filters });
      return { data: res.data?.data || [], meta: res.data?.meta };
    },
  });
}

export function useExchangeLookup() {
  return useMutation<Invoice[], any, string>({
    mutationFn: async (q: string) => {
      const res = await apiClient.get('/exchanges/lookup-invoices', { params: { q: q.trim() } });
      return res.data?.data || [];
    },
  });
}

export function usePartyStoreCredit(partyId?: number | null) {
  return useQuery<{ balance: number; transactions: StoreCreditTransactionRecord[] }>({
    queryKey: ['party-store-credit', partyId],
    queryFn: async () => {
      const res = await apiClient.get(`/parties/${partyId}/store-credit`);
      return res.data?.data || { balance: 0, transactions: [] };
    },
    enabled: Boolean(partyId),
  });
}

export function useExecutePosExchange() {
  const queryClient = useQueryClient();

  return useMutation<ExchangeRecord, any, ExecutePosExchangePayload>({
    mutationFn: async (payload) => {
      const res = await apiClient.post('/exchanges', payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      queryClient.invalidateQueries({ queryKey: ['party-store-credit'] });
    },
  });
}

export function useSwapOnlineOrderItems() {
  const queryClient = useQueryClient();

  return useMutation<
    OnlineOrder,
    any,
    { orderId: number; items: Array<{ product_id: number; product_variant_id?: number | null; quantity: number; unit_price?: number }>; notes?: string }
  >({
    mutationFn: async ({ orderId, items, notes }) => {
      const res = await apiClient.post(`/online-orders/${orderId}/swap-items`, { items, notes });
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCreateOnlineOrderExchange() {
  const queryClient = useQueryClient();

  return useMutation<
    ExchangeRecord,
    any,
    {
      orderId: number;
      returned_items: Array<{ product_id: number; product_variant_id?: number | null; quantity: number; condition?: 'SELLABLE' | 'DAMAGED' }>;
      replacement_items: Array<{ product_id: number; product_variant_id?: number | null; quantity: number; unit_price?: number }>;
      exchange_shipping_fee?: number;
      store_credit_used?: number;
      surplus_settlement?: 'STORE_CREDIT' | 'REFUND_CASH';
      refund_method?: 'CASH' | 'INSTAPAY' | 'VODAFONE_CASH' | 'TRANSFER';
      notes?: string;
    }
  >({
    mutationFn: async ({ orderId, ...payload }) => {
      const res = await apiClient.post(`/online-orders/${orderId}/exchange`, payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-orders'] });
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      queryClient.invalidateQueries({ queryKey: ['party-store-credit'] });
    },
  });
}

export function useCancelExchange() {
  const queryClient = useQueryClient();

  return useMutation<ExchangeRecord, any, number>({
    mutationFn: async (exchangeId) => {
      const res = await apiClient.post(`/exchanges/${exchangeId}/cancel`);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['online-orders'] });
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      queryClient.invalidateQueries({ queryKey: ['party-store-credit'] });
    },
  });
}
