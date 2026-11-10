/** Part of the nurse dashboard — corrects a registered patient's own details (they end up on the CF4). */

import { useEffect, useState, type ReactNode } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { patientsApi } from '../../services/domainApi';
import { apiErrorMessage } from '../../lib/apiError';
import { computeAge, toDateKey, todayValue } from '../../lib/format';
import { INSURANCE_LABEL, SEX_LABEL } from '../../lib/patient';
import type { InsuranceType, Patient, PatientDetailsUpdate, Sex } from '../../types';
import { addPatient as s } from './styles';
import {
  NAME_PATTERN,
  PHONE_PATTERN,
  RELIGIONS,
  RELIGION_OTHER,
  dateOfBirthError,
  oldestBirthDate,
  sanitizeName,
  sanitizePhoneNumber,
} from './patientForm';

type DetailsForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Sex | '';
  contactNumber: string;
  address: string;
  insurance: InsuranceType | '';
  insuranceOther: string;
  religion: string;
  religionOther: string;
  contactPersonName: string;
  contactPersonNumber: string;
  contactPersonAddress: string;
};

function formOf(patient: Patient): DetailsForm {
  const religion = patient.religion ?? '';
  const listed = religion === '' || RELIGIONS.includes(religion);
  return {
    firstName: patient.firstName,
    middleName: patient.middleName ?? '',
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth ? toDateKey(patient.dateOfBirth) : '',
    gender: patient.gender ?? '',
    contactNumber: patient.contactNumber ?? '',
    address: patient.address ?? '',
    insurance: patient.insurance ?? '',
    insuranceOther: patient.insuranceOther ?? '',
    religion: listed ? religion : RELIGION_OTHER,
    religionOther: listed ? '' : religion,
    contactPersonName: patient.contactPersonName ?? '',
    contactPersonNumber: patient.contactPersonNumber ?? '',
    contactPersonAddress: patient.contactPersonAddress ?? '',
  };
}

const religionOf = (form: DetailsForm) =>
  form.religion === RELIGION_OTHER ? form.religionOther.trim() : form.religion;

/** Field -> message for everything that blocks saving. */
function problemsOf(form: DetailsForm): Partial<Record<keyof DetailsForm, string>> {
  const problems: Partial<Record<keyof DetailsForm, string>> = {};
  const name = (key: 'firstName' | 'middleName' | 'lastName' | 'contactPersonName', label: string, required: boolean) => {
    const value = form[key].trim();
    if (!value) {
      if (required) problems[key] = `${label} is required.`;
    } else if (!NAME_PATTERN.test(value)) {
      problems[key] = `${label} may contain letters, spaces, hyphens, apostrophes, and periods only.`;
    }
  };
  const phone = (key: 'contactNumber' | 'contactPersonNumber', label: string) => {
    if (form[key] && !PHONE_PATTERN.test(form[key])) problems[key] = `${label} must contain exactly 11 digits.`;
  };
  name('firstName', 'First name', true);
  name('middleName', 'Middle name', false);
  name('lastName', 'Last name', true);
  const dob = dateOfBirthError(form.dateOfBirth);
  if (dob) problems.dateOfBirth = dob;
  if (!form.gender) problems.gender = 'Sex is required.';
  phone('contactNumber', 'Personal number');
  if (form.insurance === 'OTHER' && !form.insuranceOther.trim()) {
    problems.insuranceOther = 'Specify the patient’s insurance.';
  }
  if (form.religion === RELIGION_OTHER && !form.religionOther.trim()) {
    problems.religionOther = 'Specify the patient’s religion.';
  }
  name('contactPersonName', 'The contact person’s name', false);
  phone('contactPersonNumber', 'Contact number');
  return problems;
}

/** Only what changed; a cleared optional field is sent as `null`. */
function changesOf(original: DetailsForm, form: DetailsForm): PatientDetailsUpdate {
  const update: PatientDetailsUpdate = {};
  const text = (key: keyof DetailsForm) => form[key].trim();
  const changed = (key: keyof DetailsForm) => text(key) !== original[key].trim();
  const optional = (key: Exclude<keyof PatientDetailsUpdate, 'firstName' | 'lastName' | 'gender' | 'dateOfBirth' | 'insurance' | 'religion'>) => {
    if (changed(key)) update[key] = text(key) || null;
  };
  if (changed('firstName')) update.firstName = text('firstName');
  if (changed('lastName')) update.lastName = text('lastName');
  if (form.dateOfBirth !== original.dateOfBirth) update.dateOfBirth = form.dateOfBirth;
  if (form.gender && form.gender !== original.gender) update.gender = form.gender;
  optional('middleName');
  optional('contactNumber');
  optional('address');
  if (form.insurance !== original.insurance) update.insurance = form.insurance || null;
  if (form.insurance === 'OTHER' && (changed('insuranceOther') || form.insurance !== original.insurance)) {
    update.insuranceOther = text('insuranceOther');
  }
  if (religionOf(form) !== religionOf(original)) update.religion = religionOf(form) || null;
  optional('contactPersonName');
  optional('contactPersonNumber');
  optional('contactPersonAddress');
  return update;
}

