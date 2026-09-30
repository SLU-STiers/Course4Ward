/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useEffect, useState } from 'react';
import { patientsApi } from '../../services/domainApi';
import { TriageAssessmentPanel } from '../../components/patients/TriageAssessmentPanel';
import { addPatient as s, ui } from './styles';
import { DoctorCard, SECTION_ICONS, Section } from './PatientModalParts';
import { getRoomDestination, setRoomDestination } from './roomDestinations';
import { OBSERVATION_LIMIT_HOURS, hoursSince } from '../../lib/patient';

import type { AdmissionStatus, PatientChart } from './types';

type PhysicianOption = { id: string; userId: string; firstName: string; lastName: string };

export function PatientDetailModal({
  chart,
  onClose,
  status,
  onDischarge,
  dischargeBlockedReason,
  onObserve,
  observeBlockedReason,
  onAdmit,
  admitBlockedReason,
  actionBusy = false,
  actionError,
  onCareTeamChanged,
}: {
  /** `classSince`: when the patient entered their current class (observation timer). */
  chart: PatientChart & { classSince?: string };
  onClose: () => void;
  status?: AdmissionStatus;
  /** Discharges the patient, or ends an outpatient visit. */
  onDischarge?: () => void;
  /** Set while discharge is not allowed yet, e.g. no physician discharge order. */
  dischargeBlockedReason?: string;
  /** Places an emergency patient / outpatient under observation. */
  onObserve?: () => void;
  /** Set while observation is not allowed yet, e.g. no physician observation order. */
  observeBlockedReason?: string;
  /** Formally admits an emergency / outpatient / observation patient to the ward. */
  onAdmit?: () => void;
  /** Set while admission is not allowed yet, e.g. no physician admission order. */
  admitBlockedReason?: string;
  actionBusy?: boolean;
  actionError?: string | null;
  /** When provided (and the patient is not discharged), nurses can add consulting physicians. */
  onCareTeamChanged?: () => void;
}) {
  const [attending, ...consulting] = chart.assignedDoctors;
  const badge: AdmissionStatus = status ?? 'Admitted';
  const discharged = badge === 'Discharged';
  const canObserve = !discharged && Boolean(onObserve);
  const canAdmit = !discharged && Boolean(onAdmit);
  const canDischarge = !discharged && Boolean(onDischarge);
  // Every offered action is waiting on a physician order: say so once. Each
  // button's tooltip still names its own order.
  const offered = [
    canObserve ? observeBlockedReason : null,
    canAdmit ? admitBlockedReason : null,
    canDischarge ? dischargeBlockedReason : null,
  ].filter((reason) => reason !== null);
  const footerNote =
    actionError ||
    (offered.length && offered.every(Boolean)
      ? offered.length === 1
        ? offered[0]
        : "Waiting for a physician's order"
      : undefined);
  const observationHours = badge === 'Observation' ? hoursSince(chart.classSince) : 0;
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
                  {
                    Discharged: ui.badgeDischarged,
                    Emergency: ui.badgeEr,
                    Observation: ui.badgeObservation,
                    Outpatient: ui.badgeOutpatient,
                    Admitted: ui.badgeAdmitted,
                  }[badge]
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
          {badge === 'Observation' && (
            <div
              role="status"
              style={{
                ...s.draftNotice,
                ...(observationHours >= OBSERVATION_LIMIT_HOURS
                  ? { backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }
                  : {}),
              }}
            >
              <span>
                Under observation for {observationHours} hour{observationHours === 1 ? '' : 's'}
                {observationHours >= OBSERVATION_LIMIT_HOURS
                  ? ` — past ${OBSERVATION_LIMIT_HOURS} hours. The physician should decide to admit or discharge.`
                  : '. The physician decides to admit or discharge.'}
              </span>
            </div>
          )}

          <Section icon={SECTION_ICONS.patientInfo} title="Patient Information" hint="Basic demographics and admission details">
            <div style={s.grid2}>
              <ReadField label="Full Name" value={chart.name} />
              <ReadField label="Age" value={chart.age ? `${chart.age} years` : '—'} />
              <ReadField label="Gender" value={chart.gender} />
              <ReadField label="Admission Date" value={chart.admissionDate} />
              <ReadField label="Admission Status" value={badge} />
            </div>
          </Section>

          {badge === 'Admitted' && (
            <Section icon={SECTION_ICONS.room} title="Room Destination" hint="Ward room for the admitted patient">
              <RoomDestinationField key={chart.recordId} admissionId={chart.recordId} />
            </Section>
          )}

          <Section icon={SECTION_ICONS.triage} title="Triage Assessment" hint="Priority and vital signs recorded at triage">
            <TriageAssessmentPanel triage={chart.triage} />
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

        {/* Wraps so the note gets its own line above up to four buttons. */}
        <footer style={{ ...s.footer, flexWrap: 'wrap' }}>
          {footerNote && (
            <span
              role={actionError ? 'alert' : undefined}
              style={{
                flexBasis: '100%',
                fontSize: 12,
                color: actionError ? '#dc2626' : '#64748b',
              }}
            >
              {footerNote}
            </span>
          )}
          <button type="button" style={{ ...ui.outlineBtn, height: 40 }} onClick={onClose}>
            Close
          </button>
          {canObserve && onObserve && (
            <ActionButton
              label={actionBusy ? 'Working...' : 'Place Under Observation'}
              blockedReason={observeBlockedReason}
              busy={actionBusy}
              onClick={onObserve}
            />
          )}
          {canAdmit && onAdmit && (
            <ActionButton
              label={actionBusy ? 'Working...' : 'Admit Patient'}
              blockedReason={admitBlockedReason}
              busy={actionBusy}
              onClick={onAdmit}
            />
          )}
          {canDischarge && onDischarge && (
            <ActionButton
              label={
                actionBusy ? 'Working...' : badge === 'Outpatient' ? 'End Visit' : 'Discharge Patient'
              }
              blockedReason={dischargeBlockedReason}
              busy={actionBusy}
              onClick={onDischarge}
            />
          )}
        </footer>
      </div>
    </div>
  );
}

