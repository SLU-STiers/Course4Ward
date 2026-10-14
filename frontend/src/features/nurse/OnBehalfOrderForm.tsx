/** Part of the nurse dashboard — enters a physician's order on their behalf, inline in Patient Details. */

import { useEffect, useState, type CSSProperties } from 'react';
import { isAxiosError } from 'axios';
import { Button } from '../../components/ui';
import { ordersApi, patientsApi } from '../../services/domainApi';
import type { PhysicianOrder } from '../../types';
import { addPatient as s } from './styles';

type PhysicianOption = { id: string; firstName: string; lastName: string };

type OrderChannel = 'SMS' | 'Email' | 'Verbal' | 'Others';

const CHANNELS: OrderChannel[] = ['SMS', 'Email', 'Verbal', 'Others'];

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
  onSaved,
}: {
  admissionId: string;
  /** "Dr. First Last" of the attending and consultants; only they can be ordered on behalf of. */
  careTeamNames: string[];
  onSaved: (order: PhysicianOrder) => void;
}) {
  const careTeamKey = careTeamNames.join('\u0000');
  const [physicians, setPhysicians] = useState<PhysicianOption[]>([]);
  const [loadingPhysicians, setLoadingPhysicians] = useState(true);
  const [physicianError, setPhysicianError] = useState<string | null>(null);
  const [channel, setChannel] = useState<OrderChannel>('SMS');
  const [physicianId, setPhysicianId] = useState('');
  const [orderContent, setOrderContent] = useState('');
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

  const canSubmit =
    !saving && !loadingPhysicians && !physicianError && Boolean(physicianId) && Boolean(orderContent.trim());

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setSubmitError(null);
    setSentBy(null);
    try {
      const { data } = await ordersApi.create({
        admissionId,
        orderedById: physicianId,
        orderContent: `Received via ${channel}.\n${orderContent.trim()}`,
      });
      const physician = physicians.find((option) => option.id === physicianId);
      setSentBy(physician ? `Dr. ${physician.firstName} ${physician.lastName}` : 'the physician');
      setOrderContent('');
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
        <div style={{ ...s.segmented, gridTemplateColumns: `repeat(${CHANNELS.length}, 1fr)` }} role="radiogroup">
          {CHANNELS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={channel === option}
              style={{ ...s.segment, ...(channel === option ? s.segmentActive : {}) }}
              onClick={() => setChannel(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <label>
        <span style={s.label}>Ordered By / On Behalf Of</span>
        <select
          style={s.select}
          value={physicianId}
          onChange={(event) => setPhysicianId(event.target.value)}
          disabled={loadingPhysicians || Boolean(physicianError)}
        >
          <option value="">{loadingPhysicians ? 'Loading physicians...' : 'Select a physician'}</option>
          {physicians.map((physician) => (
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
          placeholder="Type the physician's order"
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
};
