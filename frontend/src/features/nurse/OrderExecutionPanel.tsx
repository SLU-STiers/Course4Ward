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
 * only moves forward, so options before the saved status are disabled. Once
 * the order is finished and its note submitted, the whole editor is locked.
 */
export function OrderExecutionPanel({ order, onSaved }: OrderExecutionPanelProps) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [comment, setComment] = useState(order.nurseComment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Finished with a submitted note: that is the final record, so nothing here is editable.
  const finalized = order.status === 'FINISHED' && Boolean(order.nurseComment);
  const savedIndex = ORDER_STATUS_OPTIONS.findIndex((option) => option.value === order.status);
  const dirty = status !== order.status || comment !== (order.nurseComment ?? '');

  const reset = () => {
    setStatus(order.status);
    setComment(order.nurseComment ?? '');
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await ordersApi.updateStatus(order.id, { status, nurseComment: comment });
      onSaved(data);
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <OrderStatusSummary order={order} hideComment />

      <div style={s.editor}>
        <div style={s.segmented} role="radiogroup" aria-label="Order status">
          {ORDER_STATUS_OPTIONS.map((option, index) => {
            const active = status === option.value;
            const locked = finalized || index < savedIndex;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={locked}
                title={
                  finalized
                    ? 'This order is finished and its note has been submitted'
                    : locked
                      ? 'An order cannot be moved back to an earlier status'
                      : undefined
                }
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
          style={{ ...s.textarea, ...(finalized && s.textareaLocked) }}
          value={comment}
          disabled={finalized}
          maxLength={1000}
          placeholder="Note about this order (optional)"
          aria-label="Nurse note"
          onChange={(event) => setComment(event.target.value)}
        />
        {finalized ? (
          <span style={s.lockedNote}>
            This order is finished and its note has been submitted, so it can no longer be edited.
          </span>
        ) : (
          <div style={s.actions}>
            {error && <span style={s.error}>{error}</span>}
            <Button size="sm" variant="ghost" onClick={reset} disabled={saving || !dirty}>
              Reset
            </Button>
            <Button size="sm" variant="primary" onClick={save} loading={saving} disabled={!dirty}>
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
