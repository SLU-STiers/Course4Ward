import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { Role } from '../types';

interface Props {
  allowedRoles?: Role[];
}

export function ProtectedRoute({ allowedRoles }: Props) {
  const location = useLocation();
  const { accessToken, user } = useAuthStore();

  if (!accessToken || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
