/** Part of the nurse dashboard — see index.tsx for the screen shell. */


export type TabType = 'management' | 'patient';
export type NursePatient = {
  id: string;
  name: string;
  patientId: string;
  recordId: string;
  admissionDate: string;
  color: string;
  age: number;
  gender: string;
  initials: string;
  status?: 'admitted' | 'discharged';
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
  assignedDoctors: string[];
};
export type OrderSet = {
  dateKey: string;
  dateLabel: string;
  time: string;
  doctor: string;
  orders: string[];
};
export type AdmissionStatus = 'Admitted' | 'Discharged';
export type AdmissionRecord = {
  id: string;
  name: string;
  admittedOn: string;
  dischargedOn: string | null;
  status: AdmissionStatus;
};
