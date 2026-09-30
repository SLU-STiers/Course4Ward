/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useEffect, useState } from 'react';
import { patientsApi } from '../../services/domainApi';
import type { PatientClass, Sex } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { formatDateMedium } from '../../lib/format';
import { SEX_LABEL } from '../../lib/patient';
import { addPatient as s, ui } from './styles';
import { DoctorCard, SECTION_ICONS, Section } from './PatientModalParts';
import { setRoomDestination } from './roomDestinations';
import { TimePickerField } from './TimePickerField';

type PhysicianOption = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
};

/** How the physician gave the order; '' = written / signed order. */
type OrderChannel = '' | 'VERBAL' | 'CALL' | 'SMS' | 'OTHER';

/** Registration choices; the order a class needs is entered with it. */
const CLASS_OPTIONS: { value: PatientClass; label: string; hint: string; order?: string }[] = [
  {
    value: 'EMERGENCY',
    label: 'Emergency',
    hint: 'Seen in the ER. The physician then orders observation, admission or discharge.',
  },
  {
    value: 'OUTPATIENT',
    label: 'Outpatient',
    hint: 'Clinic visit or day procedure. End the visit from the patient details when done.',
  },
  {
    value: 'OBSERVATION',
    label: 'Observation',
    hint: "Short stay (usually under 24 hours) to decide on admission. Needs the physician's observation order.",
    order: 'Observation',
  },
  {
    value: 'INPATIENT',
    label: 'Inpatient',
    hint: "Straight to the ward (direct admission, trauma, scheduled surgery). Needs the physician's admission order.",
    order: 'Admission',
  },
];

const ORDER_CHANNELS: [OrderChannel, string][] = [
  ['', 'Written / signed order'],
  ['VERBAL', 'Verbal'],
  ['CALL', 'Phone call'],
  ['SMS', 'SMS'],
  ['OTHER', 'Other'],
];

export type AddPatientFormResult = {
  firstName: string;
  lastName: string;
  /** Kept as typed text so an empty field is distinguishable from age 0 (newborn). */
  age: string;
  /** '' until the nurse picks one: there is deliberately no default. */
  gender: Sex | '';
  /**
   * EMERGENCY / OUTPATIENT need no order. OBSERVATION and INPATIENT (direct
   * admission, trauma, scheduled surgery) need the physician's observation /
   * admission order, entered below on their behalf.
   */
  patientClass: PatientClass;
  registrationOrder: string;
  registrationOrderChannel: OrderChannel;
  physicianId: string;
  consultingPhysicianIds: string[];
  triageTime: string;
  heartRate: string;
  respRate: string;
  spo2: string;
  bp: string;
  temp: string;
  pain: string;
  notes: string;
};
const emptyForm = (): AddPatientFormResult => ({
  firstName: '',
  lastName: '',
  age: '',
  gender: '',
  patientClass: 'EMERGENCY',
  registrationOrder: '',
  registrationOrderChannel: '',
  physicianId: '',
  consultingPhysicianIds: [],
  triageTime: '',
  heartRate: '',
  respRate: '',
  spo2: '',
  bp: '',
  temp: '',
  pain: '',
  notes: '',
});

const MAX_AGE = 130;

/** Returns the message to show under the Age field, or null when the value is valid. */
function ageError(value: string): string | null {
  if (value.trim() === '') return 'Age is required.';
  if (!/^\d+$/.test(value)) return 'Age must be a whole number of years.';
  if (Number(value) > MAX_AGE) return `Age must be between 0 and ${MAX_AGE}.`;
  return null;
}

// Unsaved entries survive the modal being closed (Cancel, backdrop click, browser
// back) until the patient is registered or the nurse discards them. sessionStorage
// clears when the tab closes; the owner id keeps one nurse's draft from another.
const DRAFT_KEY = 'nurse.addPatientDraft';

type AddPatientDraft = { ownerId: string; form: AddPatientFormResult; roomNumber: string };

