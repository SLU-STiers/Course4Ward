/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { Button, Modal, TriageBadge } from '../../components/ui';
import { TriageAssessmentPanel } from '../../components/patients/TriageAssessmentPanel';
import { triageForDisplay } from '../../lib/triage';
import type { PatientAdmission } from '../../types';
import { manage } from './styles';

/**
 * One-line triage summary of the selected patient's current admission (level +
 * key vitals) above the orders; "View triage" opens the full assessment the
 * nurse recorded at registration.
 */
export function TriageSummaryBar({
  patientName,
  admission,
}: {
  patientName: string;
  admission?: PatientAdmission;
}) {
  const [open, setOpen] = useState(false);
  const triage = triageForDisplay(admission);
  const vitals = [
    ['HR', triage.heartRate, 'bpm'],
    ['BP', triage.bp, 'mmHg'],
    ['SpO₂', triage.spo2, '%'],
    ['Temp', triage.temp, '°C'],
  ].filter(([, value]) => value !== '—');

  return (
    <section style={manage.triageBar} aria-label="Triage assessment">
      <span style={manage.triageBarTitle}>Triage</span>
      <TriageBadge level={triage.level} />
      <span style={manage.triageBarVitals}>
        {vitals.length
          ? vitals.map(([label, value, unit]) => (
              <span key={label}>
                {label} <strong style={{ color: '#0f172a' }}>{value}</strong> {unit}
              </span>
            ))
          : 'No vital signs recorded at triage.'}
      </span>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} disabled={!admission}>
        View triage
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Triage Assessment"
        description={`${patientName} — priority and vital signs recorded at triage`}
        size="lg"
      >
        <TriageAssessmentPanel triage={triage} />
      </Modal>
    </section>
  );
}
