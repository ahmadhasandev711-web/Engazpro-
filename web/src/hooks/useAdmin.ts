import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../data/api/client';
import { AdminAuditLogItem, AdminStatsData, LicenseKey, User } from '@pos-mandob/shared';

export interface AdminPaginatedResponse<T> {
  items: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

function normalizePaginated<T>(raw: any): AdminPaginatedResponse<T> {
  if (Array.isArray(raw)) {
    return {
      items: raw,
      current_page: 1,
      last_page: 1,
      per_page: raw.length || 30,
      total: raw.length,
    };
  }
  const items = Array.isArray(raw?.data) ? raw.data : [];
  return {
    items,
    current_page: Number(raw?.current_page ?? 1),
    last_page: Number(raw?.last_page ?? 1),
    per_page: Number(raw?.per_page ?? 30),
    total: Number(raw?.total ?? items.length),
  };
}

export type AdminUserStatusFilter = 'all' | 'active' | 'inactive' | 'expired' | 'trial';

export const useAdminStats = () => {
  return useQuery<AdminStatsData>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/stats');
      return res.data.data;
    },
  });
};

export const useAdminLicenses = (
  statusFilter: 'all' | 'unused' | 'used' | 'revoked',
  search: string,
  page: number = 1
) => {
  return useQuery<AdminPaginatedResponse<LicenseKey>>({
    queryKey: ['admin-licenses', statusFilter, search, page],
    queryFn: async () => {
      const res = await apiClient.get('/admin/licenses', {
        params: {
          status: statusFilter,
          search: search || undefined,
          page,
        },
      });
      return normalizePaginated<LicenseKey>(res.data.data);
    },
  });
};

export const useAdminUsers = (
  statusFilter: AdminUserStatusFilter,
  search: string,
  page: number = 1
) => {
  return useQuery<AdminPaginatedResponse<User>>({
    queryKey: ['admin-users', statusFilter, search, page],
    queryFn: async () => {
      const res = await apiClient.get('/admin/users', {
        params: {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search || undefined,
          page,
        },
      });
      return normalizePaginated<User>(res.data.data);
    },
  });
};

export const useAdminAuditLogs = (actionFilter: string, search: string, page: number = 1) => {
  return useQuery<AdminPaginatedResponse<AdminAuditLogItem>>({
    queryKey: ['admin-audit-logs', actionFilter, search, page],
    queryFn: async () => {
      const res = await apiClient.get('/admin/audit-logs', {
        params: {
          action: actionFilter !== 'all' ? actionFilter : undefined,
          search: search || undefined,
          page,
        },
      });
      return normalizePaginated<AdminAuditLogItem>(res.data.data);
    },
  });
};

