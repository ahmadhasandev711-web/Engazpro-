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
