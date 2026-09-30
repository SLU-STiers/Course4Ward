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

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