function loadDraft(ownerId: string | undefined): AddPatientDraft | null {
  if (!ownerId) return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as AddPatientDraft;
    if (draft.ownerId !== ownerId) return null;
    const form = {
      ...emptyForm(),
      ...draft.form,
      age: String(draft.form?.age ?? ''),
      gender: toSex(draft.form?.gender),
    };
    // Fields of older versions of this form.
    for (const legacy of ['admissionStatus', 'admissionOrder', 'admissionOrderChannel']) {
      delete (form as Partial<Record<string, unknown>>)[legacy];
    }
    return {
      ownerId,
      form,
      roomNumber: draft.roomNumber ?? '',
    };
  } catch {
    return null;
  }
}

function saveDraft(draft: AddPatientDraft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage unavailable (private mode / quota) — the form still works without a draft.
  }
}

const isPristine = (form: AddPatientFormResult, roomNumber: string) =>
  roomNumber === '' && JSON.stringify(form) === JSON.stringify(emptyForm());

const isSex = (value: unknown): value is Sex => typeof value === 'string' && value in SEX_LABEL;

/** Older drafts stored the label ('Male'); anything unrecognised means "not picked yet". */
const toSex = (value: unknown): Sex | '' => {
  const upper = typeof value === 'string' ? value.toUpperCase() : value;
  return isSex(upper) ? upper : '';
};

const toNumber = (value: string) => (value.trim() === '' ? undefined : Number(value));

const doctorName = (doctor: PhysicianOption) => `Dr. ${doctor.firstName} ${doctor.lastName}`;
const doctorLabel = (doctor: PhysicianOption) => `${doctorName(doctor)} (${doctor.userId})`;

