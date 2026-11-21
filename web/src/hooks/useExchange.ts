import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExchangeRecord, Invoice, OnlineOrder, StoreCreditTransactionRecord } from '@pos-mandob/shared';
import { apiClient } from '../data/api/client';
import { useAuthStore } from '../data/store/useAuthStore';

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

export interface ExchangeListFilters {
  search?: string;
  source?: string;
  status?: string;
  branch_id?: number;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

export function useExchanges(filters: ExchangeListFilters) {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<{ data: ExchangeRecord[]; meta: any }>({
    queryKey: ['exchanges', userId, filters],
    queryFn: async () => {
      const res = await apiClient.get('/exchanges', { params: filters });
      return { data: res.data?.data || [], meta: res.data?.meta };
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useFetchExchangeDetail() {
  return useMutation<ExchangeRecord, any, number>({
    mutationFn: async (exchangeId: number) => {
      const res = await apiClient.get(`/exchanges/${exchangeId}`);
      return res.data?.data;
    },
  });
}

export function useStoreIdentity() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['store-identity', userId],
    queryFn: async () => (await apiClient.get('/settings/store-identity')).data?.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExchangeStaffList(enabled: boolean) {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<any[]>({
    queryKey: ['employees-for-exchange', userId],
    queryFn: async () => (await apiClient.get('/employees')).data?.data || [],
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExchangeCatalog(branchId?: number | null, search?: string) {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<any[]>({
    queryKey: ['exchange-catalog', userId, branchId ?? null, search || ''],
    queryFn: async () => {
      const res = await apiClient.get('/products/pos-catalog', {
        params: {
          per_page: 12,
          branch_id: branchId || undefined,
          search: search || undefined,
        },
      });
      return res.data?.data || [];
    },
  });
}

export function useFetchInvoiceById() {
  return useMutation<Invoice, any, string | number>({
    mutationFn: async (invoiceId) => {
      const res = await apiClient.get(`/invoices/${invoiceId}`);
      return res.data?.data;
    },
  });
}

export function useFetchReturnableSaleInvoice() {
  return useMutation<Invoice, any, string>({
    mutationFn: async (invoiceNumber) => {
      const res = await apiClient.get(`/invoices/by-number/${encodeURIComponent(invoiceNumber)}`, {
        params: { for_return: 1, return_type: 'SALE_RETURN' },
      });
      return res.data?.data;
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
