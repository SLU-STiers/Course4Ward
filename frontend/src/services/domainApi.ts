import { api } from './api';
import type {
  Patient,
  PhysicianOrder,
  CourseInWard,
  Claim,
  AuthUser,
} from '../types';

// --- Auth ---
export const authApi = {
  login: (userId: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string; user: AuthUser; mustResetPassword: boolean }>(
      '/auth/login',
      { userId, password },
    ),
  requestPasswordReset: (userId: string) =>
    api.post('/auth/password-reset/request', { userId }),
  confirmPasswordReset: (userId: string, resetToken: string, newPassword: string) =>
    api.post('/auth/password-reset/confirm', { userId, resetToken, newPassword }),
};

// --- Patients ---
export const patientsApi = {
  assignedToMe: () => api.get<Patient[]>('/patients/assigned-to-me'),
  getOne: (id: string) => api.get<Patient>(`/patients/${id}`),
  create: (data: Partial<Patient>) => api.post<Patient>('/patients', data),
  update: (id: string, data: Partial<Patient>) => api.patch<Patient>(`/patients/${id}`, data),
};

// --- Orders ---
export const ordersApi = {
  create: (data: {
    admissionId: string;
    orderedById: string;
    orderContent: string;
  }) => api.post<PhysicianOrder>('/orders', data),
  forPatient: (patientId: string) => api.get<PhysicianOrder[]>(`/orders/patient/${patientId}`),
};

// --- Notes ---
export const notesApi = {
  create: (data: { patientId: string; content: string; reminderAt?: string }) =>
    api.post('/notes', data),
  forPatient: (patientId: string) => api.get(`/notes/patient/${patientId}`),
  myReminders: () => api.get('/notes/reminders/me'),
};

// --- Course in the Ward (AI summaries) ---
export const courseInWardApi = {
  generate: (patientId: string) =>
    api.post<CourseInWard>('/course-in-ward/generate', { patientId }),
  edit: (id: string, editedText: string) =>
    api.patch<CourseInWard>(`/course-in-ward/${id}/edit`, { editedText }),
  regenerate: (id: string) => api.post<CourseInWard>(`/course-in-ward/${id}/regenerate`),
  approve: (id: string) => api.patch<CourseInWard>(`/course-in-ward/${id}/approve`),
  forPatient: (patientId: string) =>
    api.get<CourseInWard[]>(`/course-in-ward/patient/${patientId}`),
};

// --- Claims ---
export const claimsApi = {
  create: (courseInWardId: string) => api.post<Claim>('/claims', { courseInWardId }),
  findAll: () => api.get<Claim[]>('/claims'),
  notifyPhysician: (id: string) => api.post(`/claims/${id}/notify-physician`),
  generateCf4: (id: string) => api.post(`/claims/${id}/generate-cf4`),
};

// --- Admin ---
export const adminApi = {
  listUsers: () => api.get('/admin/users'),
  createUser: (data: any) => api.post('/admin/users', data),
  updateUser: (id: string, data: any) => api.patch(`/admin/users/${id}`, data),
  deactivateUser: (id: string) => api.delete(`/admin/users/${id}`),
  auditLogs: (params?: { skip?: number; take?: number; entityType?: string }) =>
    api.get('/admin/audit-logs', { params }),
  ordersAnalytics: (bucket: 'day' | 'week' | 'month' | 'year') =>
    api.get('/admin/audit-logs/analytics/orders', { params: { bucket } }),
  getResetRequests: () => 
    api.get('/admin/password-reset-requests'),
  
  approveResetRequest: (requestId: string) => 
    api.post(`/admin/password-reset-requests/${requestId}/approve`),
};
