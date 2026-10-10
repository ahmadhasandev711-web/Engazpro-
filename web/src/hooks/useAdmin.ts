import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../data/api/client';
import { AdminStatsData, LicenseKey, User } from '@pos-mandob/shared';

export const useAdminStats = () => {
  return useQuery<AdminStatsData>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/stats');
      return res.data.data;
    },
  });
};

export const useAdminLicenses = (statusFilter: 'all' | 'unused' | 'used' | 'revoked', search: string) => {
  return useQuery<LicenseKey[]>({
    queryKey: ['admin-licenses', statusFilter, search],
    queryFn: async () => {
      const res = await apiClient.get('/admin/licenses', {
        params: {
          status: statusFilter,
          search: search || undefined,
        },
      });
      const data = res.data.data;
      return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    },
  });
};

export const useAdminUsers = (search: string) => {
  return useQuery<User[]>({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      const res = await apiClient.get('/admin/users', {
        params: {
          search: search || undefined,
        },
      });
      const data = res.data.data;
      return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    },
  });
};

export const useGenerateLicenses = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { count: number; duration_days: number; notes: string }) => {
      const res = await apiClient.post('/admin/licenses/generate', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-licenses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
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
    },
  });
};

export const useExtendUserSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, days, notes }: { userId: number; days: number; notes: string }) => {
      const res = await apiClient.post(`/admin/users/${userId}/extend`, {
        days,
        notes,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
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
    },
  });
};