export const useGenerateLicenses = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      count: number;
      duration_days: number;
      notes: string;
      price?: number | null;
      ecommerce_enabled?: boolean;
    }) => {
      const res = await apiClient.post('/admin/licenses/generate', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-licenses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useRevokeLicense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (licenseId: number) => {
      const res = await apiClient.post(`/admin/licenses/${licenseId}/revoke`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-licenses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useExtendUserSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      days,
      notes,
      price,
    }: {
      userId: number;
      days: number;
      notes: string;
      price?: number | null;
    }) => {
      const res = await apiClient.post(`/admin/users/${userId}/extend`, {
        days,
        notes,
        price: price ?? undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useRevokeSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, notes }: { userId: number; notes?: string }) => {
      const res = await apiClient.post(`/admin/users/${userId}/revoke-subscription`, {
        notes,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useForceLogoutStore = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiClient.post(`/admin/users/${userId}/force-logout`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useToggleUserStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiClient.post(`/admin/users/${userId}/toggle-status`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useResetUserPassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, password }: { userId: number; password: string }) => {
      const res = await apiClient.post(`/admin/users/${userId}/reset-password`, {
        password,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useToggleUserEcommerce = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiClient.post(`/admin/users/${userId}/toggle-ecommerce`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export interface StoreStaffData {
  owner: {
    id: number;
    name: string;
    phone: string;
    email?: string;
    business_name: string;
    status: string;
  };
  branches: Array<{
    id: number;
    name: string;
    code: string;
    type: string;
    phone?: string;
    is_main: boolean;
    is_active: boolean;
    users_count?: number;
  }>;
  employees: Array<{
    id: number;
    name: string;
    phone: string;
    email?: string;
    role?: string;
    status?: string;
    branch?: {
      id: number;
      name: string;
      code: string;
    };
    created_at: string;
  }>;
}

export const useStoreStaff = (userId: number | null) => {
  return useQuery<StoreStaffData>({
    queryKey: ['admin-store-staff', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user id provided');
      const res = await apiClient.get(`/admin/users/${userId}/staff`);
      return res.data.data;
    },
    enabled: !!userId,
  });
};

export interface StoreInquiry {
  id: number;
  name: string;
  phone: string;
  business_type: string;
  city?: string | null;
  notes?: string | null;
  status: 'NEW' | 'CONTACTED' | 'CONTRACTED' | 'CLOSED';
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export const useAdminInquiries = (statusFilter?: string, search?: string) => {
  return useQuery<StoreInquiry[]>({
    queryKey: ['admin-inquiries', statusFilter, search],
    queryFn: async () => {
      const res = await apiClient.get('/admin/inquiries', {
        params: {
          status: statusFilter && statusFilter !== 'all' ? statusFilter : undefined,
          search: search || undefined,
        },
      });
      const data = res.data.data;
      return Array.isArray(data) ? data : [];
    },
  });
};

export const useUpdateInquiryStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      admin_notes,
    }: {
      id: number;
      status: 'NEW' | 'CONTACTED' | 'CONTRACTED' | 'CLOSED';
      admin_notes?: string;
    }) => {
      const res = await apiClient.patch(`/admin/inquiries/${id}`, {
        status,
        admin_notes,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

import { DEFAULT_PUBLIC_PRICING, type PublicPricingData } from './usePublicPricing';

export interface UpdatePlatformPricingPayload {
  basic_monthly_price: number;
  basic_annual_price: number;
  pro_monthly_price: number;
  pro_annual_price: number;
  trial_days: number;
}

export const useAdminPricing = () => {
  return useQuery<PublicPricingData>({
    queryKey: ['admin-pricing'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: PublicPricingData }>('/admin/pricing');
      return res.data.data;
    },
    initialData: DEFAULT_PUBLIC_PRICING,
    staleTime: 1000 * 60 * 5,
  });
};

export const useUpdateAdminPricing = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdatePlatformPricingPayload) => {
      const res = await apiClient.put<{ success: boolean; message: string; data: PublicPricingData }>(
        '/admin/pricing',
        payload
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['public-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useDeleteInquiry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/admin/inquiries/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export interface StoreManageDetails {
  owner: {
    id: number;
    store_code?: string;
    name: string;
    business_name?: string | null;
    phone: string;
    email?: string | null;
    status: string;
    ecommerce_enabled: boolean;
    subscription?: {
      id: number;
      plan: string;
      status: string;
      end_date: string;
    } | null;
  };
  branches: Array<{
    id: number;
    name: string;
    code: string;
    is_main: boolean;
    is_active: boolean;
  }>;
  woocommerce?: {
    id: number;
    store_url: string;
    has_credentials: boolean;
    has_webhook_secret: boolean;
    online_branch_id?: number | null;
    auto_sync_stock: boolean;
    auto_sync_prices: boolean;
    auto_sync_promotions: boolean;
    is_active: boolean;
    last_synced_at?: string | null;
  } | null;
  shopify?: {
    id: number;
    shop_domain: string;
    has_token: boolean;
    has_webhook_secret: boolean;
    online_branch_id?: number | null;
    auto_sync_stock: boolean;
    auto_sync_prices: boolean;
    auto_sync_promotions: boolean;
    is_active: boolean;
    last_synced_at?: string | null;
  } | null;
  easyorders?: {
    id: number;
    store_id?: string | null;
    store_name?: string | null;
    auth_mode?: string;
    has_api_key: boolean;
    has_webhook_secret: boolean;
    default_branch_id?: number | null;
    auto_sync_stock: boolean;
    is_active: boolean;
    last_synced_at?: string | null;
  } | null;
}

export const useStoreManageDetails = (userId: number | null) => {
  return useQuery<StoreManageDetails>({
    queryKey: ['admin-store-manage', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No store selected');
      const res = await apiClient.get(`/admin/users/${userId}/manage`);
      return res.data.data;
    },
    enabled: !!userId,
  });
};

export const useUpdateMerchantProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: number;
      payload: { store_code?: string; name: string; business_name?: string; phone: string; email?: string; plan?: string };
    }) => {
      const res = await apiClient.put(`/admin/users/${userId}/profile`, payload);
      return res.data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-manage', vars.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useConfigureStoreWooCommerce = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: number;
      payload: {
        store_url: string;
        consumer_key?: string;
        consumer_secret?: string;
        webhook_secret?: string;
        online_branch_id?: number | null;
        auto_sync_stock: boolean;
        auto_sync_prices: boolean;
        auto_sync_promotions: boolean;
        is_active: boolean;
      };
    }) => {
      const res = await apiClient.put(`/admin/users/${userId}/ecommerce/woocommerce`, payload);
      return res.data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-manage', vars.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useConfigureStoreShopify = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: number;
      payload: {
        shop_domain: string;
        access_token?: string;
        client_id?: string;
        client_secret?: string;
        webhook_secret?: string;
        online_branch_id?: number | null;
        auto_sync_stock: boolean;
        auto_sync_prices: boolean;
        auto_sync_promotions: boolean;
        is_active: boolean;
      };
    }) => {
      const res = await apiClient.put(`/admin/users/${userId}/ecommerce/shopify`, payload);
      return res.data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-manage', vars.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useConfigureStoreEasyOrders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: number;
      payload: {
        store_id?: string | null;
        store_name?: string | null;
        api_key?: string;
        webhook_secret?: string;
        default_branch_id?: number | null;
        auto_sync_stock: boolean;
        is_active: boolean;
      };
    }) => {
      const res = await apiClient.put(`/admin/users/${userId}/ecommerce/easyorders`, payload);
      return res.data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-manage', vars.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useRemoveStoreEcommerce = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      platform,
      disableAddon = false,
    }: {
      userId: number;
      platform: 'woocommerce' | 'shopify' | 'easyorders';
      disableAddon?: boolean;
    }) => {
      const res = await apiClient.delete(
        `/admin/users/${userId}/ecommerce/${platform}?disable_addon=${disableAddon ? 'true' : 'false'}`
      );
      return res.data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-manage', vars.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useTestStoreEcommerce = () => {
  return useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiClient.post(`/admin/users/${userId}/ecommerce/test`);
      return res.data;
    },
  });
};

export const useImpersonateStore = () => {
  return useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiClient.post(`/admin/users/${userId}/impersonate`);
      return res.data.data as { user: User; token: string; impersonated_by: string };
    },
  });
};

