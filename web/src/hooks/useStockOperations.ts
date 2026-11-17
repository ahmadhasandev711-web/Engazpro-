import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../data/api/client';
import type {
  StockAdjustmentMode,
  StockAlertsResponse,
  StockAlertsSummary,
  StockMovementRecord,
} from '@pos-mandob/shared';

export const useStockAlertsSummary = (enabled: boolean = true) => {
  return useQuery<StockAlertsSummary>({
    queryKey: ['stock-alerts-summary'],
    queryFn: async () => (await apiClient.get('/stock/alerts/summary')).data?.data,
    enabled,
    staleTime: 60 * 1000,
  });
};

export const useStockAlerts = (
  filters: { branch_id?: number | ''; status?: string; search?: string; expiry_days?: number; page?: number; per_page?: number } = {},
  enabled: boolean = true
) => {
  return useQuery<StockAlertsResponse>({
    queryKey: ['stock-alerts', filters],
    queryFn: async () =>
      (await apiClient.get('/stock/alerts', {
        params: {
          branch_id: filters.branch_id || undefined,
          status: filters.status && filters.status !== 'ALL' ? filters.status : undefined,
          search: filters.search || undefined,
          expiry_days: filters.expiry_days || 30,
          page: filters.page || 1,
          per_page: filters.per_page || 25,
        },
      })).data?.data,
    enabled,
    placeholderData: (prev) => prev,
  });
};

export interface StockMovementsFilter {
  branch_id?: number | '';
  product_id?: number | '';
  type?: string;
  source_type?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
}

export const useStockMovements = (filters: StockMovementsFilter, enabled: boolean = true) => {
  return useQuery<{ data: StockMovementRecord[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }>({
    queryKey: ['stock-movements', filters],
    queryFn: async () =>
      (await apiClient.get('/stock/movements', {
        params: {
          branch_id: filters.branch_id || undefined,
          product_id: filters.product_id || undefined,
          type: filters.type || undefined,
          source_type: filters.source_type || undefined,
          search: filters.search || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          page: filters.page || 1,
        },
      })).data,
    enabled,
    placeholderData: (prev) => prev,
  });
};

export const useAdjustStockMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      branch_id: number;
      product_id: number;
      product_variant_id?: number | null;
      mode: StockAdjustmentMode;
      quantity: number;
      reason: string;
      notes?: string;
    }) => apiClient.post('/stock/adjust', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alerts-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};
