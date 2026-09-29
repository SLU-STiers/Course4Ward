/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import type { PhysicianOrder } from '../../types';


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
  isOutpatient?: boolean;
  assignedDoctor?: string | null;
  additionalDoctors?: string[];
};
export type TriageAssessment = {
  time: string;
  heartRate: string;
  respRate: string;
  spo2: string;
  bp: string;
  temp: string;
  pain: string;
  notes: string;
};
export type PatientChart = {
  name: string;
  age: number;
  gender: string;
  admissionDate: string;
  recordId: string;
  triage: TriageAssessment;
  /** First entry is the attending physician; the rest are consulting physicians. */
  assignedDoctors: string[];
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
export type AdmissionStatus = 'Admitted' | 'ER / Outpatient' | 'Discharged';
export type AdmissionRecord = {
  id: string;
  name: string;
  admittedOn: string;
  dischargedOn: string | null;
  status: AdmissionStatus;
  isOutpatient?: boolean;
};