export const useResetStaffPassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ownerId, staffId, password }: { ownerId: number; staffId: number; password: string }) => {
      const res = await apiClient.post(`/admin/users/${ownerId}/staff/${staffId}/reset-password`, { password });
      return res.data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-staff', vars.ownerId] });
      queryClient.invalidateQueries({ queryKey: ['admin-password-reset-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useToggleStaffStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ownerId, staffId }: { ownerId: number; staffId: number }) => {
      const res = await apiClient.post(`/admin/users/${ownerId}/staff/${staffId}/toggle-status`);
      return res.data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-staff', vars.ownerId] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useForceLogoutStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ownerId, staffId }: { ownerId: number; staffId: number }) => {
      const res = await apiClient.post(`/admin/users/${ownerId}/staff/${staffId}/force-logout`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export interface QueueOverviewData {
  pending_count: number;
  failed_count: number;
  failed_items: Array<{
    id: number;
    uuid: string;
    queue: string;
    job_name: string;
    error_summary: string;
    failed_at: string;
  }>;
}

export const useAdminQueueOverview = () => {
  return useQuery<QueueOverviewData>({
    queryKey: ['admin-queue-overview'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/system/queue');
      return res.data.data;
    },
  });
};

export const useRetryFailedJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (uuid: string) => {
      const res = await apiClient.post(`/admin/system/queue/retry/${uuid}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-queue-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useRetryAllFailedJobs = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/admin/system/queue/retry-all');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-queue-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export const useFlushFailedJobs = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/admin/system/queue/flush');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-queue-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
};

export interface PasswordResetRequestItem {
  id: number;
  user_id: number | null;
  owner_id: number | null;
  phone: string;
  requester_role?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
    phone: string;
    email?: string | null;
    business_name?: string | null;
    role?: string | null;
    branch?: { id: number; name: string } | null;
  } | null;
}

export const useAdminPasswordResetRequests = () => {
  return useQuery<PasswordResetRequestItem[]>({
    queryKey: ['admin-password-reset-requests'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/password-reset-requests');
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });
};

export const useDismissAdminPasswordResetRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiClient.post(`/admin/password-reset-requests/${requestId}/dismiss`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-password-reset-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
};
