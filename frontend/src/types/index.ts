export type Role = 'PHYSICIAN' | 'NURSE' | 'CLAIMS_PROCESSOR' | 'ADMIN';

export type NotificationType = 'REVIEW_REQUESTED' | 'GENERAL';

/**
 * In-app notification for the header bell. `REVIEW_REQUESTED` is raised when a
 * claims processor sends a reminder from the review modal.
 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Claim / summary approval request this notification points at, if any. */
  requestId?: string | null;
  isRead: boolean;
  createdAt: string;
  /** Set when the bell was cleared — the item then only shows in history. */
  clearedAt?: string | null;
}

/** Which slice of the notification list the bell panel is showing. */
export type NotificationScope = 'inbox' | 'history';

export interface AuthUser {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  role: Role;
  mustResetPassword?: boolean;
}

/** Backend `Sex`; `null` on records registered before it was required. */
export type Sex = 'MALE' | 'FEMALE' | 'OTHER';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  gender: Sex | null;
  dateOfBirth: string;
  admissionDate?: string | null;
  dischargeDate?: string | null;
  initialAssessment?: string | null;
  admissions?: PatientAdmission[];
}

/**
 * Backend `PatientClass`. EMERGENCY / OUTPATIENT need no order; OBSERVATION
 * and INPATIENT need a physician's observation / admission order.
 */
export type PatientClass = 'EMERGENCY' | 'OUTPATIENT' | 'OBSERVATION' | 'INPATIENT';

export interface PatientAdmission {
  id: string;
  admissionDate: string;
  dischargeDate?: string | null;
  /** Kind of encounter; see `PatientClass`. */
  patientClass?: PatientClass;
  /** When the admission entered its current class (e.g. start of observation). */
  classSince?: string;
  initialAssessment?: string | null;
  physician?: { id?: string; firstName: string; lastName: string } | null;
  additionalPhysicians?: { physician: { id: string; firstName: string; lastName: string } }[];
  /** Physician payloads carry only `triageLevel`; nurse payloads the full row. */
  triage?: AdmissionTriage | null;
}

/** 5-level triage priority, 1 (Resuscitation) to 5 (Non-Urgent). */
export type TriageLevel = 1 | 2 | 3 | 4 | 5;

export interface AdmissionTriage {
  triageLevel: TriageLevel | null;
  triageTime: string | null;
  heartRate: number | null;
  respRate: number | null;
  spo2: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  /** Prisma Decimal — serialized as a string. */
  temperature: string | number | null;
  painScore: number | null;
  createdAt: string;
}

/** Nurse execution state of an order (backend `OrderStatus`). */
export type OrderStatus = 'TO_ACCOMPLISH' | 'ONGOING' | 'FINISHED';

/** Backend `OrderType`: `DEFAULT` is a general order. */
export type OrderType = 'DEFAULT' | 'OBSERVATION' | 'ADMISSION' | 'DISCHARGE';

export interface PhysicianOrder {
  id: string;
  admissionId: string;
  orderedById: string;
  encodedById: string;
  enteredByRole: 'PHYSICIAN' | 'NURSE_ON_BEHALF';
  orderContent: string;
  /** Omitted by older payloads; treat as `DEFAULT`. */
  type?: OrderType;
  dateCreated: string;
  dateUpdated?: string | null;
  active: boolean;
  status: OrderStatus;
  nurseComment?: string | null;
  executedAt?: string | null;
  executedBy?: { firstName: string; lastName: string } | null;
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

/** A Course in the Ward no claim has been opened for (`GET /claims/eligible-summaries`). */
export interface EligibleSummary {
  id: string;
  summaryDate: string;
  status: SummaryStatus;
  summaryContent: string;
  patient: { id: string; firstName: string; lastName: string };
  approvedBy?: { firstName: string; lastName: string } | null;
  orders: Array<{ dateCreated: string; orderedBy: { firstName: string; lastName: string } }>;
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
  | 'CF4_GENERATED'
  | 'UPDATE_ORDER_STATUS';

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
  requestedAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  status: ResetStatus;
  user: { userId: string; firstName: string; lastName: string; role: Role };
}

/** Filters and paging for the admin password reset requests table. */
export interface PasswordResetQuery {
  skip?: number;
  take?: number;
  status?: ResetStatus;
  search?: string;
  sort?: 'date' | 'name';
  direction?: 'asc' | 'desc';
}

/** One page of password reset requests; `total` is the full filtered count. */
export interface PasswordResetRequestPage {
  items: PasswordResetRequestRow[];
  total: number;
  skip: number;
  take: number;
}

/** Response body of the admin approve-reset endpoint. */
export interface PasswordResetApproval {
  message: string;
  temporaryPassword: string;
  user: { userId: string; firstName: string; lastName: string };
}
