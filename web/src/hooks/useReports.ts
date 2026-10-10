import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../data/api/client';
import {
  ProfitReportData,
  SalesReportData,
  StockReportData,
  CashFlowReportData,
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
