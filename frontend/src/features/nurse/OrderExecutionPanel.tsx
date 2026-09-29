/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { Button, StatusBadge, type StatusValue } from '../../components/ui';
import { formatDateMedium, formatTimeMedium } from '../../lib/format';
import { ordersApi } from '../../services/domainApi';
import type { OrderStatus, PhysicianOrder } from '../../types';
import { orderExec as s } from './styles';

const STATUS_OPTIONS: { value: OrderStatus; label: string; badge: StatusValue }[] = [
  { value: 'TO_ACCOMPLISH', label: 'To accomplish', badge: 'pending' },
  { value: 'ONGOING', label: 'Ongoing', badge: 'in-progress' },
  { value: 'FINISHED', label: 'Finished', badge: 'completed' },
];

type OrderExecutionPanelProps = {
  order: PhysicianOrder;
  /** Called with the saved order so the parent can replace its copy. */
  onSaved: (order: PhysicianOrder) => void;
};

/**
 * Lets the nurse mark whether a physician order has been carried out and
 * leave a note on it. Who moved it and when is stamped by the backend.
 */
export function OrderExecutionPanel({ order, onSaved }: OrderExecutionPanelProps) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [comment, setComment] = useState(order.nurseComment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = STATUS_OPTIONS.find((option) => option.value === order.status) ?? STATUS_OPTIONS[0];

  const startEditing = () => {
    setStatus(order.status);
    setComment(order.nurseComment ?? '');
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await ordersApi.updateStatus(order.id, { status, nurseComment: comment });
      onSaved(data);
      setEditing(false);
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={s.row}>
        <StatusBadge status={current.badge} label={current.label} showDot />
        {order.executedBy && order.executedAt && (
          <span style={s.meta}>
            by {order.executedBy.firstName} {order.executedBy.lastName} ·{' '}
            {formatDateMedium(order.executedAt)} {formatTimeMedium(order.executedAt)}
          </span>
        )}
        {!editing && (
          <button type="button" style={s.updateBtn} onClick={startEditing}>
            Update status
          </button>
        )}
      </div>

      {!editing && order.nurseComment && (
        <div style={s.comment}>
          <span style={s.commentLabel}>Nurse note: </span>
          {order.nurseComment}
        </div>
      )}

      {editing && (
        <div style={s.editor}>
          <div style={s.segmented} role="radiogroup" aria-label="Order status">
            {STATUS_OPTIONS.map((option) => {
              const active = status === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  style={active ? { ...s.segment, ...s.segmentActive } : s.segment}
                  onClick={() => setStatus(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <textarea
            style={s.textarea}
            value={comment}
            maxLength={1000}
            placeholder="Note about this order (optional)"
            aria-label="Nurse note"
            onChange={(event) => setComment(event.target.value)}
          />
          <div style={s.actions}>
            {error && <span style={s.error}>{error}</span>}
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={save} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
