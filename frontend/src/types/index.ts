export type Role = 'PHYSICIAN' | 'NURSE' | 'CLAIMS_PROCESSOR' | 'ADMIN';

export interface AuthUser {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  role: Role;
  mustResetPassword?: boolean;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  admissionDate?: string | null;
  dischargeDate?: string | null;
  initialAssessment?: string | null;
  admissions?: PatientAdmission[];
}

export interface PatientAdmission {
  id: string;
  admissionDate: string;
  dischargeDate?: string | null;
  isOutpatient?: boolean;
  initialAssessment?: string | null;
  physician?: { id?: string; firstName: string; lastName: string } | null;
}

export type OrderType = 'MEDICATION' | 'ADMISSION' | 'DISCHARGE' | 'DIAGNOSTIC' | 'OTHER';

export interface PhysicianOrder {
  id: string;
  admissionId: string;
  orderedById: string;
  encodedById: string;
  enteredByRole: 'PHYSICIAN' | 'NURSE_ON_BEHALF';
  orderContent: string;
  dateCreated: string;
  dateUpdated?: string | null;
  active: boolean;
  orderedBy?: { firstName: string; lastName: string };
  encodedBy?: { firstName: string; lastName: string; role: Role };
}

export interface PhysicianNote {
  id: string;
  notesArray: string;
  physicianId: string;
  patientId: string;
  createdAt: string;
  reminderAt?: string | null;
}

export type SummaryStatus = 'DRAFT_AI' | 'DRAFT_EDITED' | 'APPROVED';

export interface CourseInWard {
  id: string;
  patientId: string;
  summaryDate: string;
  summaryContent: string;
  orders?: PhysicianOrder[];
  aiGeneratedText?: string | null;
  currentText?: string;
  status: SummaryStatus;
  approvedById?: string | null;
  approvedAt?: string | null;
  version?: number;
}

export interface PhysicianRequest {
  id: string;
  requestedAt: string;
  status: string;
  processor: { firstName: string; lastName: string; role: Role };
  summary: CourseInWard & {
    patient: Patient;
    orders: PhysicianOrder[];
  };
}

export type ClaimStatus =
  | 'PENDING_REVIEW'
  | 'NEEDS_PHYSICIAN_VALIDATION'
  | 'VALIDATED'
  | 'CF4_GENERATED';

export interface Claim {
  id: string;
  patientId: string;
  courseInWardId: string;
  status: ClaimStatus;
  cf4Generated: boolean;
}

export interface ClaimRecord {
  id: string;
  requestedAt: string;
  status: string;
  summary: CourseInWard & {
    summaryDate: string;
    patient: Patient;
    orders: Array<PhysicianOrder & {
      admission: {
        admissionDate: string;
        dischargeDate?: string | null;
      };
      orderedBy: { firstName: string; lastName: string };
    }>;
  };
}

// --- Admin: audit log -------------------------------------------------------
// Mirrors the backend `ActionType` enum. `features/admin/activityLabels.ts`
// turns each value into the label the Activity Logs table shows.

export type AuditLogAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'ADD_NOTE'
  | 'CREATE_ORDER_NURSE'
  | 'CREATE_ORDER'
  | 'APPROVE_SUMMARY'
  | 'EDIT_SUMMARY'
  | 'REGENERATE_SUMMARY'
  | 'REQUEST_SUMMARY'
  | 'ADD_ACCOUNT'
  | 'EDIT_ACCOUNT'
  | 'DELETE_ACCOUNT'
  | 'REGISTER_PATIENT'
  | 'PATIENT_UPDATED'
  | 'PASSWORD_RESET'
  | 'CLAIM_CREATED'
  | 'CLAIM_PHYSICIAN_NOTIFIED'
  | 'CF4_GENERATED';

/** One row of `GET /admin/audit-logs`. */
export interface AuditLogEntry {
  id: string;
  timeStamp: string;
  action: AuditLogAction;
  userId: string;
  user: {
    userId: string;
    firstName: string;
    lastName: string;
    role: Role;
  };
}

