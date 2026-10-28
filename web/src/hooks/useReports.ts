import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../data/api/client';
import {
  ProfitReportData,
  SalesReportData,
  StockReportData,
  CashFlowReportData,
  CashFlowTransactionsResponse,
} from '@pos-mandob/shared';

export const useProfitReport = (fromDate: string, toDate: string, enabled: boolean = true) => {
  return useQuery<ProfitReportData>({
    queryKey: ['reports', 'profit', fromDate, toDate],
    queryFn: async () => {
      const res = await apiClient.get('/reports/profit', {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        },
      });
      return res.data?.data;
    },
    enabled,
  });
};

export const useSalesReport = (fromDate: string, toDate: string, enabled: boolean = true) => {
  return useQuery<SalesReportData>({
    queryKey: ['reports', 'sales', fromDate, toDate],
    queryFn: async () => {
      const res = await apiClient.get('/reports/sales', {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        },
      });
      return res.data?.data;
    },
    enabled,
  });
};

export const useStockReport = (enabled: boolean = true) => {
  return useQuery<StockReportData>({
    queryKey: ['reports', 'stock'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/stock');
      return res.data?.data;
    },
    enabled,
  });
};

export const useCashFlowReport = (fromDate: string, toDate: string, enabled: boolean = true) => {
  return useQuery<CashFlowReportData>({
    queryKey: ['reports', 'cash-flow', fromDate, toDate],
    queryFn: async () => {
      const res = await apiClient.get('/reports/cash-flow', {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        },
      });
      return res.data?.data;
    },
    enabled,
  });
};

export interface CashFlowTransactionsFilter {
  channel: string;
  fromDate?: string;
  toDate?: string;
  flowType?: 'ALL' | 'INFLOW' | 'OUTFLOW';
  movementCategory?: string;
  search?: string;
  cashierId?: number;
  page?: number;
  perPage?: number;
}

export const useCashFlowTransactions = (
  filters: CashFlowTransactionsFilter,
  enabled: boolean = true
) => {
  return useQuery<CashFlowTransactionsResponse>({
    queryKey: [
      'reports',
      'cash-flow-transactions',
      filters.channel,
      filters.fromDate,
      filters.toDate,
      filters.flowType,
      filters.movementCategory,
      filters.search,
      filters.cashierId,
      filters.page,
      filters.perPage,
    ],
    queryFn: async () => {
      const res = await apiClient.get('/reports/cash-flow/transactions', {
        params: {
          channel: filters.channel,
          from_date: filters.fromDate || undefined,
          to_date: filters.toDate || undefined,
          flow_type: filters.flowType || undefined,
          movement_category: filters.movementCategory || undefined,
          search: filters.search || undefined,
          cashier_id: filters.cashierId || undefined,
          page: filters.page || 1,
          per_page: filters.perPage || 15,
        },
      });
      return res.data;
    },
    enabled: enabled && !!filters.channel,
    placeholderData: (prev) => prev,
  });
};

/**
 * جلب جميع حركات الخزينة المفلترة للطباعة أو التصدير (حتى 200 حركة كحد أقصى)
 */
export const fetchAllCashFlowTransactions = async (
  filters: Omit<CashFlowTransactionsFilter, 'page' | 'perPage'> & { perPage?: number }
): Promise<CashFlowTransactionsResponse> => {
  const res = await apiClient.get<CashFlowTransactionsResponse>('/reports/cash-flow/transactions', {
    params: {
      channel: filters.channel,
      from_date: filters.fromDate || undefined,
      to_date: filters.toDate || undefined,
      flow_type: filters.flowType || undefined,
      movement_category: filters.movementCategory || undefined,
      search: filters.search || undefined,
      cashier_id: filters.cashierId || undefined,
      page: 1,
      per_page: filters.perPage || 200,
    },
  });
  return res.data;
};
