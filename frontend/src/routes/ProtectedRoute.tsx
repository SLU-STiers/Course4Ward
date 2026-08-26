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

  // In local `npm run dev`, switch modules by changing the URL
  // (/physician, /nurse, /claims, /admin) without a role gate.
  if (import.meta.env.DEV) {
    return <Outlet />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
