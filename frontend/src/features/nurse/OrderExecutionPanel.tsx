/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { Button } from '../../components/ui';
import { OrderStatusSummary } from '../../components/orders/OrderStatusSummary';
import { ORDER_STATUS_OPTIONS } from '../../components/orders/orderStatus';
import { ordersApi } from '../../services/domainApi';
import type { OrderStatus, PhysicianOrder } from '../../types';
import { orderExec as s } from './styles';

type OrderExecutionPanelProps = {
  order: PhysicianOrder;
  /** Called with the saved order so the parent can replace its copy. */
  onSaved: (order: PhysicianOrder) => void;
};

/**
 * Lets the nurse mark whether a physician order has been carried out and
 * leave a note on it. Who moved it and when is stamped by the backend. Status
 * only moves forward, so options before the saved status are disabled.
 */
export function OrderExecutionPanel({ order, onSaved }: OrderExecutionPanelProps) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [comment, setComment] = useState(order.nurseComment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedIndex = ORDER_STATUS_OPTIONS.findIndex((option) => option.value === order.status);

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
      <OrderStatusSummary
        order={order}
        hideComment={editing}
        action={
          editing ? undefined : (
            <button type="button" style={s.updateBtn} onClick={startEditing}>
              {order.status === 'FINISHED' ? 'Edit note' : 'Update status'}
            </button>
          )
        }
      />

      {editing && (
        <div style={s.editor}>
          <div style={s.segmented} role="radiogroup" aria-label="Order status">
            {ORDER_STATUS_OPTIONS.map((option, index) => {
              const active = status === option.value;
              const locked = index < savedIndex;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={locked}
                  title={locked ? 'An order cannot be moved back to an earlier status' : undefined}
                  style={{
                    ...s.segment,
                    ...(active && s.segmentActive),
                    ...(locked && s.segmentLocked),
                  }}
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
