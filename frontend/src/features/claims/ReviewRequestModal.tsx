/** Part of the claims dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';

import type { SummarizationRequest } from './types';

export function ReviewRequestModal({
  request,
  onClose,
  onRequestRevisions,
}: {
  request: SummarizationRequest;
  onClose: () => void;
  onRequestRevisions: () => void;
}) {
  const [notificationMessage, setNotificationMessage] = useState('');

  const modalStyles = {
    overlay: {
      position: 'fixed' as const,
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '24px',
    },
    shell: {
      width: 'min(1000px, 90vw)',
      backgroundColor: '#ffffff',
      borderRadius: '18px',
      boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '18px 24px 12px',
      borderBottom: '1px solid #e2e8f0',
      backgroundColor: '#f8fafc',
    },
    headerTitle: {
      margin: 0,
      fontSize: '20px',
      fontWeight: 700,
      color: '#0f172a',
    },
    headerMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '12px',
      color: '#64748b',
      marginTop: '2px',
    },
    badge: {
      backgroundColor: '#fef3c7',
      color: '#b45309',
      borderRadius: '999px',
      padding: '5px 10px',
      fontSize: '11px',
      fontWeight: 700,
      border: '1px solid #fcd34d',
    },
    closeBtn: {
      border: 'none',
      backgroundColor: 'transparent',
      color: '#64748b',
      fontSize: '24px',
      cursor: 'pointer',
      lineHeight: 1,
    },
    body: {
      padding: '20px 24px 24px',
      backgroundColor: '#ffffff',
    },
    topCard: {
      display: 'grid',
      gridTemplateColumns: '180px 1fr',
      gap: '24px',
      alignItems: 'center',
      padding: '18px',
      borderRadius: '12px',
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      marginBottom: '18px',
    },
    avatar: {
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      backgroundColor: '#f97316',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: '20px',
      boxShadow: '0 8px 18px rgba(249, 115, 22, 0.25)',
    },
    patientName: {
      fontSize: '28px',
      fontWeight: 800,
      color: '#0f172a',
      margin: 0,
    },
    row: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '20px',
      marginTop: '8px',
      fontSize: '13px',
      color: '#475569',
    },
    field: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '3px',
      minWidth: '150px',
    },
    fieldLabel: {
      color: '#64748b',
      fontSize: '12px',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.02em',
    },
    sectionLabel: {
      fontSize: '13px',
      fontWeight: 700,
      color: '#334155',
      marginBottom: '8px',
    },
    summaryCard: {
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      backgroundColor: '#f8fafc',
      overflow: 'hidden',
      marginBottom: '18px',
    },
    summaryHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 16px',
      backgroundColor: '#eef2ff',
      borderBottom: '1px solid #e2e8f0',
    },
    summaryHeaderTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontWeight: 700,
      color: '#1e293b',
    },
    summaryContent: {
      padding: '16px',
      fontSize: '14px',
      lineHeight: 1.65,
      color: '#334155',
      whiteSpace: 'pre-wrap' as const,
    },
    checklist: {
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      backgroundColor: '#f8fafc',
      padding: '16px',
      marginBottom: '18px',
    },
    checklistTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontWeight: 700,
      color: '#334155',
      marginBottom: '10px',
    },
    checklistList: {
      margin: 0,
      paddingLeft: '18px',
      color: '#475569',
      lineHeight: 1.6,
      fontSize: '13px',
    },
    notificationCard: {
      border: '1px solid #dbeafe',
      borderRadius: '12px',
      backgroundColor: '#fefefe',
      padding: '16px',
      marginBottom: '18px',
    },
    notificationTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '13px',
      fontWeight: 700,
      color: '#1d4ed8',
      marginBottom: '10px',
    },
    textarea: {
      width: '100%',
      minHeight: '90px',
      border: '1px solid #cbd5e1',
      borderRadius: '10px',
      padding: '12px',
      resize: 'vertical' as const,
      fontSize: '13px',
      color: '#0f172a',
      boxSizing: 'border-box' as const,
      outline: 'none',
    },
    actions: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap' as const,
      marginTop: '8px',
    },
    outlineBtn: {
      border: '1px solid #cbd5e1',
      backgroundColor: '#ffffff',
      color: '#334155',
      borderRadius: '8px',
      padding: '10px 18px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 600,
    },
    primaryBtn: {
      border: 'none',
      backgroundColor: 'var(--c4w-color-primary)',
      color: '#ffffff',
      borderRadius: '8px',
      padding: '10px 18px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 700,
    },
    secondaryBtn: {
      border: '1px solid var(--c4w-color-primary)',
      backgroundColor: '#ffffff',
      color: 'var(--c4w-color-primary)',
      borderRadius: '8px',
      padding: '10px 18px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 700,
    },
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.shell} onClick={(event) => event.stopPropagation()}>
        <header style={modalStyles.header}>
          <div>
            <h2 style={modalStyles.headerTitle}>Review AI Summarization</h2>
            <div style={modalStyles.headerMeta}>
              <span style={modalStyles.badge}>Pending Review</span>
              <span>Request ID: {request.id}</span>
            </div>
          </div>
          <button type="button" aria-label="Close" style={modalStyles.closeBtn} onClick={onClose}>
            ×
          </button>
        </header>

        <div style={modalStyles.body}>
          <div style={modalStyles.topCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={modalStyles.avatar}>{request.patient.initials}</div>
            </div>

            <div>
              <h3 style={modalStyles.patientName}>{request.patient.name}</h3>
              <div style={modalStyles.row}>
                <div style={modalStyles.field}>
                  <span style={modalStyles.fieldLabel}>Patient ID</span>
                  <span>{request.patient.patientId}</span>
                </div>
                <div style={modalStyles.field}>
                  <span style={modalStyles.fieldLabel}>Age</span>
                  <span>{request.patient.age}</span>
                </div>
                <div style={modalStyles.field}>
                  <span style={modalStyles.fieldLabel}>Gender</span>
                  <span>{request.patient.gender}</span>
                </div>
                <div style={modalStyles.field}>
                  <span style={modalStyles.fieldLabel}>Admission Date</span>
                  <span>{request.patient.admissionDate}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={modalStyles.sectionLabel}>Physician Reviewed</div>
          <div style={modalStyles.summaryCard}>
            <div style={modalStyles.summaryHeader}>
              <div style={modalStyles.summaryHeaderTitle}>
                <span>✦</span>
                <span>AI Summarized Content</span>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Generated: {request.date} at {request.time}</span>
            </div>

            <div style={modalStyles.summaryContent}>{request.summaryText}</div>
          </div>

          <div style={modalStyles.checklist}>
            <div style={modalStyles.checklistTitle}>
              <span>✓</span>
              <span>Review Checklist</span>
            </div>
            <ul style={modalStyles.checklistList}>
              <li>Verify that medications, dosages, and frequencies are accurate.</li>
              <li>Ensure vital signs and patient condition are properly summarized.</li>
              <li>Check if the summary aligns with PhilHealth documentation standards.</li>
              <li>Confirm completeness and clarity of the course in the ward entry.</li>
            </ul>
          </div>

          <div style={modalStyles.notificationCard}>
            <div style={modalStyles.notificationTitle}>
              <span>✉</span>
              <span>Notify Physician to Review Again</span>
            </div>
            <textarea
              value={notificationMessage}
              onChange={(event) => setNotificationMessage(event.target.value)}
              placeholder="Add a message for the physician..."
              style={modalStyles.textarea}
            />
            <div style={modalStyles.actions}>
              <button type="button" style={modalStyles.primaryBtn} onClick={onRequestRevisions}>
                Send Physician Reminder
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
