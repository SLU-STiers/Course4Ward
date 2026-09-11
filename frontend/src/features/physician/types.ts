/** Part of the physician dashboard — see index.tsx for the screen shell. */

import type { Patient } from '../../types';

export type TabType = "overview" | "manage" | "requests";
type PatientStatus = "admitted" | "discharged";
export type OverviewFilter = "all" | PatientStatus;
export type DashboardPatient = {
  id: string;
  name: string;
  patientId: string;
  gender: string;
  dateOfBirth: string | null;
  age: number | null;
  admissionDate: string;
  /** Raw ISO admission date — used for filtering/sorting, never displayed. */
  admissionDateRaw: string;
  daysInCare: number;
  color: string;
  status: PatientStatus;
  admissions?: Patient["admissions"];
};
