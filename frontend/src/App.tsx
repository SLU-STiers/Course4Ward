import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { PhysicianDashboard } from './features/physician';
import { NurseDashboard } from './features/nurse';
import { ClaimsProcessorDashboard } from './features/claims';
import { AdminPanel } from './features/admin';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RoleHomeRedirect } from './routes/RoleHomeRedirect';
import { authApi } from './services/domainApi';
import { useAuthStore } from './store/authStore';

const queryClient = new QueryClient();

function SessionMonitor() {
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    const checkSession = () => {
      void authApi.session().catch(() => {
        // The Axios 401 interceptor clears auth state and redirects to login.
      });
    };

    checkSession();
    const intervalId = window.setInterval(checkSession, 5000);
    return () => window.clearInterval(intervalId);
  }, [accessToken]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionMonitor />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ProtectedRoute />}>
            <Route index element={<ResetPassword />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<RoleHomeRedirect />} />

              <Route element={<ProtectedRoute allowedRoles={['PHYSICIAN']} />}>
                <Route path="/physician" element={<PhysicianDashboard />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['NURSE']} />}>
                <Route path="/nurse" element={<NurseDashboard />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['CLAIMS_PROCESSOR']} />}>
                <Route path="/claims" element={<ClaimsProcessorDashboard />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="/admin" element={<AdminPanel />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
