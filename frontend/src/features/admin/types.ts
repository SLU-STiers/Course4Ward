/**
 * View-model types for the admin dashboard.
 *
 * Wire shapes shared with the backend (`AuditLogEntry`, `AuditLogPage`,
 * `ReportSummary`, `ActivityTrend`) live in `src/types` alongside the rest of
 * the domain types; this file holds the screen-local state contracts.
 */

import type { AuditLogAction, Role } from '../../types';

/** Action filter value — a concrete action, or "no filter". */
export type ActionFilter = 'all' | AuditLogAction;

/** Actor-role filter value — a concrete role, or "no filter". */
export type RoleFilter = 'all' | Role;

/** Activity Logs date filter, including the ad-hoc range. */
export type ActivityRangePreset = 'any' | '7' | '30' | '90' | 'custom';

/** Reporting-section period selector. */
export type ReportRangePreset = '7' | '30' | '90' | 'all';

/**
 * The filters shared by the Activity Logs table and its graph view — the two
 * must always describe the same rows, so they are built once and passed down.
 */
export interface ActivityLogFilters {
  action?: AuditLogAction;
  role?: Role;
  search?: string;
  from?: string;
  to?: string;
}

/** Which representation the Activity Logs section is showing. */
export type ActivityLogView = 'table' | 'graph';

/** Row from the admin password-reset queue. */
export interface ResetRequestRow {
  id: string;
  status: string;
  user: { firstName: string; lastName: string };
}
