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
  /** Set when this is a discharge order and an earlier order is still open. */
  finishBlocked?: string;
};

/**
 * Lets the nurse mark whether a physician order has been carried out and
 * leave a note on it. Who moved it and when is stamped by the backend. Status
 * only moves forward, so options before the saved status are disabled. Once
 * the order is finished and its note submitted, the whole editor is locked.
 */
function saveError(err: unknown) {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || 'Could not save. Please try again.';
}

export function OrderExecutionPanel({ order, onSaved, finishBlocked }: OrderExecutionPanelProps) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [comment, setComment] = useState(order.nurseComment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Finished with a submitted note: that is the final record, so nothing here is editable.
  const finalized = order.status === 'FINISHED' && Boolean(order.nurseComment);
  const dischargeNoteMissing = order.type === 'DISCHARGE' && status === 'FINISHED' && !comment.trim();
  const finishingBlocked = status === 'FINISHED' && Boolean(finishBlocked);
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
    } catch (err) {
      setError(saveError(err));
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
            const locked = finalized || index < savedIndex || (option.value === 'FINISHED' && Boolean(finishBlocked));
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
                    : option.value === 'FINISHED' && finishBlocked
                      ? finishBlocked
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
          placeholder={
            order.type === 'DISCHARGE'
              ? 'Note about carrying out this discharge (required)'
              : 'Note about this order (optional)'
          }
          aria-label="Nurse note"
          onChange={(event) => setComment(event.target.value)}
        />
        {finalized ? (
          <span style={s.lockedNote}>
            This order is finished and its note has been submitted, so it can no longer be edited.
          </span>
        ) : (
          <div style={s.actions}>
            {finishBlocked && <span style={s.error}>{finishBlocked}</span>}
            {order.type === 'TRANSFER' && status === 'FINISHED' && order.status !== 'FINISHED' && order.transferRoom && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#075985' }}>
                Saving moves the patient to room {order.transferRoom.number}
                {order.transferRoom.ward ? ` (${order.transferRoom.ward.name})` : ''}.
              </span>
            )}
            {dischargeNoteMissing && !finishBlocked && (
              <span style={s.error}>
                Add a note to mark this discharge done. The patient is discharged when you save.
              </span>
            )}
            {error && <span style={s.error}>{error}</span>}
            <Button size="sm" variant="ghost" onClick={reset} disabled={saving || !dirty}>
              Reset
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={save}
              loading={saving}
              disabled={!dirty || dischargeNoteMissing || finishingBlocked}
            >
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
