/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { ui } from './styles';

import type { AdmissionStatus, PatientChart } from './types';

export function PatientDetailModal({
  chart,
  onClose,
  status,
  onDischarge,
}: {
  chart: PatientChart & { admissionKind?: 'Ward' | 'ER / Outpatient' };
  onClose: () => void;
  status?: AdmissionStatus;
  onDischarge?: () => void;
}) {
  return (
    <div style={ui.overlay} onClick={onClose}>
      <div style={ui.modalWide} onClick={(e) => e.stopPropagation()}>
        <div style={ui.modalHeaderRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ ...ui.sectionTitle, margin: 0 }}>Patient Details</h3>
            {status && (
              <span
                style={
                  status === 'Discharged'
                    ? ui.badgeDischarged
                    : status === 'ER / Outpatient'
                      ? ui.badgeEr
                      : ui.badgeAdmitted
                }
              >
                {status}
              </span>
            )}
          </div>
          <button type="button" style={ui.closeX} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={ui.detailGrid}>
          <div>
            <div style={ui.fieldLabel}>Name</div>
            <div style={ui.detailValue}>{chart.name}</div>
          </div>
          <div>
            <div style={ui.fieldLabel}>Age</div>
            <div style={ui.detailValue}>{chart.age}</div>
          </div>
          <div>
            <div style={ui.fieldLabel}>Admission Date</div>
            <div style={ui.detailValue}>{chart.admissionDate}</div>
          </div>
          <div>
            <div style={ui.fieldLabel}>Gender</div>
            <div style={ui.detailValue}>{chart.gender}</div>
          </div>
          <div>
            <div style={ui.fieldLabel}>Admission Status</div>
            <div style={ui.detailValue}>{chart.admissionKind ?? 'Ward'}</div>
          </div>
        </div>

        <h4 style={ui.subhead}>Triage Assessment</h4>
        <div style={ui.triageGrid}>
          <TriageCell label="Time" value={chart.triage.time} />
          <TriageCell label="Heart Rate" value={chart.triage.heartRate} />
          <TriageCell label="Respiratory Rate" value={chart.triage.respRate} />
          <TriageCell label="SpO₂" value={chart.triage.spo2} />
          <TriageCell label="BP" value={chart.triage.bp} />
          <TriageCell label="Temp" value={chart.triage.temp} />
          <TriageCell label="Pain" value={chart.triage.pain} />
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={ui.fieldLabel}>Notes</div>
          <div style={ui.notesBox}>{chart.triage.notes}</div>
        </div>

        <h4 style={ui.subhead}>Assigned Doctor</h4>
        {chart.assignedDoctors.length ? (
          <ul style={ui.doctorList}>
            {chart.assignedDoctors.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : (
          <p style={ui.muted}>No doctor assigned yet.</p>
        )}

        <div style={ui.modalActions}>
          <button type="button" style={ui.outlineBtn} onClick={onClose}>
            Close
          </button>
          {status !== 'Discharged' && onDischarge && (
            <button type="button" style={ui.primaryBtn} onClick={onDischarge}>
              Discharge Patient
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TriageCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={ui.triageCell}>
      <div style={ui.fieldLabel}>{label}</div>
      <div style={ui.detailValue}>{value}</div>
    </div>
  );
}
