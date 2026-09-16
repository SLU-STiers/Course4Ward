/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useEffect, useState } from 'react';
import { patientsApi } from '../../services/domainApi';
import { ui } from './styles';

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
  physicianId?: string;
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
  triageTime: '',
  heartRate: '',
  respRate: '',
  spo2: '',
  bp: '',
  temp: '',
  pain: '',
  notes: '',
});

export function AddPatientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<AddPatientFormResult>(emptyForm);
  const [physicians, setPhysicians] = useState<PhysicianOption[]>([]);
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
        physicianId: form.physicianId || undefined,
        triageTime: form.triageTime || undefined,
        heartRate: form.heartRate || undefined,
        respRate: form.respRate || undefined,
        spo2: form.spo2 || undefined,
        bp: form.bp || undefined,
        temp: form.temp || undefined,
        pain: form.pain || undefined,
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

  return (
    <div style={ui.overlay} onClick={onClose}>
      <form style={ui.modalWide} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div style={ui.modalHeaderRow}>
          <h3 style={{ ...ui.sectionTitle, margin: 0 }}>Add Patient</h3>
          <button type="button" style={ui.closeX} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={ui.detailGrid}>
          <Field label="First Name">
            <input
              style={{ ...ui.input, width: '100%', boxSizing: 'border-box' }}
              value={form.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              placeholder="First name"
              required
            />
          </Field>
          <Field label="Last Name">
            <input
              style={{ ...ui.input, width: '100%', boxSizing: 'border-box' }}
              value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              placeholder="Last name"
              required
            />
          </Field>
          <Field label="Age">
            <input
              style={{ ...ui.input, width: '100%', boxSizing: 'border-box' }}
              type="number"
              min={0}
              max={130}
              value={form.age || ''}
              onChange={(e) => setField('age', Number(e.target.value))}
              placeholder="Age"
              required
            />
          </Field>
          <Field label="Gender">
            <select
              style={{ ...ui.input, width: '100%', boxSizing: 'border-box' }}
              value={form.gender}
              onChange={(e) => setField('gender', e.target.value)}
            >
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Admission Date">
            <input
              style={{ ...ui.input, width: '100%', boxSizing: 'border-box' }}
              type="date"
              value={form.admissionDate}
              onChange={(e) => setField('admissionDate', e.target.value)}
              required
            />
          </Field>
          <Field label="Admission Status">
            <select
              style={{ ...ui.input, width: '100%', boxSizing: 'border-box' }}
              value={form.admissionStatus}
              onChange={(e) =>
                setField('admissionStatus', e.target.value as AddPatientFormResult['admissionStatus'])
              }
            >
              <option value="ADMITTED">Fully admitted (ward)</option>
              <option value="ER_OUTPATIENT">ER / Outpatient (not fully admitted)</option>
            </select>
          </Field>
        </div>

        <h4 style={ui.subhead}>Triage Assessment</h4>
        <div style={ui.triageGrid}>
          <TriageInput label="Time" value={form.triageTime} onChange={(v) => setField('triageTime', v)} placeholder="e.g. 08:30" />
          <TriageInput label="Heart Rate" value={form.heartRate} onChange={(v) => setField('heartRate', v)} placeholder="bpm" />
          <TriageInput label="Respiratory Rate" value={form.respRate} onChange={(v) => setField('respRate', v)} placeholder="/min" />
          <TriageInput label="SpO₂" value={form.spo2} onChange={(v) => setField('spo2', v)} placeholder="%" />
          <TriageInput label="BP" value={form.bp} onChange={(v) => setField('bp', v)} placeholder="e.g. 120/80" />
          <TriageInput label="Temp" value={form.temp} onChange={(v) => setField('temp', v)} placeholder="°C" />
          <TriageInput label="Pain" value={form.pain} onChange={(v) => setField('pain', v)} placeholder="0–10" />
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={ui.fieldLabel}>Notes</div>
          <textarea
            style={{ ...ui.input, width: '100%', minHeight: 72, resize: 'vertical', boxSizing: 'border-box' }}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Initial assessment / clinical notes..."
          />
        </div>

        <h4 style={ui.subhead}>Assigned Doctor</h4>
        <select
          style={{ ...ui.input, width: '100%', boxSizing: 'border-box' }}
          value={form.physicianId}
          onChange={(e) => setField('physicianId', e.target.value)}
        >
          <option value="">Select physician (optional)</option>
          {physicians.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              Dr. {doctor.firstName} {doctor.lastName} ({doctor.userId})
            </option>
          ))}
        </select>

        {error ? <p style={{ color: '#dc2626', fontSize: 12, margin: '10px 0 0' }}>{error}</p> : null}

        <div style={ui.modalActions}>
          <button type="button" style={ui.outlineBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" style={ui.primaryBtn} disabled={saving}>
            {saving ? 'Saving...' : 'Register Patient'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={ui.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function TriageInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={ui.triageCell}>
      <div style={ui.fieldLabel}>{label}</div>
      <input
        style={{ ...ui.input, width: '100%', boxSizing: 'border-box', marginTop: 4 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
