import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Button, Modal } from '../../components/ui';
import { ordersApi, patientsApi } from '../../services/domainApi';
import type { PhysicianOrder } from '../../types';

type PhysicianOption = {
  id: string;
  firstName: string;
  lastName: string;
};

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

export function OnBehalfOrderModal({
  open,
  admissionId,
  patientName,
  careTeamNames,
  onClose,
  onSaved,
}: {
  open: boolean;
  admissionId: string;
  patientName: string;
  careTeamNames: string[];
  onClose: () => void;
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
  const [submittedBy, setSubmittedBy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

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
        if (!available.length) {
          setPhysicianError('No care-team physicians are available for this admission.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhysicianError('Could not load the care-team physicians. Please close and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPhysicians(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, careTeamKey]);

  const submit = async () => {
    if (!physicianId || !orderContent.trim()) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const { data } = await ordersApi.create({
        admissionId,
        orderedById: physicianId,
        orderContent: `Received via ${channel}.\n${orderContent.trim()}`,
      });
      const physician = physicians.find((option) => option.id === physicianId);
      const physicianName = physician
        ? `Dr. ${physician.firstName} ${physician.lastName}`
        : 'the physician';
      onSaved(data);
      setSubmittedBy(physicianName);
    } catch (error: unknown) {
      setSubmitError(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    display: 'block',
    width: '100%',
    marginTop: 6,
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    color: '#0f172a',
    background: '#fff',
    font: 'inherit',
  } as const;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={submittedBy ? 'Order submitted' : 'Order on Behalf of Physician'}
      description={
        submittedBy
          ? undefined
          : `Record a physician's order for ${patientName}.`
      }
      size="md"
      footer={
        submittedBy ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              loading={saving}
              disabled={loadingPhysicians || Boolean(physicianError) || !physicianId || !orderContent.trim()}
            >
              Send Order
            </Button>
          </>
        )
      }
    >
      {submittedBy ? (
        <div role="status" style={{ textAlign: 'center', padding: '18px 8px 24px' }}>
          <div
            aria-hidden="true"
            style={{
              width: 52,
              height: 52,
              margin: '0 auto 14px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#15803d',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <h3 style={{ margin: '0 0 6px', color: '#0f172a' }}>Thank you!</h3>
          <p style={{ margin: 0, color: '#475569' }}>
            The order for {patientName} was sent on behalf of {submittedBy}.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <fieldset style={{ margin: 0, padding: 0, border: 0 }}>
            <legend style={{ marginBottom: 10, fontWeight: 700, color: '#0f172a' }}>
              Doctor&apos;s Orders received via
            </legend>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {CHANNELS.map((option) => (
                <label
                  key={option}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#334155' }}
                >
                  <input
                    type="radio"
                    name="order-channel"
                    value={option}
                    checked={channel === option}
                    onChange={() => setChannel(option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>

          <label style={{ color: '#0f172a', fontWeight: 700 }}>
            Ordered By / On Behalf Of
            <select
              value={physicianId}
              onChange={(event) => setPhysicianId(event.target.value)}
              disabled={loadingPhysicians || Boolean(physicianError)}
              style={fieldStyle}
            >
              <option value="">
                {loadingPhysicians ? 'Loading physicians...' : 'Select a physician'}
              </option>
              {physicians.map((physician) => (
                <option key={physician.id} value={physician.id}>
                  Dr. {physician.firstName} {physician.lastName}
                </option>
              ))}
            </select>
          </label>
          {physicianError && (
            <p role="alert" style={{ margin: '-10px 0 0', color: '#b91c1c' }}>
              {physicianError}
            </p>
          )}

          <label style={{ color: '#0f172a', fontWeight: 700 }}>
            Order details
            <textarea
              value={orderContent}
              onChange={(event) => setOrderContent(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Enter the physician's order"
              required
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
          </label>
          {submitError && (
            <p role="alert" style={{ margin: '-10px 0 0', color: '#b91c1c' }}>
              {submitError}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
