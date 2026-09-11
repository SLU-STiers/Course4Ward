import type { ReactNode } from 'react';

/**
 * Canonical status semantics used across every role.
 * Maps a domain status to a shared color tone + human label.
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'flagged';

export type StatusValue =
  | 'completed'
  | 'approved'
  | 'success'
  | 'active'
  | 'validated'
  | 'admitted'
  | 'pending'
  | 'review'
  | 'in-progress'
  | 'draft'
  | 'flagged'
  | 'warning'
  | 'rejected'
  | 'failed'
  | 'danger'
  | 'discharged'
  | 'info'
  | 'neutral';

interface StatusConfig {
  tone: StatusTone;
  label: string;
}

const STATUS_CONFIG: Record<StatusValue, StatusConfig> = {
  completed: { tone: 'success', label: 'Completed' },
  approved: { tone: 'success', label: 'Approved' },
  success: { tone: 'success', label: 'Success' },
  active: { tone: 'success', label: 'Active' },
  validated: { tone: 'success', label: 'Validated' },
  admitted: { tone: 'success', label: 'Admitted' },
  pending: { tone: 'warning', label: 'Pending' },
  review: { tone: 'warning', label: 'In Review' },
  'in-progress': { tone: 'warning', label: 'In Progress' },
  draft: { tone: 'info', label: 'Draft' },
  flagged: { tone: 'flagged', label: 'Flagged' },
  warning: { tone: 'warning', label: 'Warning' },
  rejected: { tone: 'danger', label: 'Rejected' },
  failed: { tone: 'danger', label: 'Failed' },
  danger: { tone: 'danger', label: 'Error' },
  discharged: { tone: 'neutral', label: 'Discharged' },
  info: { tone: 'info', label: 'Info' },
  neutral: { tone: 'neutral', label: '—' },
};

export interface StatusBadgeProps {
  /** Domain status — determines the tone and default label. */
  status: StatusValue;
  /** Override the default label text. */
  label?: ReactNode;
  /** Show a leading status dot. */
  showDot?: boolean;
  /** Render arbitrary content instead of `label`. */
  children?: ReactNode;
  className?: string;
}

export function StatusBadge({ status, label, showDot = false, children, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.neutral;
  const classes = ['ui-badge', `ui-badge--${config.tone}`, className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} data-status={status}>
      {showDot ? <span className="ui-badge__dot" aria-hidden="true" /> : null}
      <span className="ui-badge__label">{children ?? label ?? config.label}</span>
    </span>
  );
}

/** Resolve the tone for a raw status value (useful for custom renderers). */
export function statusTone(status: StatusValue): StatusTone {
  return STATUS_CONFIG[status]?.tone ?? 'neutral';
}
