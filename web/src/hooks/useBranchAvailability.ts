import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../data/api/client';

export interface VariantBranchAvailability {
  id: number;
  name: string;
  sku?: string | null;
  physical_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
}

export interface ProductBranchAvailabilityRow {
  id: number;
  name: string;
  type: string;
  type_label: string;
  is_main: boolean;
  is_user_branch: boolean;
  physical_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  variants: VariantBranchAvailability[];
}

export interface ProductAvailabilityPayload {
  product_id: number;
  product_name: string;
  has_variants: boolean;
  branches: ProductBranchAvailabilityRow[];
}

export interface OrderBranchEvaluationRow {
  id: number;
  name: string;
  type: string;
  type_label: string;
  is_main: boolean;
  is_current: boolean;
  can_fulfill_all: boolean;
  shortages: string[];
}

export interface OrderAvailabilityPayload {
  order_id: number;
  current_branch_id: number | null;
  branches: OrderBranchEvaluationRow[];
}

export function useProductBranchAvailability(productId: number | null) {
  return useQuery<ProductAvailabilityPayload>({
    queryKey: ['product-branch-availability', productId],
    queryFn: async () => {
      const res = await apiClient.get(`/products/${productId}/branch-availability`);
      return res.data?.data;
    },
    enabled: Boolean(productId),
    staleTime: 30 * 1000,
  });
}

export function useOrderBranchAvailability(orderId: number | null) {
  return useQuery<OrderAvailabilityPayload>({
    queryKey: ['online-order-branch-availability', orderId],
    queryFn: async () => {
      const res = await apiClient.get(`/online-orders/${orderId}/branch-availability`);
      return res.data?.data;
    },
    enabled: Boolean(orderId),
    staleTime: 15 * 1000,
  });
}

export function useTransferOnlineOrderBranch(orderQueryKey = 'online-orders') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      targetBranchId,
      reason,
    }: {
      orderId: number;
      targetBranchId: number;
      reason?: string;
    }) => {
      const res = await apiClient.post(`/online-orders/${orderId}/transfer-branch`, {
        target_branch_id: targetBranchId,
        reason: reason || undefined,
      });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [orderQueryKey] });
      queryClient.invalidateQueries({ queryKey: ['online-order-branch-availability', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['product-branch-availability'] });
    },
  });
}
