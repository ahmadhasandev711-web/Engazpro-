import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../data/store/useAuthStore';
import { UserRole } from '@pos-mandob/shared';

interface RoleRouteProps {
  allowedRoles: (UserRole | string)[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role || UserRole.OWNER;
  const isAllowed = allowedRoles.includes(role);

  if (!isAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
