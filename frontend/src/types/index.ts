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

export type SummaryStatus = 'DRAFT_AI' | 'DRAFT_EDITED' | 'APPROVED';

export interface CourseInWard {
  id: string;
  patientId: string;
  summaryDate: string;
  summaryContent: string;
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
