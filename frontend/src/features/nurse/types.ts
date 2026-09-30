/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import type { PatientClass, PhysicianOrder } from '../../types';
import type { TriageDisplay } from '../../lib/triage';


export type TabType = 'management' | 'patient';
export type NursePatient = {
  id: string;
  name: string;
  patientId: string;
  recordId: string;
  admissionDate: string;
  /** `YYYY-MM-DD` for sorting / date inputs; `admissionDate` is for display. */
  admissionDateRaw: string;
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
  additionalDoctors?: string[];
  contact?: PatientContactDetails;
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
  assignedDoctors: string[];
  contact?: PatientContactDetails;
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
  admittedOn: string;
  dischargedOn: string | null;
  status: AdmissionStatus;
};
