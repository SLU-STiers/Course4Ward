import type { CSSProperties, ReactNode } from 'react';
import { StatusBadge } from '../ui';
import { formatDateMedium, formatTimeMedium } from '../../lib/format';
import type { PhysicianOrder } from '../../types';
import { ORDER_STATUS_OPTIONS } from './orderStatus';

const styles: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  meta: { fontSize: 11, color: '#64748b' },
  action: { marginLeft: 'auto' },
  comment: {
    marginTop: 8,
    fontSize: 12,
    color: '#334155',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: '6px 8px',
    whiteSpace: 'pre-wrap',
  },
  commentLabel: { fontWeight: 700, color: '#0f172a' },
};

type OrderStatusSummaryProps = {
  order: PhysicianOrder;
  /** Rendered at the end of the status row, e.g. the nurse's "Update status" link. */
  action?: ReactNode;
  /** Hide the nurse note, e.g. while it is being edited. */
  hideComment?: boolean;
};

/**
 * Read-only execution state of a physician order: status badge, which nurse
 * moved it and when, and the note they left. Shared by the nurse and
 * physician order timelines so both read the same.
 */
export function OrderStatusSummary({ order, action, hideComment }: OrderStatusSummaryProps) {
  const current =
    ORDER_STATUS_OPTIONS.find((option) => option.value === order.status) ?? ORDER_STATUS_OPTIONS[0];

  return (
    <div>
      <div style={styles.row}>
        <StatusBadge status={current.badge} label={current.label} showDot />
        {order.executedBy && order.executedAt && (
          <span style={styles.meta}>
            by {order.executedBy.firstName} {order.executedBy.lastName} ·{' '}
            {formatDateMedium(order.executedAt)} {formatTimeMedium(order.executedAt)}
          </span>
        )}
        {action && <span style={styles.action}>{action}</span>}
      </div>
      {!hideComment && order.nurseComment && (
        <div style={styles.comment}>
          <span style={styles.commentLabel}>Nurse note: </span>
          {order.nurseComment}
        </div>
      )}
    </div>
  );
}
