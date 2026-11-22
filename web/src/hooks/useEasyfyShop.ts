import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../data/api/client';
import type {
  EasyfyCart,
  EasyfyCheckoutPreview,
  EasyfyOrder,
  EasyfyOrderStatus,
  EasyfyPaymentMethod,
  EasyfyProduct,
  EasyfyStockMode,
  EasyfyStoreAddress,
  EasyfyStorefrontPayload,
} from '@pos-mandob/shared';

export interface ShopPaginatedResult<T> {
  items: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

function normalizeShopPaginated<T>(payload: any): ShopPaginatedResult<T> {
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

export const useEasyfyStorefront = () =>
  useQuery<EasyfyStorefrontPayload>({
    queryKey: ['easyfy-storefront'],
    queryFn: async () => {
      const res = await apiClient.get('/easyfy/storefront');
      return res.data.data;
    },
  });

export interface EasyfyProductFilters {
  category_id?: number | '';
  stock_mode?: EasyfyStockMode | '';
  search?: string;
  page?: number;
  per_page?: number;
}

export const useEasyfyProducts = (filters: EasyfyProductFilters) =>
  useQuery<ShopPaginatedResult<EasyfyProduct>>({
    queryKey: ['easyfy-products', filters],
    queryFn: async () => {
      const res = await apiClient.get('/easyfy/products', {
        params: {
          category_id: filters.category_id || undefined,
          stock_mode: filters.stock_mode || undefined,
          search: filters.search || undefined,
          page: filters.page || 1,
          per_page: filters.per_page || 20,
        },
      });
      return normalizeShopPaginated<EasyfyProduct>(res.data);
    },
  });

export const useEasyfyProductDetail = (slugOrId?: string) =>
  useQuery<EasyfyProduct>({
    queryKey: ['easyfy-product', slugOrId],
    queryFn: async () => {
      const res = await apiClient.get(`/easyfy/products/${slugOrId}`);
      return res.data.data;
    },
    enabled: Boolean(slugOrId),
  });

export const useEasyfyCart = () =>
  useQuery<EasyfyCart>({
    queryKey: ['easyfy-cart'],
    queryFn: async () => {
      const res = await apiClient.get('/easyfy/cart');
      return res.data.data;
    },
  });

export const useAddToEasyfyCart = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      variant_id: number;
      quantity: number;
      custom_note?: string | null;
    }) => {
      const res = await apiClient.post('/easyfy/cart/items', payload);
      return res.data.data as EasyfyCart;
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(['easyfy-cart'], cart);
    },
  });
};

export const useUpdateEasyfyCartItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      quantity,
      custom_note,
    }: {
      itemId: number;
      quantity: number;
      custom_note?: string | null;
    }) => {
      const res = await apiClient.put(`/easyfy/cart/items/${itemId}`, { quantity, custom_note });
      return res.data.data as EasyfyCart;
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(['easyfy-cart'], cart);
    },
  });
};

export const useRemoveEasyfyCartItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: number) => {
      const res = await apiClient.delete(`/easyfy/cart/items/${itemId}`);
      return res.data.data as EasyfyCart;
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(['easyfy-cart'], cart);
    },
  });
};

export const useUploadEasyfyCartArtwork = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, file }: { itemId: number; file: File }) => {
      const form = new FormData();
      form.append('artwork', file);
      const res = await apiClient.post(`/easyfy/cart/items/${itemId}/artwork`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data as EasyfyCart;
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(['easyfy-cart'], cart);
    },
  });
};

export const useEasyfyCheckoutPreview = (
  shippingZoneId: number | null,
  couponCode: string,
  enabled: boolean
) =>
  useQuery<EasyfyCheckoutPreview>({
    queryKey: ['easyfy-checkout-preview', shippingZoneId, couponCode],
    queryFn: async () => {
      const res = await apiClient.post('/easyfy/checkout/preview', {
        shipping_zone_id: shippingZoneId || null,
        coupon_code: couponCode.trim() || null,
      });
      return res.data.data;
    },
    enabled,
    retry: false,
  });

// --- Addresses ---
export const useEasyfyAddresses = () =>
  useQuery<EasyfyStoreAddress[]>({
    queryKey: ['easyfy-addresses'],
    queryFn: async () => {
      const res = await apiClient.get('/easyfy/addresses');
      return res.data.data ?? [];
    },
  });

