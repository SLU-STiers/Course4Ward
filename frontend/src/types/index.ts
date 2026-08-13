export type Role = 'PHYSICIAN' | 'NURSE' | 'CLAIMS_PROCESSOR' | 'ADMIN';

export interface AuthUser {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  role: Role;
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
}

export type OrderType = 'MEDICATION' | 'ADMISSION' | 'DISCHARGE' | 'DIAGNOSTIC' | 'OTHER';

export interface PhysicianOrder {
  id: string;
  patientId: string;
  orderingPhysicianId: string;
  enteredById: string;
  enteredByRole: 'PHYSICIAN' | 'NURSE_ON_BEHALF';
  type: OrderType;
  description: string;
  frequency?: string | null;
  dosage?: string | null;
  orderDate: string;
  active: boolean;
}

export type SummaryStatus = 'DRAFT_AI' | 'DRAFT_EDITED' | 'APPROVED';

export interface CourseInWard {
  id: string;
  patientId: string;
  summaryDate: string;
  aiGeneratedText?: string | null;
  currentText: string;
  status: SummaryStatus;
  approvedById?: string | null;
  approvedAt?: string | null;
  version: number;
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
