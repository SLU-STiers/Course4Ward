/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { ui } from './styles';

import { AVAILABLE_DOCTORS } from './data';
import type { AdmissionStatus, PatientChart } from './types';

export function PatientDetailModal({
  chart,
  canAddDoctor,
  onClose,
  onAddDoctor,
  status,
  onDischarge,
}: {
  chart: PatientChart;
  canAddDoctor: boolean;
  onClose: () => void;
  onAddDoctor?: (doctor: string) => void;
  status?: AdmissionStatus;
  onDischarge?: () => void;
}) {
  const [doctorPick, setDoctorPick] = useState('');
  const unusedDoctors = AVAILABLE_DOCTORS.filter((d) => !chart.assignedDoctors.includes(d));

  return (
    <div style={ui.overlay} onClick={onClose}>
      <div style={ui.modalWide} onClick={(e) => e.stopPropagation()}>
        <div style={ui.modalHeaderRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ ...ui.sectionTitle, margin: 0 }}>Patient Details</h3>
            {status && (
              <span style={status === 'Admitted' ? ui.badgeAdmitted : ui.badgeDischarged}>
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

        {canAddDoctor && (
          <div style={ui.addDoctorRow}>
            <select
              value={doctorPick}
              onChange={(e) => setDoctorPick(e.target.value)}
              style={{ ...ui.input, flex: 1 }}
            >
              <option value="">Select doctor</option>
              {unusedDoctors.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={ui.primaryBtn}
              disabled={!doctorPick}
              onClick={() => {
                if (!doctorPick || !onAddDoctor) return;
                onAddDoctor(doctorPick);
                setDoctorPick('');
              }}
            >
              Add Doctor
            </button>
          </div>
        )}

        <div style={ui.modalActions}>
          <button type="button" style={ui.outlineBtn} onClick={onClose}>
            Close
          </button>
          {status === 'Admitted' && onDischarge && (
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
