import type { CSSProperties } from 'react';
import { TriageBadge } from '../ui';
import { VITAL_FIELDS, triageLevelInfo, type TriageDisplay } from '../../lib/triage';

/**
 * Read-only triage assessment of an admission: priority level, the vital signs
 * taken at triage and the nurse's notes. Shared by the nurse Patient Details
 * modal, the physician's Manage view and the claims review modal, so every
 * role reads the same record the same way. Build `triage` with `triageForDisplay`.
 */
export function TriageAssessmentPanel({ triage }: { triage: TriageDisplay }) {
  const info = triageLevelInfo(triage.level);
  return (
    <div>
      <div style={styles.levelRow}>
        <span style={styles.label}>Triage Level</span>
        <TriageBadge level={triage.level} />
        {info && (
          <span style={styles.levelHint}>
            {info.tag} · {info.target}
          </span>
        )}
      </div>

      <div style={styles.vitals}>
        {VITAL_FIELDS.map((field) => {
          const value = triage[field.key];
          const hasValue = Boolean(value) && value !== '—';
          return (
            <div key={field.key} style={styles.vital}>
              <span style={styles.vitalLabel}>{field.label}</span>
              <span style={styles.vitalRow}>
                <span style={{ ...styles.vitalValue, color: hasValue ? '#0f172a' : '#94a3b8' }}>
                  {hasValue ? value : '—'}
                </span>
                {hasValue && 'unit' in field && <span style={styles.vitalUnit}>{field.unit}</span>}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <span style={styles.label}>Notes</span>
        <div style={styles.notes}>{triage.notes}</div>
      </div>

      {triage.recordedBy && <p style={styles.recordedBy}>Recorded by {triage.recordedBy}</p>}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 },
  levelRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 },
  levelHint: { fontSize: 12, color: '#64748b' },
  vitals: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 },
  vital: {
    display: 'block',
    minWidth: 0,
    boxSizing: 'border-box',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '8px 10px',
  },
  vitalLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  vitalRow: { display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4, minWidth: 0 },
  vitalValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  vitalUnit: { fontSize: 11, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' },
  notes: {
    minHeight: 60,
    boxSizing: 'border-box',
    padding: '10px 12px',
    fontSize: 14,
    lineHeight: 1.5,
    color: '#334155',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    whiteSpace: 'pre-wrap',
  },
  recordedBy: { margin: '10px 0 0', fontSize: 12, color: '#64748b' },
};
