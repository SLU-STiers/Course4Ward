/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import leftArrowImg from '../../Img/left-arrow.png';
import { patientsApi } from '../../services/domainApi';
import { TriageAssessmentPanel } from '../../components/patients/TriageAssessmentPanel';
import { addPatient as s, ui } from './styles';
import { DoctorCard, SECTION_ICONS, Section } from './PatientModalParts';
import { RoomPicker, normalizeRoom, roomProblem, useWardRooms } from './RoomPicker';
import { OBSERVATION_LIMIT_HOURS, hoursSince } from '../../lib/patient';
import { PhysicianWardSelect } from './PhysicianWardSelect';

import type { AdmissionStatus, PatientChart } from './types';
import type { PhysicianOption } from '../../types';

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
  onRoomChanged,
  ordersColumn,
  orderActionsColumn,
  orderActionsTitle = 'Order on Behalf of Physician',
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
  /** Called after the admitted patient's room is saved, to reload the list. */
  onRoomChanged?: () => void;
  /** Middle column: the submitted physician orders. With it, the modal splits into three columns. */
  ordersColumn?: ReactNode;
  /** Right column: entering orders on the physician's behalf and updating their status. */
  orderActionsColumn?: ReactNode;
  /** Heading of the right column, also shown on its folded strip. */
  orderActionsTitle?: string;
}) {
  const threeColumn = Boolean(ordersColumn || orderActionsColumn);
  // Side columns start open each time the modal opens; the orders column stays the main one.
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
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

  const header = (
        <header style={s.header}>
          <div>
            <div style={s.titleRow}>
              <h3 style={s.title}>{threeColumn ? 'Submitted Physician Orders' : 'Patient Details'}</h3>
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
            <p style={s.subtitle}>
              {threeColumn && <strong style={{ color: '#0f172a' }}>{chart.name} · </strong>}
              Admission record {chart.recordId}
            </p>
          </div>
          <button type="button" style={ui.closeX} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
  );

  const Field = threeColumn ? CompactField : ReadField;

  const details = (
        <>
          {threeColumn && (
            <div style={layout.patientBanner}>
              <span style={layout.avatar} aria-hidden="true">
                {initialsOf(chart.name)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={layout.bannerName}>{chart.name}</div>
                <div style={layout.bannerMeta}>
                  {[chart.age ? `${chart.age} yrs` : '', chart.gender, chart.room ? `Room ${chart.room}` : '']
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </div>
              </div>
            </div>
          )}
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
            <div style={threeColumn ? layout.fieldGrid : s.grid2}>
              <Field label="Full Name" value={chart.name} />
              <Field label="Age" value={chart.age ? `${chart.age} years` : '—'} />
              <Field label="Gender" value={chart.gender} />
              <Field label="Admission Date" value={chart.admissionDate} />
              <Field label="Admission Status" value={badge} />
              <Field label="Personal Number" value={chart.contact?.contactNumber ?? ''} />
              <Field label="Religion" value={chart.contact?.religion ?? ''} />
              <Field label="Insurance" value={chart.contact?.insurance ?? ''} />
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Address" value={chart.contact?.address ?? ''} />
              </div>
            </div>

            <h5 style={s.subsectionTitle}>Contact Person</h5>
            <div style={threeColumn ? layout.fieldGrid : s.grid2}>
              <Field label="Contact Person" value={chart.contact?.contactPersonName ?? ''} />
              <Field label="Contact Number" value={chart.contact?.contactPersonNumber ?? ''} />
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Contact Person Address" value={chart.contact?.contactPersonAddress ?? ''} />
              </div>
            </div>
          </Section>

          {badge === 'Admitted' && (
            <Section icon={SECTION_ICONS.room} title="Room Destination" hint="Ward room for the admitted patient">
              <RoomDestinationField
                key={`${chart.recordId}:${chart.room ?? ''}`}
                admissionId={chart.recordId}
                currentRoom={chart.room ?? ''}
                onSaved={onRoomChanged}
              />
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
                <div style={layout.addPanel}>
                  <span style={{ ...s.label, marginBottom: 0 }}>Add Consulting Physician</span>
                  <PhysicianWardSelect
                    physicians={availableToAdd}
                    value={pendingDoctorId}
                    onChange={setPendingDoctorId}
                    selectStyle={{ ...s.select, width: '100%', fontSize: 14 }}
                    disabled={adding || !availableToAdd.length}
                    placeholder={availableToAdd.length ? 'Select a physician' : 'No other physicians available'}
                    ariaLabel="Consulting physician to add"
                  />
                  {addError && (
                    <div style={s.error} role="alert">
                      <span aria-hidden="true">⚠</span>
                      {addError}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                      {adding ? 'Adding...' : '+ Add Physician'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Section>
        </>
  );

  const footer = (
        /* Wraps so the note gets its own line above up to four buttons. */
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
  );

  if (!threeColumn) {
    return (
      <div style={ui.overlay} onClick={onClose}>
        <div style={s.modal} onClick={(e) => e.stopPropagation()}>
          {header}
          <div style={s.body}>{details}</div>
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div style={ui.overlay} onClick={onClose}>
      <div style={layout.stack} onClick={(e) => e.stopPropagation()}>
        <SideModal
          side="left"
          title="Patient Details"
          hint="Patient information, triage and care team"
          open={leftOpen}
          onToggle={() => setLeftOpen((open) => !open)}
        >
          {details}
        </SideModal>
        <div style={{ ...s.modal, ...layout.mainModal }}>
          {header}
          <div style={{ ...s.body, flex: 1, minHeight: 0 }}>{ordersColumn}</div>
          {footer}
        </div>
        <SideModal
          side="right"
          title={orderActionsTitle}
          hint="Record an order received from the physician"
          open={rightOpen}
          onToggle={() => setRightOpen((open) => !open)}
        >
          {orderActionsColumn}
        </SideModal>
      </div>
    </div>
  );
}

function RoomDestinationField({
  admissionId,
  currentRoom,
  onSaved,
}: {
  admissionId: string;
  currentRoom: string;
  onSaved?: () => void;
}) {
  const [room, setRoom] = useState(currentRoom);
  const [draft, setDraft] = useState(currentRoom);
  const [editing, setEditing] = useState(!currentRoom);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rooms, failed, reload } = useWardRooms(editing);

  const typed = normalizeRoom(draft);
  const problem = roomProblem(draft, rooms, admissionId);
  const canSave = Boolean(typed) && !problem && !saving && typed !== room;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await patientsApi.assignRoom(admissionId, typed);
      setRoom(data.room?.number ?? typed);
      setEditing(false);
      onSaved?.();
    } catch (err: any) {
      // Someone may have just taken the room: refresh what is free.
      reload();
      const message = err?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Could not save the room.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(room);
    setError(null);
    setEditing(!room);
  };

  if (!editing) {
    return (
      <div>
        <span style={s.label}>Room Number</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ ...s.readValue, flex: 1 }}>Room {room}</div>
          <button
            type="button"
            style={{ ...ui.outlineBtn, height: 40 }}
            onClick={() => setEditing(true)}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <span style={s.label}>Room Number</span>
      <RoomPicker
        value={draft}
        onChange={(value) => {
          setDraft(value);
          setError(null);
        }}
        rooms={rooms}
        failed={failed}
        admissionId={admissionId}
        disabled={saving}
      />
      {error && (
        <div style={{ ...s.error, marginTop: 10 }} role="alert">
          <span aria-hidden="true">⚠</span>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        {room && (
          <button type="button" style={{ ...ui.outlineBtn, height: 40 }} onClick={cancel} disabled={saving}>
            Cancel
          </button>
        )}
        <button
          type="button"
          style={{
            ...ui.outlineBtn,
            height: 40,
            opacity: canSave ? 1 : 0.5,
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
          onClick={save}
          disabled={!canSave}
        >
          {saving ? 'Saving...' : room ? 'Save Room' : '+ Assign Room'}
        </button>
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

/** Open side modal widths; they narrow on small screens so the main orders modal keeps room. */
const SIDE_WIDTH = { left: 'clamp(380px, 30vw, 480px)', right: 'clamp(300px, 24vw, 380px)' };
const SLIDE = '260ms cubic-bezier(0.22, 1, 0.36, 1)';

const layout: Record<string, CSSProperties> = {
  patientBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
  },
  avatar: {
    flexShrink: 0,
    width: 44,
    height: 44,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 800,
    color: '#1e40af',
    backgroundColor: '#dbeafe',
  },
  bannerName: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  bannerMeta: { marginTop: 2, fontSize: 13, color: '#64748b' },
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px 16px' },
  fieldLabel: {
    display: 'block',
    marginBottom: 3,
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldValue: { fontSize: 14, fontWeight: 600, color: '#0f172a', overflowWrap: 'anywhere' },
  sideBody: { flex: 1, minHeight: 0, padding: 16, gap: 14 },
  addPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 14,
    padding: 12,
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
  },
  stack: {
    display: 'flex',
    gap: 20,
    width: 1560,
    maxWidth: '96vw',
    height: '92vh',
  },
  mainModal: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    minWidth: 0,
    width: 'auto',
    maxWidth: 'none',
    height: '100%',
    maxHeight: 'none',
  },
  sideSlot: {
    position: 'relative',
    flexShrink: 0,
    height: '100%',
    transition: `width ${SLIDE}`,
  },
  sideModal: {
    position: 'absolute',
    top: 0,
    height: '100%',
    maxWidth: 'none',
    maxHeight: 'none',
    transition: `opacity ${SLIDE}, transform ${SLIDE}, visibility 0s linear`,
  },
  foldTab: {
    position: 'absolute',
    top: '50%',
    zIndex: 2,
    width: 32,
    height: 64,
    padding: 0,
    border: '1px solid var(--dashboard-border, #e2e8f0)',
    borderRadius: 12,
    backgroundColor: 'var(--dashboard-surface, #ffffff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: `left ${SLIDE}, right ${SLIDE}, transform 240ms ease, background-color 160ms ease`,
  },
};

/**
 * A separate modal beside the main one. It slides shut like the dashboard
 * sidebar, leaving its arrow tab against the main modal's edge.
 */
function SideModal({
  side,
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  side: 'left' | 'right';
  title: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const edge = side === 'left' ? 'right' : 'left';
  // The arrow image points left: towards the folding direction while open.
  const rotation = (side === 'left') === open ? 0 : 180;
  const tabTransform = (scale: number) => `translateY(-50%) rotate(${rotation}deg) scale(${scale})`;

  return (
    <div style={{ ...layout.sideSlot, width: open ? SIDE_WIDTH[side] : 0 }}>
      <section
        aria-label={title}
        aria-hidden={!open}
        style={{
          ...s.modal,
          ...layout.sideModal,
          width: SIDE_WIDTH[side],
          // Anchored to the main modal so it slides away from it.
          [edge]: 0,
          opacity: open ? 1 : 0,
          transform: open ? 'translateX(0)' : `translateX(${side === 'left' ? -32 : 32}px)`,
          visibility: open ? 'visible' : 'hidden',
          transitionDelay: open ? '0ms' : '0ms, 0ms, 260ms',
        }}
      >
        <header style={s.header}>
          <div>
            <h3 style={s.title}>{title}</h3>
            <p style={s.subtitle}>{hint}</p>
          </div>
        </header>
        <div style={{ ...s.body, ...layout.sideBody }}>{children}</div>
      </section>
      <button
        type="button"
        aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
        aria-expanded={open}
        title={open ? `Collapse ${title}` : `Expand ${title}`}
        onClick={onToggle}
        style={{
          ...layout.foldTab,
          // Open: centred in the gap between the modals. Folded: just outside the main modal.
          [edge]: open ? -26 : -20,
          transform: tabTransform(1),
          boxShadow: side === 'left' ? '4px 0 12px rgba(15, 23, 42, 0.08)' : '-4px 0 12px rgba(15, 23, 42, 0.08)',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.transform = tabTransform(1.06);
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.transform = tabTransform(1);
        }}
      >
        <img src={leftArrowImg} alt="" aria-hidden="true" style={{ width: 20, height: 20 }} />
      </button>
    </div>
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

/** Read-only value as plain text, for the narrow side modal. */
function CompactField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={layout.fieldLabel}>{label}</span>
      <div style={layout.fieldValue}>{value || '—'}</div>
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
