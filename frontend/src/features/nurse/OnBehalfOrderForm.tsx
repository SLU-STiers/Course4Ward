/** Part of the nurse dashboard — enters a physician's order on their behalf, inline in Patient Details. */

import { useEffect, useState, type CSSProperties } from 'react';
import { isAxiosError } from 'axios';
import { Button } from '../../components/ui';
import { ordersApi, patientsApi } from '../../services/domainApi';
import type { PhysicianOrder } from '../../types';
import { RoomPicker, normalizeRoom, roomProblem, useWardRooms } from './RoomPicker';
import { addPatient as s } from './styles';
import { ORDER_CHANNELS, type OrderChannel } from './patientForm';

type PhysicianOption = { id: string; firstName: string; lastName: string };

/** Short labels for the segmented control; the same choices as the registration form's order. */
const CHANNEL_SHORT_LABEL: Record<OrderChannel, string> = {
  '': 'Written',
  VERBAL: 'Verbal',
  CALL: 'Call',
  SMS: 'SMS',
  OTHER: 'Other',
};

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return 'Could not submit the order. Please try again.';
}

export function OnBehalfOrderForm({
  admissionId,
  careTeamNames,
  attendingName,
  currentRoom,
  canTransfer,
  onSaved,
}: {
  admissionId: string;
  /** "Dr. First Last" of the attending and consultants; only they can be ordered on behalf of. */
  careTeamNames: string[];
  /** "Dr. First Last" of the attending: the only physician a transfer order can come from. */
  attendingName?: string | null;
  /** The patient's room now, which a transfer cannot target. */
  currentRoom?: string;
  /** Admitted (inpatient) and not yet ordered home: a transfer can be entered. */
  canTransfer: boolean;
  onSaved: (order: PhysicianOrder) => void;
}) {
  const careTeamKey = careTeamNames.join('\u0000');
  const [physicians, setPhysicians] = useState<PhysicianOption[]>([]);
  const [loadingPhysicians, setLoadingPhysicians] = useState(true);
  const [physicianError, setPhysicianError] = useState<string | null>(null);
  const [channel, setChannel] = useState<OrderChannel>('');
  const [physicianId, setPhysicianId] = useState('');
  const [orderContent, setOrderContent] = useState('');
  const [isTransfer, setIsTransfer] = useState(false);
  const [transferRoom, setTransferRoom] = useState('');
  const { rooms, failed: roomsFailed, reload: reloadRooms } = useWardRooms(isTransfer, true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentBy, setSentBy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    patientsApi
      .listPhysicians()
      .then(({ data }) => {
        const careTeam = new Set(careTeamKey.split('\u0000'));
        const available = data.filter(
          (physician) => careTeam.has(`Dr. ${physician.firstName} ${physician.lastName}`),
        );
        if (cancelled) return;
        setPhysicians(available);
        // A single care-team physician is the obvious choice.
        setPhysicianId((current) => current || (available.length === 1 ? available[0].id : ''));
        if (!available.length) {
          setPhysicianError('No care-team physicians are available for this admission.');
        }
      })
      .catch(() => {
        if (!cancelled) setPhysicianError('Could not load the care-team physicians.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPhysicians(false);
      });

    return () => {
      cancelled = true;
    };
  }, [careTeamKey]);

  // A transfer can only come from the attending physician.
  const choosable = isTransfer
    ? physicians.filter((physician) => `Dr. ${physician.firstName} ${physician.lastName}` === attendingName)
    : physicians;
  const transferProblem = isTransfer
    ? !choosable.length
      ? 'Only the attending physician can order a transfer, and none is assigned.'
      : !transferRoom.trim()
        ? 'Choose the room to transfer the patient to.'
        : normalizeRoom(transferRoom) === currentRoom
          ? 'The patient is already in this room.'
          : roomProblem(transferRoom, rooms)
    : null;

  const canSubmit =
    !saving &&
    !loadingPhysicians &&
    !physicianError &&
    choosable.some((physician) => physician.id === physicianId) &&
    Boolean(orderContent.trim()) &&
    !transferProblem;

  const chooseKind = (transfer: boolean) => {
    setIsTransfer(transfer);
    setSubmitError(null);
    setSentBy(null);
    if (!transfer) return;
    const attending = physicians.find(
      (physician) => `Dr. ${physician.firstName} ${physician.lastName}` === attendingName,
    );
    setPhysicianId(attending?.id ?? '');
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setSubmitError(null);
    setSentBy(null);
    try {
      const { data } = await ordersApi.create({
        admissionId,
        orderedById: physicianId,
        orderContent: orderContent.trim(),
        communicationChannel: channel || undefined,
        ...(isTransfer && { type: 'TRANSFER' as const, transferRoomNumber: normalizeRoom(transferRoom) }),
      });
      const physician = physicians.find((option) => option.id === physicianId);
      setSentBy(physician ? `Dr. ${physician.firstName} ${physician.lastName}` : 'the physician');
      setOrderContent('');
      if (isTransfer) {
        setIsTransfer(false);
        setTransferRoom('');
        void reloadRooms();
      }
      onSaved(data);
    } catch (error: unknown) {
      setSubmitError(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <fieldset style={styles.fieldset}>
        <legend style={s.label}>Received via</legend>
        <div style={{ ...s.segmented, gridTemplateColumns: `repeat(${ORDER_CHANNELS.length}, 1fr)` }} role="radiogroup">
          {ORDER_CHANNELS.map(([option, label]) => (
            <button
              key={option || 'WRITTEN'}
              type="button"
              role="radio"
              aria-checked={channel === option}
              title={label}
              style={{ ...s.segment, ...(channel === option ? s.segmentActive : {}) }}
              onClick={() => setChannel(option)}
            >
              {CHANNEL_SHORT_LABEL[option]}
            </button>
          ))}
        </div>
      </fieldset>

      {canTransfer && (
        <fieldset style={styles.fieldset}>
          <legend style={s.label}>Order type</legend>
          <div style={{ ...s.segmented, gridTemplateColumns: 'repeat(2, 1fr)' }} role="radiogroup">
            {[
              { transfer: false, label: 'General' },
              { transfer: true, label: 'Transfer' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={isTransfer === option.transfer}
                style={{ ...s.segment, ...(isTransfer === option.transfer ? s.segmentActive : {}) }}
                onClick={() => chooseKind(option.transfer)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <label>
        <span style={s.label}>Ordered By / On Behalf Of</span>
        <select
          style={s.select}
          value={physicianId}
          onChange={(event) => setPhysicianId(event.target.value)}
          disabled={loadingPhysicians || Boolean(physicianError)}
        >
          <option value="">{loadingPhysicians ? 'Loading physicians...' : 'Select a physician'}</option>
          {choosable.map((physician) => (
            <option key={physician.id} value={physician.id}>
              Dr. {physician.firstName} {physician.lastName}
            </option>
          ))}
        </select>
      </label>
      {physicianError && (
        <p role="alert" style={styles.error}>
          {physicianError}
        </p>
      )}

      {isTransfer && (
        <div>
          <span style={s.label}>
            Transfer to room{currentRoom ? ` (now in room ${currentRoom})` : ''}
          </span>
          <RoomPicker
            value={transferRoom}
            onChange={(value) => {
              setTransferRoom(value);
              setSentBy(null);
            }}
            rooms={rooms}
            failed={roomsFailed}
            disabled={saving}
          />
          {transferProblem && !transferRoom.trim() && (
            <p style={{ ...styles.hint, marginTop: 4 }}>{transferProblem}</p>
          )}
          <p style={{ ...styles.hint, marginTop: 4 }}>
            The room is reserved when you send the order. Mark the order Finished once the patient has moved.
          </p>
        </div>
      )}

      <label>
        <span style={s.label}>Doctor&apos;s Order</span>
        <textarea
          style={s.textarea}
          value={orderContent}
          onChange={(event) => {
            setOrderContent(event.target.value);
            setSentBy(null);
          }}
          maxLength={2000}
          rows={5}
          placeholder={isTransfer ? 'Reason for the transfer, as the physician gave it' : "Type the physician's order"}
        />
      </label>

      {submitError && (
        <p role="alert" style={styles.error}>
          {submitError}
        </p>
      )}
      {sentBy && (
        <p role="status" style={styles.success}>
          ✓ Order sent on behalf of {sentBy}. It now appears under Submitted Physician Orders.
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={submit} loading={saving} disabled={!canSubmit}>
          Send Order
        </Button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  fieldset: { margin: 0, padding: 0, border: 0, minWidth: 0 },
  error: { margin: 0, fontSize: 12, fontWeight: 600, color: '#b91c1c' },
  success: { margin: 0, fontSize: 12, fontWeight: 600, color: '#15803d' },
  hint: { margin: 0, fontSize: 12, color: '#64748b' },
};