function RoomDestinationField({ admissionId }: { admissionId: string }) {
  const [room, setRoom] = useState(() => getRoomDestination(admissionId));
  const [draft, setDraft] = useState(room);
  const [editing, setEditing] = useState(!room);

  const save = () => {
    const value = draft.trim();
    if (!value) return;
    setRoomDestination(admissionId, value);
    setRoom(value);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(room);
    setEditing(!room);
  };

  if (!editing) {
    return (
      <div>
        <span style={s.label}>Room Number</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ ...s.readValue, flex: 1 }}>{room}</div>
          <button
            type="button"
            style={{ ...ui.outlineBtn, height: 40 }}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <span style={s.label}>Room Number</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ ...s.input, flex: 1 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
          placeholder="e.g. Room 305"
          maxLength={20}
          aria-label="Room number"
        />
        <button
          type="button"
          style={{
            ...ui.outlineBtn,
            height: 40,
            opacity: draft.trim() ? 1 : 0.5,
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
          }}
          onClick={save}
          disabled={!draft.trim()}
        >
          {room ? 'Save' : '+ Add'}
        </button>
        {room && (
          <button type="button" style={{ ...ui.outlineBtn, height: 40 }} onClick={cancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/** Footer action that stays visible but disabled until the physician's order exists. */
function ActionButton({
  label,
  blockedReason,
  busy,
  onClick,
}: {
  label: string;
  blockedReason?: string;
  busy: boolean;
  onClick: () => void;
}) {
  const disabled = busy || Boolean(blockedReason);
  return (
    <button
      type="button"
      style={{
        ...ui.primaryBtn,
        height: 40,
        padding: '0 20px',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      disabled={disabled}
      title={blockedReason}
      onClick={onClick}
    >
      {label}
    </button>
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