export function AddPatientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const ownerId = useAuthStore((state) => state.user?.id);
  const [initialDraft] = useState(() => loadDraft(ownerId));
  const [form, setForm] = useState<AddPatientFormResult>(() => initialDraft?.form ?? emptyForm());
  const [physicians, setPhysicians] = useState<PhysicianOption[]>([]);
  const [pendingDoctorId, setPendingDoctorId] = useState('');
  // Not sent to the API; kept in the in-memory room store only.
  const [roomNumber, setRoomNumber] = useState(() => initialDraft?.roomNumber ?? '');
  const [draftRestored, setDraftRestored] = useState(initialDraft !== null);
  const [ageTouched, setAgeTouched] = useState(initialDraft !== null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ageMessage = ageError(form.age);
  const classOption =
    CLASS_OPTIONS.find((option) => option.value === form.patientClass) ?? CLASS_OPTIONS[0];
  const toWard = form.patientClass === 'INPATIENT';
  /** 'Admission' / 'Observation' when the class needs a physician order. */
  const orderName = classOption.order;
  const showAgeError = ageTouched && ageMessage !== null;

  useEffect(() => {
    if (!ownerId) return;
    saveDraft(isPristine(form, roomNumber) ? null : { ownerId, form, roomNumber });
  }, [ownerId, form, roomNumber]);

  const discardDraft = () => {
    setForm(emptyForm());
    setRoomNumber('');
    setPendingDoctorId('');
    setAgeTouched(false);
    setError(null);
    setDraftRestored(false);
  };

  useEffect(() => {
    patientsApi
      .listPhysicians()
      .then(({ data }) => setPhysicians(data))
      .catch(() => setPhysicians([]));
  }, []);

  const setField = <K extends keyof AddPatientFormResult>(key: K, value: AddPatientFormResult[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const physicianById = (id: string) => physicians.find((doctor) => doctor.id === id);

  const setAttending = (id: string) => {
    setForm((prev) => ({
      ...prev,
      physicianId: id,
      consultingPhysicianIds: prev.consultingPhysicianIds.filter((other) => other !== id),
    }));
  };

  const addConsulting = () => {
    if (!pendingDoctorId) return;
    setForm((prev) => ({
      ...prev,
      consultingPhysicianIds: [...prev.consultingPhysicianIds, pendingDoctorId],
    }));
    setPendingDoctorId('');
  };

  const removeConsulting = (id: string) => {
    setForm((prev) => ({
      ...prev,
      consultingPhysicianIds: prev.consultingPhysicianIds.filter((other) => other !== id),
    }));
  };

  const availableToAdd = physicians.filter(
    (doctor) => doctor.id !== form.physicianId && !form.consultingPhysicianIds.includes(doctor.id),
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    if (!firstName || !lastName) {
      setError('Please enter the patient’s first and last name.');
      return;
    }
    if (ageMessage) {
      setAgeTouched(true);
      setError(ageMessage);
      return;
    }
    if (!form.gender) {
      setError('Please select the patient’s sex.');
      return;
    }
    if (!form.physicianId) {
      setError('Please select the attending physician.');
      return;
    }
    const registrationOrder = form.registrationOrder.trim();
    if (orderName && !registrationOrder) {
      setError(`Enter the physician's ${orderName.toLowerCase()} order, or register the patient as Emergency.`);
      return;
    }

    setSaving(true);
    try {
      const { data: created } = await patientsApi.create({
        firstName,
        lastName,
        age: Number(form.age),
        gender: form.gender,
        // No admissionDate: admission is always today, stamped by the server with the current time.
        patientClass: form.patientClass,
        // Observation / inpatient only with the physician's order, which is
        // filed on their behalf in the same request.
        ...(orderName && {
          registrationOrder,
          registrationOrderChannel: form.registrationOrderChannel || undefined,
        }),
        physicianId: form.physicianId,
        additionalPhysicianIds: form.consultingPhysicianIds,
        triageTime: form.triageTime || undefined,
        heartRate: toNumber(form.heartRate),
        respRate: toNumber(form.respRate),
        spo2: toNumber(form.spo2),
        bp: form.bp.replace(/\s+/g, '') || undefined,
        temp: toNumber(form.temp),
        pain: toNumber(form.pain),
        notes: form.notes || undefined,
      });
      const admissionId = created.admissions?.[0]?.id;
      if (toWard && admissionId) setRoomDestination(admissionId, roomNumber);
      saveDraft(null);
      onCreated();
      onClose();
    } catch (err: any) {
      const message = err?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'Could not register the patient. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const attending = physicianById(form.physicianId);

  return (
    <div style={ui.overlay} onClick={onClose}>
      <form style={s.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <header style={s.header}>
          <div>
            <div style={s.titleRow}>
              <h3 style={s.title}>Add Patient</h3>
              <span
                style={
                  {
                    EMERGENCY: ui.badgeEr,
                    OUTPATIENT: ui.badgeOutpatient,
                    OBSERVATION: ui.badgeObservation,
                    INPATIENT: ui.badgeAdmitted,
                  }[form.patientClass]
                }
              >
                {classOption.label}
              </span>
            </div>
            <p style={s.subtitle}>Register a new patient and assign their care team.</p>
          </div>
          <button type="button" style={ui.closeX} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div style={s.body}>
          {draftRestored && (
            <div style={s.draftNotice} role="status">
              <span>Restored the details you entered before closing this form.</span>
              <button type="button" style={s.draftDiscard} onClick={discardDraft}>
                Start over
              </button>
            </div>
          )}

          <Section icon={SECTION_ICONS.patientInfo} title="Patient Information" hint="Basic demographics and admission details">
            <div style={s.grid2}>
              <Field label="First Name" required>
                <input
                  style={s.input}
                  value={form.firstName}
                  onChange={(e) => setField('firstName', e.target.value)}
                  placeholder="e.g. Juan"
                  required
                />
              </Field>
              <Field label="Last Name" required>
                <input
                  style={s.input}
                  value={form.lastName}
                  onChange={(e) => setField('lastName', e.target.value)}
                  placeholder="e.g. Dela Cruz"
                  required
                />
              </Field>
              <Field label="Age" required>
                <input
                  style={{ ...s.input, ...(showAgeError ? s.inputInvalid : {}) }}
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={form.age}
                  onChange={(e) => setField('age', e.target.value.replace(/\D/g, ''))}
                  onBlur={() => setAgeTouched(true)}
                  placeholder="Years (0 for newborns)"
                  aria-invalid={showAgeError}
                  aria-describedby={showAgeError ? 'add-patient-age-error' : undefined}
                  required
                />
                {showAgeError && (
                  <span id="add-patient-age-error" style={s.fieldError}>
                    {ageMessage}
                  </span>
                )}
              </Field>
              <Field label="Sex" required>
                <select
                  style={s.input}
                  value={form.gender}
                  onChange={(e) => setField('gender', toSex(e.target.value))}
                  required
                >
                  <option value="" disabled>
                    Select sex
                  </option>
                  {Object.entries(SEX_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Triage Date" required>
                <input
                  style={{ ...s.input, ...s.inputReadOnly }}
                  value={formatDateMedium(new Date())}
                  readOnly
                  aria-readonly="true"
                  title="Patients are triaged with today's date"
                />
              </Field>
              {/* Full row: four classes don't fit in one grid column. */}
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={s.label}>
                  Admission Status<span style={s.required}>*</span>
                </span>
                <div
                  style={{ ...s.segmented, gridTemplateColumns: `repeat(${CLASS_OPTIONS.length}, 1fr)` }}
                  role="radiogroup"
                  aria-label="Admission status"
                >
                  {CLASS_OPTIONS.map(({ value, label }) => {
                    const active = form.patientClass === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        style={{ ...s.segment, ...(active ? s.segmentActive : {}) }}
                        onClick={() => setField('patientClass', value)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748b' }}>
              {classOption.hint}
            </p>
          </Section>

          {toWard && (
            <Section icon={SECTION_ICONS.room} title="Room Destination" hint="Ward room for the admitted patient">
              <div style={s.grid2}>
                <Field label="Room Number" required>
                  <input
                    style={s.input}
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. Room 305"
                    maxLength={20}
                    required
                  />
                </Field>
              </div>
            </Section>
          )}

          <Section icon={SECTION_ICONS.triage} title="Triage Assessment" hint="Initial vital signs — leave blank if not taken">
            <div style={s.grid4}>
              <TimePickerField value={form.triageTime} onChange={(v) => setField('triageTime', v)} />
              <Vital label="Heart Rate" unit="bpm" type="number" min={20} max={300} value={form.heartRate} onChange={(v) => setField('heartRate', v)} placeholder="—" />
              <Vital label="Resp. Rate" unit="/min" type="number" min={1} max={80} value={form.respRate} onChange={(v) => setField('respRate', v)} placeholder="—" />
              <Vital label="SpO₂" unit="%" type="number" min={50} max={100} value={form.spo2} onChange={(v) => setField('spo2', v)} placeholder="—" />
              <Vital label="Blood Pressure" unit="mmHg" value={form.bp} onChange={(v) => setField('bp', v)} placeholder="120/80" pattern="\d{2,3}\s*/\s*\d{2,3}" title="Systolic/diastolic, e.g. 120/80" />
              <Vital label="Temp" unit="°C" type="number" min={30} max={45} step={0.1} value={form.temp} onChange={(v) => setField('temp', v)} placeholder="—" />
              <Vital label="Pain" unit="/10" type="number" min={0} max={10} value={form.pain} onChange={(v) => setField('pain', v)} placeholder="—" />
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="Notes">
                <textarea
                  style={s.textarea}
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Chief complaint, initial assessment, clinical notes..."
                />
              </Field>
            </div>
          </Section>

          <Section icon={SECTION_ICONS.careTeam} title="Care Team" hint="Attending physician leads care; consultants advise">
            <Field label="Attending Physician" required>
              <select
                style={s.input}
                value={form.physicianId}
                onChange={(e) => setAttending(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select attending physician
                </option>
                {physicians.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctorLabel(doctor)}
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ marginTop: 16 }}>
              <span style={s.label}>Consulting Physicians</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.consultingPhysicianIds.length ? (
                  form.consultingPhysicianIds.map((id) => {
                    const doctor = physicianById(id);
                    if (!doctor) return null;
                    return (
                      <DoctorCard
                        key={id}
                        name={doctorName(doctor)}
                        meta={`Consulting · ${doctor.userId}`}
                        action={
                          <button
                            type="button"
                            style={s.removeIcon}
                            onClick={() => removeConsulting(id)}
                            aria-label={`Remove ${doctorName(doctor)}`}
                            title="Remove"
                          >
                            ✕
                          </button>
                        }
                      />
                    );
                  })
                ) : (
                  <div style={s.emptyDoctors}>No consulting physicians added.</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <select
                  style={{ ...s.input, flex: 1 }}
                  value={pendingDoctorId}
                  onChange={(e) => setPendingDoctorId(e.target.value)}
                  disabled={!availableToAdd.length}
                >
                  <option value="">
                    {availableToAdd.length ? 'Select a consulting physician' : 'No other physicians available'}
                  </option>
                  {availableToAdd.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctorLabel(doctor)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  style={{
                    ...ui.outlineBtn,
                    height: 40,
                    opacity: pendingDoctorId ? 1 : 0.5,
                    cursor: pendingDoctorId ? 'pointer' : 'not-allowed',
                  }}
                  onClick={addConsulting}
                  disabled={!pendingDoctorId}
                >
                  + Add
                </button>
              </div>
            </div>
          </Section>

          {orderName && (
            <Section
              icon={SECTION_ICONS.triage}
              title={`${orderName} Order`}
              hint={`The physician's ${orderName.toLowerCase()} order, entered on their behalf`}
            >
              <Field label="Order" required>
                <textarea
                  style={s.textarea}
                  value={form.registrationOrder}
                  onChange={(e) => setField('registrationOrder', e.target.value)}
                  placeholder={
                    toWard
                      ? 'e.g. Admit to Medical Ward. CBC, chest x-ray PA view.'
                      : 'e.g. For observation. Monitor vital signs every hour.'
                  }
                  maxLength={2000}
                  required
                />
              </Field>
              <div style={{ ...s.grid2, marginTop: 12 }}>
                <Field label="Ordered By">
                  <input
                    style={{ ...s.input, ...s.inputReadOnly }}
                    value={attending ? doctorName(attending) : 'Select the attending physician'}
                    readOnly
                    aria-readonly="true"
                    title="The order is attributed to the attending physician"
                  />
                </Field>
                <Field label="Order Given As" required>
                  <select
                    style={s.input}
                    value={form.registrationOrderChannel}
                    onChange={(e) => setField('registrationOrderChannel', e.target.value as OrderChannel)}
                  >
                    {ORDER_CHANNELS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>
          )}

          {error && (
            <div style={s.error} role="alert">
              <span aria-hidden="true">⚠</span>
              {error}
            </div>
          )}
        </div>

        <footer style={s.footer}>
          <button type="button" style={{ ...ui.outlineBtn, height: 40 }} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            style={{ ...ui.primaryBtn, height: 40, padding: '0 20px', opacity: saving ? 0.7 : 1 }}
            disabled={saving}
          >
            {saving ? 'Registering...' : 'Register Patient'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={s.label}>
        {label}
        {required && <span style={s.required}>*</span>}
      </span>
      {children}
    </label>
  );
}

function Vital({
  label,
  unit,
  value,
  onChange,
  ...inputProps
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'style'>) {
  return (
    <label style={s.vital}>
      <span style={s.vitalLabel}>{label}</span>
      <span style={s.vitalRow}>
        <input
          {...inputProps}
          style={s.vitalInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {unit && <span style={s.vitalUnit}>{unit}</span>}
      </span>
    </label>
  );
}
