/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useEffect, useState } from 'react';
import { patientsApi } from '../../services/domainApi';
import { addPatient as s, ui } from './styles';
import { DoctorCard, SECTION_ICONS, Section } from './PatientModalParts';

type PhysicianOption = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
};

export type AddPatientFormResult = {
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  admissionDate: string;
  admissionStatus: 'ADMITTED' | 'ER_OUTPATIENT';
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
  age: 0,
  gender: 'Male',
  admissionDate: new Date().toISOString().slice(0, 10),
  admissionStatus: 'ADMITTED',
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
  const [form, setForm] = useState<AddPatientFormResult>(emptyForm);
  const [physicians, setPhysicians] = useState<PhysicianOption[]>([]);
  const [pendingDoctorId, setPendingDoctorId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (!form.age || form.age < 0) {
      setError('Please enter a valid age.');
      return;
    }
    if (!form.physicianId) {
      setError('Please select the attending physician.');
      return;
    }

    setSaving(true);
    try {
      await patientsApi.create({
        firstName,
        lastName,
        age: form.age,
        gender: form.gender,
        admissionDate: form.admissionDate
          ? new Date(`${form.admissionDate}T09:00:00`).toISOString()
          : undefined,
        admissionStatus: form.admissionStatus,
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

  const isEr = form.admissionStatus === 'ER_OUTPATIENT';

  return (
    <div style={ui.overlay} onClick={onClose}>
      <form style={s.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <header style={s.header}>
          <div>
            <div style={s.titleRow}>
              <h3 style={s.title}>Add Patient</h3>
              <span style={isEr ? ui.badgeEr : ui.badgeAdmitted}>
                {isEr ? 'ER / Outpatient' : 'Admitted'}
              </span>
            </div>
            <p style={s.subtitle}>Register a new patient and assign their care team.</p>
          </div>
          <button type="button" style={ui.closeX} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div style={s.body}>
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
                  style={s.input}
                  type="number"
                  min={0}
                  max={130}
                  value={form.age || ''}
                  onChange={(e) => setField('age', Number(e.target.value))}
                  placeholder="Years"
                  required
                />
              </Field>
              <Field label="Gender" required>
                <select
                  style={s.input}
                  value={form.gender}
                  onChange={(e) => setField('gender', e.target.value)}
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </Field>
              <Field label="Admission Date" required>
                <input
                  style={s.input}
                  type="date"
                  value={form.admissionDate}
                  onChange={(e) => setField('admissionDate', e.target.value)}
                  required
                />
              </Field>
              <div>
                <span style={s.label}>
                  Admission Status<span style={s.required}>*</span>
                </span>
                <div style={s.segmented} role="radiogroup" aria-label="Admission status">
                  {(
                    [
                      ['ADMITTED', 'Ward'],
                      ['ER_OUTPATIENT', 'ER / Outpatient'],
                    ] as const
                  ).map(([value, label]) => {
                    const active = form.admissionStatus === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        style={{ ...s.segment, ...(active ? s.segmentActive : {}) }}
                        onClick={() => setField('admissionStatus', value)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Section>

          <Section icon={SECTION_ICONS.triage} title="Triage Assessment" hint="Initial vital signs — leave blank if not taken">
            <div style={s.grid4}>
              <Vital label="Time" type="time" value={form.triageTime} onChange={(v) => setField('triageTime', v)} />
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