export interface SaveEasyfyAddressPayload {
  id?: number;
  label: string;
  recipient_name: string;
  recipient_phone: string;
  shipping_zone_id?: number | null;
  governorate: string;
  address_line: string;
  notes?: string | null;
  is_default?: boolean;
}

export const useSaveEasyfyAddress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SaveEasyfyAddressPayload) => {
      const res = payload.id
        ? await apiClient.put(`/easyfy/addresses/${payload.id}`, payload)
        : await apiClient.post('/easyfy/addresses', payload);
      return res.data.data as EasyfyStoreAddress;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['easyfy-addresses'] });
    },
  });
};

export const useDeleteEasyfyAddress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/easyfy/addresses/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['easyfy-addresses'] });
    },
  });
};

// --- Orders ---
export interface EasyfyOrderFilters {
  status?: EasyfyOrderStatus | '';
  search?: string;
  page?: number;
}

export const useEasyfyOrders = (filters: EasyfyOrderFilters) =>
  useQuery<ShopPaginatedResult<EasyfyOrder>>({
    queryKey: ['easyfy-orders', filters],
    queryFn: async () => {
      const res = await apiClient.get('/easyfy/orders', {
        params: {
          status: filters.status || undefined,
          search: filters.search || undefined,
          page: filters.page || 1,
        },
      });
      return normalizeShopPaginated<EasyfyOrder>(res.data);
    },
  });

export const useEasyfyOrderDetail = (id?: number | string) =>
  useQuery<EasyfyOrder>({
    queryKey: ['easyfy-order', id],
    queryFn: async () => {
      const res = await apiClient.get(`/easyfy/orders/${id}`);
      return res.data.data;
    },
    enabled: Boolean(id),
  });

export interface CheckoutEasyfyOrderInput {
  recipient_name: string;
  recipient_phone: string;
  shipping_zone_id?: number | null;
  governorate: string;
  shipping_address: string;
  customer_notes?: string | null;
  coupon_code?: string | null;
  payment_method: EasyfyPaymentMethod;
  transfer_reference?: string | null;
  payment_proof?: File | null;
  idempotency_key: string;
}

export const useCheckoutEasyfyOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CheckoutEasyfyOrderInput) => {
      const form = new FormData();
      form.append('recipient_name', input.recipient_name);
      form.append('recipient_phone', input.recipient_phone);
      if (input.shipping_zone_id) {
        form.append('shipping_zone_id', String(input.shipping_zone_id));
      }
      form.append('governorate', input.governorate);
      form.append('shipping_address', input.shipping_address);
      if (input.customer_notes) form.append('customer_notes', input.customer_notes);
      if (input.coupon_code) form.append('coupon_code', input.coupon_code);
      form.append('payment_method', input.payment_method);
      if (input.transfer_reference) form.append('transfer_reference', input.transfer_reference);
      if (input.payment_proof) form.append('payment_proof', input.payment_proof);
      form.append('idempotency_key', input.idempotency_key);

      const res = await apiClient.post('/easyfy/orders', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data as EasyfyOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['easyfy-cart'] });
      queryClient.invalidateQueries({ queryKey: ['easyfy-orders'] });
      queryClient.invalidateQueries({ queryKey: ['easyfy-products'] });
    },
  });
};

export const useReorderEasyfyOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiClient.post(`/easyfy/orders/${orderId}/reorder`);
      return {
        cart: res.data.data as EasyfyCart,
        skipped_items: (res.data.skipped_items ?? []) as Array<{
          product_name: string;
          reason: string;
        }>,
      };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['easyfy-cart'], result.cart);
    },
  });
};

export const useReuploadEasyfyPaymentProof = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      transfer_reference,
      payment_proof,
    }: {
      orderId: number;
      transfer_reference: string;
      payment_proof: File;
    }) => {
      const form = new FormData();
      form.append('transfer_reference', transfer_reference);
      form.append('payment_proof', payment_proof);
      const res = await apiClient.post(`/easyfy/orders/${orderId}/reupload-proof`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data as EasyfyOrder;
    },
    onSuccess: (order) => {
      queryClient.setQueryData(['easyfy-order', String(order.id)], order);
      queryClient.invalidateQueries({ queryKey: ['easyfy-orders'] });
    },
  });
};
