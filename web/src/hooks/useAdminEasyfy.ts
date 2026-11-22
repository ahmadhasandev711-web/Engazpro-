import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../data/api/client';
import type {
  AdminCommandCenterOverview,
  EasyfyCategory,
  EasyfyCoupon,
  EasyfyDemandReport,
  EasyfyInventoryOverview,
  EasyfyOrder,
  EasyfyOrderStatus,
  EasyfyPaymentMethod,
  EasyfyPaymentStatus,
  EasyfyProduct,
  EasyfyProductImage,
  EasyfyProductVariant,
  EasyfyShippingZone,
  EasyfyStockMode,
  EasyfyStockMovementType,
  EasyfyStoreSettings,
  SaveEasyfyCategoryPayload,
  SaveEasyfyCouponPayload,
  SaveEasyfyProductPayload,
  SaveEasyfyShippingZonePayload,
} from '@pos-mandob/shared';

export interface EasyfyPaginatedResult<T> {
  items: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

function normalizeEasyfyPaginated<T>(payload: any): EasyfyPaginatedResult<T> {
  const items = Array.isArray(payload?.data) ? payload.data : [];
  const meta = payload?.meta ?? {};
  return {
    items,
    current_page: Number(meta.current_page ?? 1),
    last_page: Number(meta.last_page ?? 1),
    per_page: Number(meta.per_page ?? 20),
    total: Number(meta.total ?? items.length),
  };
}

export const useAdminCommandOverview = () =>
  useQuery<AdminCommandCenterOverview>({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/overview');
      return res.data.data;
    },
    refetchInterval: 60_000,
  });

export const useAdminEasyfyDemandReport = () =>
  useQuery<EasyfyDemandReport>({
    queryKey: ['admin-easyfy-demand'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/easyfy/analytics/demand');
      return res.data.data;
    },
  });

// --- Categories ---
export const useAdminEasyfyCategories = () =>
  useQuery<EasyfyCategory[]>({
    queryKey: ['admin-easyfy-categories'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/easyfy/categories');
      return res.data.data ?? [];
    },
  });

export const useSaveEasyfyCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SaveEasyfyCategoryPayload) => {
      const res = payload.id
        ? await apiClient.put(`/admin/easyfy/categories/${payload.id}`, payload)
        : await apiClient.post('/admin/easyfy/categories', payload);
      return res.data.data as EasyfyCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-products'] });
    },
  });
};

export const useUploadEasyfyCategoryImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ categoryId, file }: { categoryId: number; file: File }) => {
      const form = new FormData();
      form.append('image', file);
      const res = await apiClient.post(`/admin/easyfy/categories/${categoryId}/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data as EasyfyCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-categories'] });
    },
  });
};

export const useDeleteEasyfyCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/admin/easyfy/categories/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-products'] });
    },
  });
};

// --- Products ---
export interface AdminEasyfyProductFilters {
  category_id?: number | '';
  stock_mode?: EasyfyStockMode | '';
  search?: string;
  page?: number;
}

export const useAdminEasyfyProducts = (filters: AdminEasyfyProductFilters) =>
  useQuery<EasyfyPaginatedResult<EasyfyProduct>>({
    queryKey: ['admin-easyfy-products', filters],
    queryFn: async () => {
      const res = await apiClient.get('/admin/easyfy/products', {
        params: {
          category_id: filters.category_id || undefined,
          stock_mode: filters.stock_mode || undefined,
          search: filters.search || undefined,
          page: filters.page || 1,
        },
      });
      return normalizeEasyfyPaginated<EasyfyProduct>(res.data);
    },
  });

export const useSaveEasyfyProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SaveEasyfyProductPayload) => {
      const res = payload.id
        ? await apiClient.put(`/admin/easyfy/products/${payload.id}`, payload)
        : await apiClient.post('/admin/easyfy/products', payload);
      return res.data.data as EasyfyProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useDeleteEasyfyProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/admin/easyfy/products/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-inventory'] });
    },
  });
};

export const useUploadEasyfyProductImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      file,
      isPrimary = false,
      variantId,
    }: {
      productId: number;
      file: File;
      isPrimary?: boolean;
      variantId?: number | null;
    }) => {
      const form = new FormData();
      form.append('image', file);
      if (isPrimary) form.append('is_primary', '1');
      if (variantId) form.append('variant_id', String(variantId));
      const res = await apiClient.post(`/admin/easyfy/products/${productId}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data as EasyfyProductImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-products'] });
    },
  });
};

export const useSetPrimaryEasyfyImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, imageId }: { productId: number; imageId: number }) => {
      const res = await apiClient.patch(`/admin/easyfy/products/${productId}/images/${imageId}/primary`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-products'] });
    },
  });
};

export const useDeleteEasyfyProductImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (imageId: number) => {
      const res = await apiClient.delete(`/admin/easyfy/product-images/${imageId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-products'] });
    },
  });
};

// --- Orders ---
export interface AdminEasyfyOrderFilters {
  status?: EasyfyOrderStatus | '';
  payment_verification_status?: EasyfyPaymentStatus | '';
  payment_method?: EasyfyPaymentMethod | '';
  search?: string;
  page?: number;
}

export const useAdminEasyfyOrders = (filters: AdminEasyfyOrderFilters) =>
  useQuery<EasyfyPaginatedResult<EasyfyOrder>>({
    queryKey: ['admin-easyfy-orders', filters],
    queryFn: async () => {
      const res = await apiClient.get('/admin/easyfy/orders', {
        params: {
          status: filters.status || undefined,
          payment_verification_status: filters.payment_verification_status || undefined,
          payment_method: filters.payment_method || undefined,
          search: filters.search || undefined,
          page: filters.page || 1,
        },
      });
      return normalizeEasyfyPaginated<EasyfyOrder>(res.data);
    },
  });

export const useAdminEasyfyOrderDetail = (orderId: number | null) =>
  useQuery<EasyfyOrder>({
    queryKey: ['admin-easyfy-order', orderId],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/easyfy/orders/${orderId}`);
      return res.data.data;
    },
    enabled: Boolean(orderId),
  });

export const useUpdateEasyfyOrderStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      courier_name,
      tracking_number,
      admin_notes,
      note,
    }: {
      orderId: number;
      status: EasyfyOrderStatus | string;
      courier_name?: string;
      tracking_number?: string;
      admin_notes?: string;
      note?: string;
    }) => {
      const res = await apiClient.patch(`/admin/easyfy/orders/${orderId}/status`, {
        status,
        courier_name,
        tracking_number,
        admin_notes,
        note,
      });
      return res.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-order', vars.orderId] });
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useVerifyEasyfyPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, note }: { orderId: number; note?: string }) => {
      const res = await apiClient.post(`/admin/easyfy/orders/${orderId}/verify-payment`, { note });
      return res.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-order', vars.orderId] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useRejectEasyfyPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: number; reason: string }) => {
      const res = await apiClient.post(`/admin/easyfy/orders/${orderId}/reject-payment`, { reason });
      return res.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-order', vars.orderId] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useUpdateEasyfyOrderCosts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      items,
    }: {
      orderId: number;
      items: Array<{ order_item_id: number; unit_cost: number }>;
    }) => {
      const res = await apiClient.patch(`/admin/easyfy/orders/${orderId}/costs`, { items });
      return res.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-order', vars.orderId] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-demand'] });
    },
  });
};

// --- Inventory ---
export const useAdminEasyfyInventory = () =>
  useQuery<EasyfyInventoryOverview>({
    queryKey: ['admin-easyfy-inventory'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/easyfy/inventory');
      return res.data.data;
    },
  });

export const useAdjustEasyfyStock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      variantId,
      type,
      quantity_delta,
      unit_cost,
      notes,
    }: {
      variantId: number;
      type: EasyfyStockMovementType | string;
      quantity_delta: number;
      unit_cost?: number;
      notes?: string;
    }) => {
      const res = await apiClient.post(`/admin/easyfy/inventory/${variantId}/adjust`, {
        type,
        quantity_delta,
        unit_cost,
        notes,
      });
      return res.data.data as EasyfyProductVariant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

// --- Config: Coupons, Shipping Zones & Settings ---
export const useAdminEasyfyCoupons = () =>
  useQuery<EasyfyCoupon[]>({
    queryKey: ['admin-easyfy-coupons'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/easyfy/coupons');
      return res.data.data ?? [];
    },
  });

export const useSaveEasyfyCoupon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SaveEasyfyCouponPayload) => {
      const res = payload.id
        ? await apiClient.put(`/admin/easyfy/coupons/${payload.id}`, payload)
        : await apiClient.post('/admin/easyfy/coupons', payload);
      return res.data.data as EasyfyCoupon;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useDeleteEasyfyCoupon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/admin/easyfy/coupons/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-coupons'] });
    },
  });
};

export const useAdminEasyfyShippingZones = () =>
  useQuery<EasyfyShippingZone[]>({
    queryKey: ['admin-easyfy-shipping-zones'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/easyfy/shipping-zones');
      return res.data.data ?? [];
    },
  });

export const useSaveEasyfyShippingZone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SaveEasyfyShippingZonePayload) => {
      const res = payload.id
        ? await apiClient.put(`/admin/easyfy/shipping-zones/${payload.id}`, payload)
        : await apiClient.post('/admin/easyfy/shipping-zones', payload);
      return res.data.data as EasyfyShippingZone;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-shipping-zones'] });
    },
  });
};

export const useDeleteEasyfyShippingZone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/admin/easyfy/shipping-zones/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-shipping-zones'] });
    },
  });
};

export const useAdminEasyfySettings = () =>
  useQuery<EasyfyStoreSettings>({
    queryKey: ['admin-easyfy-settings'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/easyfy/settings');
      return res.data.data;
    },
  });

export const useUpdateEasyfySettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EasyfyStoreSettings>) => {
      const res = await apiClient.put('/admin/easyfy/settings', payload);
      return res.data.data as EasyfyStoreSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-easyfy-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};
