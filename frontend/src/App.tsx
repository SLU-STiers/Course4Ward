import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './pages/Login';
import { PhysicianDashboard } from './pages/PhysicianDashboard';
import { NurseDashboard } from './pages/NurseDashboard';
import { ClaimsProcessorDashboard } from './pages/ClaimsProcessorDashboard';
import { AdminPanel } from './pages/AdminPanel';
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