export function EditPatientDetailsModal({
  patientId,
  onClose,
  onSaved,
}: {
  patientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [original, setOriginal] = useState<DetailsForm | null>(null);
  const [form, setForm] = useState<DetailsForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    patientsApi
      .getOne(patientId)
      .then(({ data }) => {
        if (cancelled) return;
        setOriginal(formOf(data));
        setForm(formOf(data));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load the patient’s details.'));
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const problems = form ? problemsOf(form) : {};
  const changes = form && original ? changesOf(original, form) : {};
  const hasChanges = Object.keys(changes).length > 0;
  const age = form && !problems.dateOfBirth ? computeAge(form.dateOfBirth) : null;

  const set = <K extends keyof DetailsForm>(key: K, value: DetailsForm[K]) => {
    setSaveError(null);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const error = (key: keyof DetailsForm) =>
    attempted && problems[key] ? <span style={s.fieldError}>{problems[key]}</span> : null;

  const save = async () => {
    setAttempted(true);
    if (!form || Object.keys(problems).length || !hasChanges) return;
    setSaving(true);
    setSaveError(null);
    try {
      await patientsApi.update(patientId, changes);
      onSaved();
      onClose();
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Could not save the patient’s details.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title="Edit Patient Details"
      description="Correct the patient’s record. These details are printed on the PhilHealth CF4."
      size="lg"
      closeOnBackdrop={false}
      footer={
        <>
          {saveError && (
            <span role="alert" style={{ ...s.fieldError, marginTop: 0, marginRight: 'auto' }}>
              {saveError}
            </span>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!form || !hasChanges}>
            Save Changes
          </Button>
        </>
      }
    >
      {loadError ? (
        <div style={s.error} role="alert">
          <span aria-hidden="true">⚠</span>
          {loadError}
        </div>
      ) : !form ? (
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Loading the patient’s details…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={s.grid2}>
            <EditField label="First Name" required>
              <input
                style={s.input}
                value={form.firstName}
                onChange={(e) => set('firstName', sanitizeName(e.target.value))}
                maxLength={150}
              />
              {error('firstName')}
            </EditField>
            <EditField label="Middle Name">
              <input
                style={s.input}
                value={form.middleName}
                onChange={(e) => set('middleName', sanitizeName(e.target.value))}
                placeholder="Optional"
                maxLength={150}
              />
              {error('middleName')}
            </EditField>
            <EditField label="Last Name" required>
              <input
                style={s.input}
                value={form.lastName}
                onChange={(e) => set('lastName', sanitizeName(e.target.value))}
                maxLength={150}
              />
              {error('lastName')}
            </EditField>
            <EditField label="Date of Birth" required>
              <input
                style={s.input}
                type="date"
                min={oldestBirthDate()}
                max={todayValue()}
                value={form.dateOfBirth}
                onChange={(e) => set('dateOfBirth', e.target.value)}
              />
              {error('dateOfBirth') ??
                (age !== null && (
                  <span style={s.fieldHint}>{age === 1 ? '1 year old' : `${age} years old`}</span>
                ))}
            </EditField>
            <EditField label="Sex" required>
              <select
                style={s.select}
                value={form.gender}
                onChange={(e) => set('gender', e.target.value as Sex)}
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
              {error('gender')}
            </EditField>
            <EditField label="Personal Number">
              <input
                style={s.input}
                inputMode="numeric"
                value={form.contactNumber}
                onChange={(e) => set('contactNumber', sanitizePhoneNumber(e.target.value))}
                placeholder="11 digits"
              />
              {error('contactNumber')}
            </EditField>
            <EditField label="Insurance">
              <select
                style={s.select}
                value={form.insurance}
                onChange={(e) => set('insurance', e.target.value as InsuranceType | '')}
              >
                <option value="">Not recorded</option>
                {Object.entries(INSURANCE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {form.insurance === 'OTHER' && (
                <input
                  style={{ ...s.input, marginTop: 8 }}
                  value={form.insuranceOther}
                  onChange={(e) => set('insuranceOther', e.target.value)}
                  placeholder="Specify the insurance"
                  maxLength={100}
                />
              )}
              {error('insuranceOther')}
            </EditField>
            <EditField label="Religion">
              <select style={s.select} value={form.religion} onChange={(e) => set('religion', e.target.value)}>
                <option value="">Not recorded</option>
                {RELIGIONS.map((religion) => (
                  <option key={religion} value={religion}>
                    {religion}
                  </option>
                ))}
                <option value={RELIGION_OTHER}>Others</option>
              </select>
              {form.religion === RELIGION_OTHER && (
                <input
                  style={{ ...s.input, marginTop: 8 }}
                  value={form.religionOther}
                  onChange={(e) => set('religionOther', e.target.value)}
                  placeholder="Specify the religion"
                  maxLength={100}
                />
              )}
              {error('religionOther')}
            </EditField>
            <div style={{ gridColumn: '1 / -1' }}>
              <EditField label="Address">
                <input
                  style={s.input}
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  maxLength={300}
                />
              </EditField>
            </div>
          </div>

          <div>
            <h5 style={{ ...s.subsectionTitle, marginTop: 0 }}>Contact Person</h5>
            <div style={s.grid2}>
              <EditField label="Contact Person">
                <input
                  style={s.input}
                  value={form.contactPersonName}
                  onChange={(e) => set('contactPersonName', sanitizeName(e.target.value))}
                  maxLength={150}
                />
                {error('contactPersonName')}
              </EditField>
              <EditField label="Contact Number">
                <input
                  style={s.input}
                  inputMode="numeric"
                  value={form.contactPersonNumber}
                  onChange={(e) => set('contactPersonNumber', sanitizePhoneNumber(e.target.value))}
                  placeholder="11 digits"
                />
                {error('contactPersonNumber')}
              </EditField>
              <div style={{ gridColumn: '1 / -1' }}>
                <EditField label="Contact Person Address">
                  <input
                    style={s.input}
                    value={form.contactPersonAddress}
                    onChange={(e) => set('contactPersonAddress', e.target.value)}
                    maxLength={300}
                  />
                </EditField>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
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
