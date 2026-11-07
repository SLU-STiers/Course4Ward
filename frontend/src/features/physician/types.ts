/** Part of the physician dashboard — see index.tsx for the screen shell. */

import type { Patient, TriageLevel } from '../../types';

export type TabType = "overview" | "manage" | "requests";
type PatientStatus = "admitted" | "discharged";
export type OverviewFilter = "all" | PatientStatus;
/**
 * Status filter of the Manage list. The list holds every assigned patient —
 * discharged ones stay reachable so their last Course in the Ward can still be
 * read and approved.
 */
export type ManageStatusFilter = OverviewFilter;
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
  /** Display discharge date, or "—" while the patient is still admitted. */
  dischargeDate: string;
  /** Full ISO admission timestamp (or null) — triage queue tie-break. */
  admittedAt: string | null;
  daysInCare: number;
  /** 5-level triage priority of the current admission; null when not triaged. */
  triageLevel: TriageLevel | null;
  color: string;
  status: PatientStatus;
  admissions?: Patient["admissions"];
};
