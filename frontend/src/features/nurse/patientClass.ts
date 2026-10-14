/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import type { StatusValue } from '../../components/ui';
import { PATIENT_CLASS_LABEL } from '../../lib/patient';
import type { Patient, PatientAdmission } from '../../types';
import type { AdmissionStatus } from './types';

/** Every status a nurse list can show, in filter order. */
export const ADMISSION_STATUSES: AdmissionStatus[] = [
  'Emergency',
  'Outpatient',
  'Observation',
  'Admitted',
  'Discharged',
];

/** "Surgery · Room 206" — all a nurse is told about a patient outside their wards. */
export function wardLocation(patient: Pick<Patient, 'wardName' | 'roomNumber'>) {
  return [patient.wardName ?? 'Another ward', patient.roomNumber && `Room ${patient.roomNumber}`]
    .filter(Boolean)
    .join(' · ');
}

/** Status of an admission: discharged, else its patient class. */
export function admissionStatusOf(
  admission?: Pick<PatientAdmission, 'dischargeDate' | 'patientClass'> | null,
): AdmissionStatus {
  if (admission?.dischargeDate) return 'Discharged';
  return PATIENT_CLASS_LABEL[admission?.patientClass ?? 'INPATIENT'] as AdmissionStatus;
}

/** Badge tone of each status in the tables. */
export const STATUS_TONE: Record<AdmissionStatus, StatusValue> = {
  Emergency: 'danger',
  Outpatient: 'info',
  Observation: 'pending',
  Admitted: 'admitted',
  Discharged: 'discharged',
};
