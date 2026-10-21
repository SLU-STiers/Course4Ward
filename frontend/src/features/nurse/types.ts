/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import type { PatientClass, PhysicianOrder } from '../../types';
import type { TriageDisplay } from '../../lib/triage';


export type TabType = 'management' | 'patient';
export type NursePatient = {
  id: string;
  name: string;
  patientId: string;
  /** Active admission id required when creating physician orders. */
  admissionId?: string;
  recordId: string;
  admissionDate: string;
  /** `YYYY-MM-DD` for sorting / date inputs; `admissionDate` is for display. */
  admissionDateRaw: string;
  /** Raw admission timestamp — also when the attending physician was assigned. */
  admittedAt?: string;
  color: string;
  age: number;
  gender: string;
  initials: string;
  status?: 'admitted' | 'discharged';
  /** Whole days since admission, counted inclusively. */
  daysInCare: number;
  initialAssessment?: string | null;
  triage?: TriageAssessment;
  patientClass?: PatientClass;
  /** When the admission entered its current class. */
  classSince?: string;
  assignedDoctor?: string | null;
  additionalDoctors?: AssignedDoctor[];
  contact?: PatientContactDetails;
  /** Ward room number of an admitted patient. */
  room?: string;
  /** Outside the nurse's wards: only the name and `location` are known. */
  restricted?: boolean;
  /** Ward (+ room) the patient is in — see `wardLocation`. */
  location?: string;
};
/** Registration contact and background details, as display strings ('' when not recorded). */
export type PatientContactDetails = {
  contactNumber: string;
  address: string;
  insurance: string;
  religion: string;
  contactPersonName: string;
  contactPersonNumber: string;
  contactPersonAddress: string;
};
/** A physician on the care team and when they were added to it. */
export type AssignedDoctor = {
  name: string;
  /** ISO timestamp; absent when unknown. */
  addedAt?: string;
};
/** A triage row formatted for display — see `triageForDisplay`. */
export type TriageAssessment = TriageDisplay;
export type PatientChart = {
  name: string;
  age: number;
  gender: string;
  admissionDate: string;
  recordId: string;
  triage: TriageAssessment;
  /** First entry is the attending physician; the rest are consulting physicians. */
  assignedDoctors: AssignedDoctor[];
  contact?: PatientContactDetails;
  /** Ward room number of an admitted patient. */
  room?: string;
};
export type OrderSet = {
  dateKey: string;
  dateLabel: string;
  time: string;
  doctor: string;
  orders: string[];
  /** Present for orders loaded from the API; the static demo sets have none. */
  order?: PhysicianOrder;
};
/** A patient class label (see PATIENT_CLASS_LABEL), or Discharged. */
export type AdmissionStatus = 'Emergency' | 'Outpatient' | 'Observation' | 'Admitted' | 'Discharged';
export type AdmissionRecord = {
  id: string;
  name: string;
  /** Display date, `DD/MM/YYYY`. */
  admittedOn: string;
  /**
   * `YYYY-MM-DD`, the sort key. `DD/MM/YYYY` collates by day-of-month first, so
   * sorting on the display string pins 31/08 above 30/09 — a patient admitted
   * today could never reach the top. Sort on this, never on `admittedOn`.
   */
  admittedOnRaw: string;
  dischargedOn: string | null;
  status: AdmissionStatus;
  /** Outside the nurse's wards: only the name and `location` are known. */
  restricted?: boolean;
  /** Ward (+ room) the patient is in — see `wardLocation`. */
  location?: string;
};
