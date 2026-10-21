/** Part of the claims dashboard — see index.tsx for the screen shell. */

import { useEffect, useState, type CSSProperties } from 'react';
import { TriageAssessmentPanel } from '../../components/patients/TriageAssessmentPanel';

import type { SummarizationRequest } from './types';

const STATUS_BADGE: Record<SummarizationRequest['status'], CSSProperties> = {
  'Pending Review': { backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#fcd34d' },
  Approved: { backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#86efac' },
  Rejected: { backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' },
};

export function ReviewRequestModal({
  request,
  onClose,
  onRequestRevisions,
}: {
  request: SummarizationRequest;
  onClose: () => void;
  /** Receives the message typed in the notify box; it lands on the
   *  physician's notification bell. Rejects when sending fails. */
  onRequestRevisions: (message: string) => Promise<void>;
}) {
  const [notificationMessage, setNotificationMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const message = notificationMessage.trim();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, sending]);

  const send = async () => {
    if (!message || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await onRequestRevisions(message);
    } catch {
      setSendError('Could not send the reminder. Please try again.');
      setSending(false);
    }
  };

  const fields = [
    { label: 'Patient ID', value: request.patient.patientId },
    { label: 'Age', value: request.patient.age },
    { label: 'Gender', value: request.patient.gender },
    { label: 'Admission Date', value: request.patient.admissionDate },
  ];

  return (
    <div style={s.overlay} onClick={() => !sending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-request-title"
        style={s.shell}
        onClick={(event) => event.stopPropagation()}
      >
        <header style={s.header}>
          <div style={{ minWidth: 0 }}>
            <h2 id="review-request-title" style={s.headerTitle}>
              Review AI Summarization
            </h2>
            <div style={s.headerMeta}>
              <span style={{ ...s.badge, ...STATUS_BADGE[request.status] }}>{request.status}</span>
              <span style={s.requestId}>Request ID: {request.id}</span>
            </div>
          </div>
          <button type="button" aria-label="Close" style={s.closeBtn} onClick={onClose} disabled={sending}>
            ×
          </button>
        </header>

        <div style={s.body}>
          <section style={s.patientCard}>
            <div style={s.avatar} aria-hidden="true">
              {request.patient.initials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={s.patientName}>{request.patient.name}</h3>
              <dl style={s.fieldGrid}>
                {fields.map((field) => (
                  <div key={field.label} style={{ minWidth: 0 }}>
                    <dt style={s.fieldLabel}>{field.label}</dt>
                    <dd style={s.fieldValue}>{field.value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section>
            <h4 style={s.sectionLabel}>Triage Assessment</h4>
            <div style={s.card}>
              <TriageAssessmentPanel triage={request.triage} />
            </div>
          </section>

          <section>
            <h4 style={s.sectionLabel}>Physician Reviewed</h4>
            <div style={s.summaryCard}>
              <div style={s.summaryHeader}>
                <span style={s.summaryHeaderTitle}>
                  <span aria-hidden="true">✦</span> AI Summarized Content
                </span>
                <span style={s.summaryMeta}>
                  Generated: {request.date} at {request.time}
                </span>
              </div>
              <div style={s.summaryContent}>{request.summaryText || 'No summary text.'}</div>
            </div>
          </section>

          <section style={s.checklist}>
            <h4 style={{ ...s.sectionLabel, marginBottom: 8 }}>
              <span aria-hidden="true">✓</span> Review Checklist
            </h4>
            <ul style={s.checklistList}>
              <li>Verify that medications, dosages, and frequencies are accurate.</li>
              <li>Ensure vital signs and patient condition are properly summarized.</li>
              <li>Check if the summary aligns with PhilHealth documentation standards.</li>
              <li>Confirm completeness and clarity of the course in the ward entry.</li>
            </ul>
          </section>

          <section style={s.notificationCard}>
            <label htmlFor="review-notify-message" style={s.notificationTitle}>
              <span aria-hidden="true">✉</span> Notify Physician to Review Again
            </label>
            <p style={s.notificationHint}>
              The message is sent to the physician&apos;s notifications so they can revise the summary.
            </p>
            <textarea
              id="review-notify-message"
              value={notificationMessage}
              onChange={(event) => {
                setNotificationMessage(event.target.value);
                setSendError(null);
              }}
              placeholder="e.g. Please double-check the medication dosages on day 2."
              style={s.textarea}
              maxLength={1000}
              disabled={sending}
            />
            {sendError && (
              <div role="alert" style={s.error}>
                ⚠ {sendError}
              </div>
            )}
          </section>
        </div>

        <footer style={s.footer}>
          <button type="button" style={s.outlineBtn} onClick={onClose} disabled={sending}>
            Close
          </button>
          <button
            type="button"
            style={{
              ...s.primaryBtn,
              opacity: message && !sending ? 1 : 0.55,
              cursor: message && !sending ? 'pointer' : 'not-allowed',
            }}
            onClick={send}
            disabled={!message || sending}
            title={message ? undefined : 'Write a message for the physician first'}
          >
            {sending ? 'Sending…' : 'Send Physician Reminder'}
          </button>
        </footer>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
    padding: 24,
  },
  shell: {
    width: 'min(960px, 94vw)',
    maxHeight: 'calc(100vh - 48px)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    padding: '18px 24px 14px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
  headerTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' },
  headerMeta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
    fontSize: 12,
    color: '#64748b',
  },
  requestId: { overflowWrap: 'anywhere' },
  badge: {
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    border: '1px solid',
    whiteSpace: 'nowrap',
  },
  closeBtn: {
    flexShrink: 0,
    width: 36,
    height: 36,
    border: 'none',
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: '#64748b',
    fontSize: 24,
    cursor: 'pointer',
    lineHeight: 1,
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    padding: '20px 24px 24px',
  },
  patientCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    padding: 18,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  avatar: {
    flexShrink: 0,
    width: 56,
    height: 56,
    borderRadius: '50%',
    backgroundColor: '#f97316',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 20,
    boxShadow: '0 8px 18px rgba(249, 115, 22, 0.25)',
  },
  patientName: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
    overflowWrap: 'anywhere',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px 20px',
    margin: '10px 0 0',
  },
  fieldLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  fieldValue: { margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: '#0f172a' },
  sectionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '0 0 8px',
    fontSize: 13,
    fontWeight: 700,
    color: '#334155',
  },
  card: {
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  summaryCard: {
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  summaryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: '#eef2ff',
    borderBottom: '1px solid #e2e8f0',
  },
  summaryHeaderTitle: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#1e293b' },
  summaryMeta: { fontSize: 12, color: '#64748b' },
  summaryContent: {
    padding: 16,
    fontSize: 14,
    lineHeight: 1.65,
    color: '#334155',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  checklist: {
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  checklistList: { margin: 0, paddingLeft: 18, color: '#475569', lineHeight: 1.6, fontSize: 13 },
  notificationCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    border: '1px solid #dbeafe',
    borderRadius: 12,
    backgroundColor: '#f8fbff',
    padding: 16,
  },
  notificationTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#1d4ed8' },
  notificationHint: { margin: 0, fontSize: 12, color: '#64748b' },
  textarea: {
    width: '100%',
    minHeight: 96,
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: 12,
    resize: 'vertical',
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    outline: 'none',
  },
  error: {
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#b91c1c',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
  },
  footer: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    padding: '14px 24px',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
  },
  outlineBtn: {
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#334155',
    borderRadius: 8,
    padding: '10px 18px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  primaryBtn: {
    border: 'none',
    backgroundColor: 'var(--c4w-color-primary)',
    color: '#ffffff',
    borderRadius: 8,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 700,
  },
};