/** One page of activity logs plus the total matching the same filters. */
export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  skip: number;
  take: number;
}

export interface AuditLogQuery {
  skip?: number;
  take?: number;
  action?: AuditLogAction;
  role?: Role;
  /** Actor's login id (`DOC001`). */
  userId?: string;
  /** ISO-8601; a date-only value covers that whole UTC day. */
  from?: string;
  to?: string;
  search?: string;
}

/** Dimensions the activity graph can aggregate by. */
export type AuditLogGroupBy = 'day' | 'action' | 'actor';

export interface AuditLogAggregateBucket {
  /** A UTC date for `day`, the action name, or the actor's login id. */
  key: string;
  /** Display-ready label (the UI prefers `activityLabels` wording for actions). */
  label: string;
  count: number;
}

/** The same logs as the table, counted instead of listed. */
export interface AuditLogAggregate {
  by: AuditLogGroupBy;
  /** Total matching the filters — the denominator for every bucket. */
  total: number;
  buckets: AuditLogAggregateBucket[];
  /** True when the bucket list was capped, so the UI can say so. */
  truncated: boolean;
}

export interface AuditLogAggregateQuery extends AuditLogQuery {
  by?: AuditLogGroupBy;
}

// --- Admin: reporting -------------------------------------------------------

/** A `{ key, count }` aggregate (used for the free-form string statuses). */
export interface CountBucket<K extends string = string> {
  key: K;
  count: number;
}

export type TrendBucket = 'day' | 'week' | 'month';

export interface ActivityTrendPoint {
  /** Bucket start as a UTC calendar date (`YYYY-MM-DD`) — render as-is. */
  period: string;
  activity: number;
  orders: number;
}

export interface ActivityTrend {
  range: { from: string; to: string };
  bucket: TrendBucket;
  points: ActivityTrendPoint[];
}

export interface ReportPipelineStage {
  key: string;
  label: string;
  count: number;
}

export interface ReportTopActor {
  userId: string;
  name: string;
  role: Role | null;
  count: number;
}

/** Everything the dashboard's reporting section renders. */
export interface ReportSummary {
  range: { from: string; to: string };
  census: {
    patients: number;
    admissions: number;
    activeAdmissions: number;
    dischargedAdmissions: number;
    admittedInRange: number;
  };
  users: { total: number; active: number; byRole: Record<Role, number> };
  orders: {
    inRange: number;
    today: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  summaries: { inRange: number; byStatus: Record<SummaryStatus, number> };
  claims: { inRange: number; byStatus: CountBucket[] };
  philhealthCf4: { byStatus: Record<'PENDING' | 'APPROVED' | 'REJECTED', number> };
  passwordResets: { byStatus: Record<'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED', number> };
  activity: {
    total: number;
    distinctActors: number;
    byAction: CountBucket<AuditLogAction>[];
    byRole: CountBucket<Role>[];
  };
  pipeline: ReportPipelineStage[];
  topActors: ReportTopActor[];
}

/** Body accepted by the admin account endpoints. */
export interface AdminUserInput {
  firstName: string;
  lastName: string;
  role?: string;
  temporaryPassword?: string;
  isActive?: boolean;
}

/** Lifecycle of a password reset request (`ResetStatus` on the backend). */
export type ResetStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

/** Account row returned by `GET /admin/users` (the password hash is never selected). */
export interface StaffAccount {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  mustResetPassword: boolean;
  createdAt: string;
}

/** Row returned by `GET /admin/password-reset-requests`, with its requester. */
export interface PasswordResetRequestRow {
  id: string;
  userId: string;
  ipAddress: string | null;
  temporaryPassword: string | null;
  requestedAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  status: ResetStatus;
  user: { userId: string; firstName: string; lastName: string; role: Role };
}

/** Response body of the admin approve-reset endpoint. */
export interface PasswordResetApproval {
  message: string;
  temporaryPassword: string;
  user: { userId: string; firstName: string; lastName: string };
}
