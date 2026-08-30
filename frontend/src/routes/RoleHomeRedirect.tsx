import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ROLE_PATH } from './roleRoutes';

export function RoleHomeRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_PATH[user.role] ?? '/login'} replace />;
}
