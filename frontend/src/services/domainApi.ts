import { api } from './api';
import type {
  Patient,
  PhysicianOrder,
  PhysicianNote,
  CourseInWard,
  Claim,
  ClaimRecord,
  AuthUser,
  PhysicianRequest,
} from '../types';

// --- Auth ---
export const authApi = {
  session: () => api.get<{ authenticated: boolean }>('/auth/session'),
  login: (userId: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string; user: AuthUser; mustResetPassword: boolean }>(
      '/auth/login',
      { userId, password },
    ),
  requestPasswordReset: (userId: string) =>
    api.post<{ message: string; resetToken: string }>('/auth/password-reset/request', { userId }),
  passwordResetStatus: (resetToken: string) =>
    api.get<{ status: string; temporaryPassword?: string | null }>('/auth/password-reset/status', {
      params: { resetToken },
    }),
  confirmPasswordReset: (userId: string, resetToken: string, newPassword: string) =>
    api.post('/auth/password-reset/confirm', { userId, resetToken, newPassword }),
  changePassword: (newPassword: string) =>
    api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
      '/auth/password-change',
      { newPassword },
    ),
};

// --- Patients ---
export const patientsApi = {
  assignedToMe: () => api.get<Patient[]>('/patients/assigned-to-me'),
  nurseAssigned: () => api.get<Patient[]>('/patients/nurse-assigned'),
  getOne: (id: string) => api.get<Patient>(`/patients/${id}`),
  create: (data: Partial<Patient>) => api.post<Patient>('/patients', data),
  update: (id: string, data: Partial<Patient>) => api.patch<Patient>(`/patients/${id}`, data),
  discharge: (admissionId: string) => api.patch(`/patients/admissions/${admissionId}/discharge`),
};

// --- Orders ---
export const ordersApi = {
  create: (data: {
    admissionId: string;
    orderedById: string;
    orderContent: string;
  }) => api.post<PhysicianOrder>('/orders', data),
  update: (id: string, orderContent: string) =>
    api.patch<PhysicianOrder>(`/orders/${id}`, { orderContent }),
  remove: (id: string) => api.delete(`/orders/${id}`),
  forPatient: (patientId: string) => api.get<PhysicianOrder[]>(`/orders/patient/${patientId}`),
};

// --- Notes ---
export const notesApi = {
  create: (data: { patientId: string; content: string; reminderAt?: string }) =>
    api.post<PhysicianNote>('/notes', data),
  update: (id: string, data: { content?: string; reminderAt?: string | null }) =>
    api.patch<PhysicianNote>(`/notes/${id}`, data),
  remove: (id: string) => api.delete(`/notes/${id}`),
  forPatient: (patientId: string) => api.get<PhysicianNote[]>(`/notes/patient/${patientId}`),
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
  findAll: () => api.get<ClaimRecord[]>('/claims'),
  physicianRequests: () => api.get<PhysicianRequest[]>('/claims/physician-requests'),
  approvePhysicianRequest: (id: string) => api.patch(`/claims/${id}/approve`),
  notifyPhysician: (id: string) => api.post(`/claims/${id}/notify-physician`),
  generateCf4: (id: string) => api.post(`/claims/${id}/generate-cf4`),
};

// --- Admin ---
export const adminApi = {
  listUsers: () => api.get('/admin/users'),
  createUser: (data: any) => api.post('/admin/users', data),
  updateUser: (id: string, data: any) => api.patch(`/admin/users/${id}`, data),
  auditLogs: (params?: { skip?: number; take?: number }) =>
    api.get('/admin/audit-logs', { params }),
  analyticsSummary: () => api.get('/admin/audit-logs/analytics/summary'),
  ordersAnalytics: (bucket: 'day' | 'week' | 'month' | 'year') =>
    api.get('/admin/audit-logs/analytics/orders', { params: { bucket } }),
  getResetRequests: () =>
    api.get('/admin/password-reset-requests'),
  approveResetRequest: (requestId: string) =>
    api.post(`/admin/password-reset-requests/${requestId}/approve`),
};
