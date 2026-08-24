import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const roleHome: Record<string, string> = {
  PHYSICIAN: '/physician',
  NURSE: '/nurse',
  CLAIMS_PROCESSOR: '/claims',
  ADMIN: '/admin',
};

export function RoleHomeRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome[user.role] ?? '/login'} replace />;
}
