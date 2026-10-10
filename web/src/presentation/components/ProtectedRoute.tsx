import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../data/store/useAuthStore';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, fetchMe, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchMe();
    }
  }, [isAuthenticated, user, fetchMe]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
