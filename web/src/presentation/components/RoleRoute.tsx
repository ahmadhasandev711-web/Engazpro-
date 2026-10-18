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

  const role = (user?.role as UserRole | string | undefined) || UserRole.OWNER;
  const isAllowed = allowedRoles.some(
    (allowed) => String(allowed) === String(role)
  );

  if (!isAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
