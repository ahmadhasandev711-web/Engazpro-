import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../data/api/client';
import { usePermissions } from '../../hooks/usePermissions';
import { OwnerDashboard, DashboardData } from '../components/dashboard/OwnerDashboard';
import { MandobDashboard } from '../components/dashboard/MandobDashboard';
import { CashierDashboard } from '../components/dashboard/CashierDashboard';

export const DashboardPage: React.FC = () => {
  const { user, isMandob, isCashier } = usePermissions();

  const { data, isLoading, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard');
      return res.data?.data;
    },
    refetchInterval: 30000,
  });

  if (isMandob) {
    return (
      <MandobDashboard
        data={data}
        isLoading={isLoading}
        isFetching={isFetching}
        refetch={refetch}
        userName={user?.name}
      />
    );
  }

  if (isCashier) {
    return (
      <CashierDashboard
        data={data}
        isLoading={isLoading}
        isFetching={isFetching}
        refetch={refetch}
        userName={user?.name}
      />
    );
  }

  return (
    <OwnerDashboard
      data={data}
      isLoading={isLoading}
      isFetching={isFetching}
      refetch={refetch}
    />
  );
};
