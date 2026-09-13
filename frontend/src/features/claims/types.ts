/** Part of the claims dashboard — see index.tsx for the screen shell. */


export type TabType = 'overview' | 'requests' | 'export';
export type ExportSubView = 'selection' | 'new-cf4' | 'existing-cf4';
export type PatientSortField = 'name' | 'patientId' | 'admissionDate';
export type SortDirection = 'ascending' | 'descending';
export type RequestSortField = 'id' | 'date' | 'status';
export type PatientStatus = 'all' | 'admitted' | 'discharged';
export interface SummarizationRequest {
  id: string;
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
  orders: Array<{ content: string; dateCreated: string; doctor: string }>;
}
export interface CF4Patient {
  id: string;
  claimId: string;
  patientId: string;
  name: string;
  color: string;
  admissionDate: string;
  status: Exclude<PatientStatus, 'all'>;
  selected: boolean;
}
