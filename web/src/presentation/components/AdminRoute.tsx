import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../data/store/useAuthStore';

export const AdminRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // السماح فقط للمدير العام (Super Admin)
  const isAdmin = Boolean(user?.is_admin);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
