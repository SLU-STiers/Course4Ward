/** Part of the claims dashboard — see index.tsx for the screen shell. */

import type { OrderExecutionState } from '../../components/orders/orderStatus';
import type { TriageDisplay } from '../../lib/triage';


export type TabType = 'overview' | 'requests' | 'export';
export type ExportSubView = 'selection' | 'new-cf4' | 'existing-cf4' | 'summary';
/** Which export workflow a Course in the Ward Summary is being built from. */
export type ExportSource = 'new-cf4' | 'existing-cf4';
export type PatientSortField = 'name' | 'admissionDate' | 'daysInCare' | 'age';
export type SortDirection = 'ascending' | 'descending';
export type RequestSortField = 'id' | 'date' | 'status';
export type PatientStatus = 'all' | 'admitted' | 'discharged';
export interface SummarizationRequest {
  id: string;
  submittedAt: string;
  summaryDate: string;
  admissionId: string;
  doctor: string;
  date: string;
  time: string;
  status: 'Pending Review' | 'Approved' | 'Rejected';
  patient: {
    name: string;
    initials: string;
    patientId: string;
    age: number;
    gender: string;
    admissionDate: string;
  };
  summaryText: string;
  /** Triage assessment recorded when the patient was registered for this admission. */
  triage: TriageDisplay;
  /**
   * `id` is the physician order's own id — unique per order, never per claim.
   * Carries the nurse's execution state (`OrderExecutionState`) so the timeline
   * can render the same status badge, type tag, executor and note the physician
   * sees, not just the raw order text.
   */
  orders: Array<
    OrderExecutionState & {
      id: string;
      content: string;
      dateCreated: string;
      doctor: string;
    }
  >;
}
export interface CF4Patient {
  id: string;
  claimId: string;
  claimIds: string[];
  admissionId: string;
  patientId: string;
  name: string;
  gender: string;
  /** Years old, or `null` when the date of birth is missing. */
  age: number | null;
  color: string;
  /** Short display date, e.g. `Apr 15, 2026`. */
  admissionDate: string;
  /** `YYYY-MM-DD` — the key used for sorting and date-range filters. */
  admissionDateRaw: string;
  /** Latest summary or discharge date included in the patient-wide CF4. */
  coverageEndDateRaw: string;
  /** Latest discharge date across admissions, or `null` if an admission is ongoing. */
  dischargeDateRaw: string | null;
  /** Date span covered by the included admissions and summaries. */
  coveragePeriod: string;
  /** Whole days in care, counted inclusively and summed across admissions. */
  daysInCare: number;
  status: Exclude<PatientStatus, 'all'>;
  approved: boolean;
}

/** One patient queued for the Course in the Ward Summary review step. */
export interface Cf4SummaryDraft {
  patient: CF4Patient;
  /** All physician-approved daily summaries from the patient's admissions. */
  requests: SummarizationRequest[];
}
