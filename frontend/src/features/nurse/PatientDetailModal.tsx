/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useEffect, useState } from 'react';
import { patientsApi } from '../../services/domainApi';
import { addPatient as s, ui } from './styles';
import { DoctorCard, SECTION_ICONS, Section, VITAL_FIELDS } from './PatientModalParts';

import type { AdmissionStatus, PatientChart } from './types';

type PhysicianOption = { id: string; userId: string; firstName: string; lastName: string };

export function PatientDetailModal({
  chart,
  onClose,
  status,
  onDischarge,
  onCareTeamChanged,
}: {
  chart: PatientChart & { admissionKind?: 'Ward' | 'ER / Outpatient' };
  onClose: () => void;
  status?: AdmissionStatus;
  onDischarge?: () => void;
  /** When provided (and the patient is not discharged), nurses can add consulting physicians. */
  onCareTeamChanged?: () => void;
}) {
  const [attending, ...consulting] = chart.assignedDoctors;
  const badge: AdmissionStatus =
    status ?? (chart.admissionKind === 'ER / Outpatient' ? 'ER / Outpatient' : 'Admitted');
  const canAddConsulting = Boolean(onCareTeamChanged) && badge !== 'Discharged';

  const [physicians, setPhysicians] = useState<PhysicianOption[]>([]);
  const [pendingDoctorId, setPendingDoctorId] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!canAddConsulting) return;
    patientsApi
      .listPhysicians()
      .then(({ data }) => setPhysicians(data))
      .catch(() => setPhysicians([]));
  }, [canAddConsulting]);

  const onTeam = new Set(chart.assignedDoctors);
  const availableToAdd = physicians.filter(
    (doctor) => !onTeam.has(`Dr. ${doctor.firstName} ${doctor.lastName}`),
  );

  const addConsulting = async () => {
    if (!pendingDoctorId || !onCareTeamChanged) return;
    setAdding(true);
    setAddError(null);
    try {
      await patientsApi.addConsultingPhysician(chart.recordId, pendingDoctorId);
      setPendingDoctorId('');
      onCareTeamChanged();
    } catch (err: any) {
      const message = err?.response?.data?.message;
      setAddError(
        Array.isArray(message) ? message.join(', ') : message || 'Could not add the physician.',
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={ui.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <header style={s.header}>
          <div>
            <div style={s.titleRow}>
              <h3 style={s.title}>Patient Details</h3>
              <span
                style={
                  badge === 'Discharged'
                    ? ui.badgeDischarged
                    : badge === 'ER / Outpatient'
                      ? ui.badgeEr
                      : ui.badgeAdmitted
                }
              >
                {badge}
              </span>
            </div>
            <p style={s.subtitle}>Admission record {chart.recordId}</p>
          </div>
          <button type="button" style={ui.closeX} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div style={s.body}>
          <Section icon={SECTION_ICONS.patientInfo} title="Patient Information" hint="Basic demographics and admission details">
            <div style={s.grid2}>
              <ReadField label="Full Name" value={chart.name} />
              <ReadField label="Age" value={chart.age ? `${chart.age} years` : '—'} />
              <ReadField label="Gender" value={chart.gender} />
              <ReadField label="Admission Date" value={chart.admissionDate} />
              <ReadField label="Admission Status" value={chart.admissionKind ?? 'Ward'} />
            </div>
          </Section>

          <Section icon={SECTION_ICONS.triage} title="Triage Assessment" hint="Vital signs recorded at admission">
            <div style={s.grid4}>
              {VITAL_FIELDS.map((field) => {
                const value = chart.triage[field.key];
                const hasValue = value && value !== '—';
                return (
                  <div key={field.key} style={s.vital}>
                    <span style={s.vitalLabel}>{field.label}</span>
                    <span style={s.vitalRow}>
                      <span style={{ ...s.vitalValue, color: hasValue ? '#0f172a' : '#94a3b8' }}>
                        {hasValue ? value : '—'}
                      </span>
                      {hasValue && 'unit' in field && <span style={s.vitalUnit}>{field.unit}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14 }}>
              <span style={s.label}>Notes</span>
              <div style={s.readNotes}>{chart.triage.notes}</div>
            </div>
          </Section>

          <Section icon={SECTION_ICONS.careTeam} title="Care Team" hint="Attending physician leads care; consultants advise">
            <span style={s.label}>Attending Physician</span>
            {attending ? (
              <DoctorCard name={attending} meta="Attending" />
            ) : (
              <div style={s.emptyDoctors}>No attending physician assigned yet.</div>
            )}

            <div style={{ marginTop: 16 }}>
              <span style={s.label}>Consulting Physicians</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {consulting.length ? (
                  consulting.map((name) => <DoctorCard key={name} name={name} meta="Consulting" />)
                ) : (
                  <div style={s.emptyDoctors}>No consulting physicians.</div>
                )}
              </div>

              {canAddConsulting && (
                <>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <select
                      style={{ ...s.input, flex: 1 }}
                      value={pendingDoctorId}
                      onChange={(e) => setPendingDoctorId(e.target.value)}
                      disabled={adding || !availableToAdd.length}
                      aria-label="Consulting physician to add"
                    >
                      <option value="">
                        {availableToAdd.length
                          ? 'Select a consulting physician'
                          : 'No other physicians available'}
                      </option>
                      {availableToAdd.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          Dr. {doctor.firstName} {doctor.lastName} ({doctor.userId})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      style={{
                        ...ui.outlineBtn,
                        height: 40,
                        opacity: pendingDoctorId && !adding ? 1 : 0.5,
                        cursor: pendingDoctorId && !adding ? 'pointer' : 'not-allowed',
                      }}
                      onClick={addConsulting}
                      disabled={!pendingDoctorId || adding}
                    >
                      {adding ? 'Adding...' : '+ Add'}
                    </button>
                  </div>
                  {addError && (
                    <div style={{ ...s.error, marginTop: 10 }} role="alert">
                      <span aria-hidden="true">⚠</span>
                      {addError}
                    </div>
                  )}
                </>
              )}
            </div>
          </Section>
        </div>

        <footer style={s.footer}>
          <button type="button" style={{ ...ui.outlineBtn, height: 40 }} onClick={onClose}>
            Close
          </button>
          {status !== 'Discharged' && onDischarge && (
            <button
              type="button"
              style={{ ...ui.primaryBtn, height: 40, padding: '0 20px' }}
              onClick={onDischarge}
            >
              Discharge Patient
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={s.label}>{label}</span>
      <div style={s.readValue}>{value || '—'}</div>
    </div>
  );
}
