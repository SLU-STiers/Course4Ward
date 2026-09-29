/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useEffect, useState } from 'react';
import { ui } from './styles';
import { ORDER_CHANNELS } from './orderChannels';
import { ordersApi } from '../../services/domainApi';
import type { CommunicationChannel, PhysicianOrder } from '../../types';
import type { AdmissionRecord } from './types';

/**
 * Nurse relays a doctor's order for one admission: which channel it came in
 * on, which physician on the care team it is attributed to, and the order itself. Same shell as
 * `PatientDetailModal` so the two dialogs off the Patient Management table
 * read as siblings.
 */
export function SendOrdersModal({
  record,
  onClose,
  onSent,
}: {
  record: AdmissionRecord;
  onClose: () => void;
  onSent: (order: PhysicianOrder) => void;
}) {
  const [channel, setChannel] = useState<CommunicationChannel | ''>('');
  const careTeam = record.careTeam ?? [];
  // Preselect the attending, or the only doctor when the team is one person.
  const [physicianId, setPhysicianId] = useState(
    () => (careTeam.find((member) => member.attending) ?? (careTeam.length === 1 ? careTeam[0] : null))?.id ?? '',
  );
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !sending) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, sending]);

  const canSend = Boolean(channel && physicianId && content.trim()) && !sending;

  const send = () => {
    if (!canSend || !channel) return;
    setSending(true);
    setError(null);
    ordersApi
      .create({
        admissionId: record.id,
        orderedById: physicianId,
        orderContent: content.trim(),
        communicationChannel: channel,
      })
      .then(({ data }) => {
        onSent(data);
        onClose();
      })
      .catch((err) => {
        const message = err?.response?.data?.message;
        setError(
          Array.isArray(message)
            ? message.join(', ')
            : message || 'The order was not sent. Check the details and try again.',
        );
        setSending(false);
      });
  };

  return (
    <div style={ui.overlay} onClick={sending ? undefined : onClose}>
      <div style={ui.modalNarrow} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Doctor's Orders">
        <div style={ui.modalHeaderRow}>
          <h3 style={{ ...ui.sectionTitle, margin: 0 }}>Doctor&rsquo;s Orders</h3>
          <button type="button" style={ui.closeX} onClick={onClose} disabled={sending} aria-label="Close dialog">
            ✕
          </button>
        </div>
        <div style={ui.modalMeta}>
          <div>
            <div style={ui.fieldLabel}>Admission ID</div>
            <div style={ui.modalMetaId}>{record.id}</div>
          </div>
          <div>
            <div style={ui.fieldLabel}>Patient</div>
            <div style={ui.detailValue}>{record.name}</div>
          </div>
        </div>

        <fieldset style={{ ...ui.formField, border: 'none', padding: 0, margin: '0 0 16px' }}>
          <legend style={{ ...ui.fieldLabel, padding: 0, marginBottom: 6 }}>Sent via</legend>
          <div style={ui.channelRow}>
            {ORDER_CHANNELS.map((option) => (
              <label key={option.value} style={ui.channelOption}>
                <input
                  type="radio"
                  name="order-channel"
                  value={option.value}
                  checked={channel === option.value}
                  onChange={() => setChannel(option.value)}
                  style={ui.radio}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div style={ui.formField}>
          <label htmlFor="send-orders-physician" style={ui.fieldLabel}>Ordered By/On Behalf Of</label>
          <select
            id="send-orders-physician"
            style={ui.select}
            value={physicianId}
            onChange={(e) => setPhysicianId(e.target.value)}
            disabled={!careTeam.length}
          >
            <option value="" disabled>
              {careTeam.length ? 'Select a physician' : 'No physician on the care team'}
            </option>
            {careTeam.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.attending ? ' (attending)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={ui.formField}>
          <label htmlFor="send-orders-content" style={ui.fieldLabel}>Order details</label>
          <textarea
            id="send-orders-content"
            style={ui.textarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type the order exactly as the doctor gave it"
            rows={4}
          />
        </div>

        {error && <p style={{ ...ui.errorText, marginBottom: 12 }}>{error}</p>}

        <div style={ui.modalActions}>
          <button type="button" style={ui.outlineBtn} onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...ui.primaryBtn, opacity: canSend ? 1 : 0.55, cursor: canSend ? 'pointer' : 'not-allowed' }}
            onClick={send}
            disabled={!canSend}
          >
            {sending ? 'Sending…' : 'Send Orders'}
          </button>
        </div>
      </div>
    </div>
  );
}
