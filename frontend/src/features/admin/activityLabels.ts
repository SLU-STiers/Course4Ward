/**
 * Human wording for every persisted `ActionType`.
 *
 * The Activity Logs screen used to show only who and when, which is why the
 * admin dashboard could not answer "what actually happened?" — the stored
 * action was thrown away. This map is the single source of that wording, so a
 * new action added to the Prisma enum only needs a row here.
 */

import type { StatusValue } from '../../components/ui';
import type { AuditLogAction, Role } from '../../types';

export interface ActionMeta {
  /** What the log row shows. */
  label: string;
  /** One-line explanation, surfaced as the row's tooltip. */
  description: string;
  /** Badge semantics from the shared `StatusBadge`. */
  badge: StatusValue;
}

export const ACTION_META: Record<AuditLogAction, ActionMeta> = {
  LOGIN: { label: 'Signed in', description: 'Signed in to the system', badge: 'info' },
  LOGOUT: { label: 'Signed out', description: 'Ended their session', badge: 'neutral' },
  ADD_NOTE: {
    label: 'Note added',
    description: 'Added a clinical note',
    badge: 'info',
  },
  CREATE_ORDER_NURSE: {
    label: 'Order entered (nurse)',
    description: "Entered a physician's order on their behalf",
    badge: 'info',
  },
  CREATE_ORDER: {
    label: 'Order created',
    description: 'Wrote a physician order',
    badge: 'info',
  },
  REQUEST_SUMMARY: {
    label: 'Summary generated (AI)',
    description: 'Generated a Course in the Ward summary from the day’s orders',
    badge: 'draft',
  },
  EDIT_SUMMARY: {
    label: 'Summary edited',
    description: 'Manually edited a Course in the Ward summary',
    badge: 'in-progress',
  },
  REGENERATE_SUMMARY: {
    label: 'Summary regenerated',
    description: 'Re-ran the AI summary for a Course in the Ward',
    badge: 'review',
  },
  APPROVE_SUMMARY: {
    label: 'Summary approved',
    description: 'Approved a Course in the Ward summary',
    badge: 'approved',
  },
  CLAIM_CREATED: {
    label: 'Claim created',
    description: 'Filed a claim and requested physician validation',
    badge: 'info',
  },
  CLAIM_PHYSICIAN_NOTIFIED: {
    label: 'Physician notified',
    description: 'Requested physician validation for a claim',
    badge: 'pending',
  },
  CF4_GENERATED: {
    label: 'PhilHealth CF4 generated',
    description: 'Generated the PhilHealth CF4 for an approved summary',
    badge: 'completed',
  },
  ADD_ACCOUNT: {
    label: 'Account created',
    description: 'Created a staff account',
    badge: 'completed',
  },
  EDIT_ACCOUNT: {
    label: 'Account updated',
    description: 'Updated a staff account',
    badge: 'warning',
  },
  DELETE_ACCOUNT: {
    label: 'Account deactivated',
    description: 'Deactivated a staff account',
    badge: 'rejected',
  },
  PASSWORD_RESET: {
    label: 'Password reset',
    description: 'Reset a password through the reset workflow',
    badge: 'warning',
  },
  REGISTER_PATIENT: {
    label: 'Patient registered',
    description: 'Registered a patient',
    badge: 'admitted',
  },
  PATIENT_UPDATED: {
    label: 'Patient record updated',
    description: 'Updated patient demographics',
    badge: 'in-progress',
  },
};

const UNKNOWN_ACTION: ActionMeta = {
  label: 'Unknown action',
  description: 'This action is not recognised by the current build',
  badge: 'flagged',
};

/** Metadata for a stored action, without trusting the wire value's shape. */
export function actionMeta(action: string): ActionMeta {
  return ACTION_META[action as AuditLogAction] ?? UNKNOWN_ACTION;
}

/** Filter-menu options for the action filter, alphabetical by label. */
export const ACTION_FILTER_OPTIONS = (
  Object.keys(ACTION_META) as AuditLogAction[]
)
  .map((value) => ({ value, label: ACTION_META[value].label }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const ROLE_LABELS: Record<Role, string> = {
  PHYSICIAN: 'Physician',
  NURSE: 'Nurse',
  CLAIMS_PROCESSOR: 'Claims processor',
  ADMIN: 'Admin',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}
