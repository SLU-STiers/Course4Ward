/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useEffect, useRef, useState } from 'react';
import { patientsApi } from '../../services/domainApi';
import type { DuplicatePatientError, InsuranceType, PhysicianOption, Sex, TriageLevel } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { computeAge, formatDateMedium, todayValue } from '../../lib/format';
import { apiErrorMessage } from '../../lib/apiError';
import {
  DATE_PATTERN,
  NAME_PATTERN,
  ORDER_CHANNELS,
  RELIGIONS,
  RELIGION_OTHER,
  dateOfBirthError,
  oldestBirthDate,
  sanitizeName,
  sanitizePhoneNumber,
  type OrderChannel,
} from './patientForm';
import { INSURANCE_LABEL, SEX_LABEL } from '../../lib/patient';
import { TRIAGE_LEVELS, triageLevelInfo } from '../../lib/triage';
import { addPatient as s, TEAL, ui } from './styles';
import { DoctorCard, SECTION_ICONS, Section } from './PatientModalParts';
import { RoomPicker, normalizeRoom, roomProblem, useWardRooms } from './RoomPicker';
import { TimePickerField } from './TimePickerField';
import { PhysicianWardSelect } from './PhysicianWardSelect';

const REGISTRATION_CLASS = {
  value: 'INPATIENT',
  label: 'Inpatient',
  hint: "Needs the physician's admission order before the patient is registered.",
  order: 'Admission',
} as const;

/** General complaints offered in the Chief Complaint checklist. */
const CHIEF_COMPLAINTS = [
  'Abdominal pain (tummy ache)',
  'Allergic reaction',
  'Back pain',
  'Body weakness / fatigue',
  'Chest pain',
  'Colds / runny nose',
  'Cough',
  'Diarrhea',
  'Dizziness',
  'Ear pain',
  'Eye pain / redness',
  'Fever',
  'Headache',
  'Joint pain',
  'Loss of appetite',
  'Nausea / vomiting',
  'Painful urination',
  'Shortness of breath',
  'Skin rash / itching',
  'Sore throat',
  'Toothache',
  'Wound / injury',
];

export type AddPatientFormResult = {
  firstName: string;
  middleName: string;
  lastName: string;
  /** YYYY-MM-DD from the date input; printed on the CF4, so never estimated. */
  dateOfBirth: string;
  /** '' until the nurse picks one: there is deliberately no default. */
  gender: Sex | '';
  patientClass: 'INPATIENT';
  registrationOrder: string;
  registrationOrderChannel: OrderChannel;
  physicianId: string;
  consultingPhysicianIds: string[];
  /** The patient's own contact / mobile number. */
  contactNumber: string;
  address: string;
  insurance: InsuranceType | '';
  /** Required when insurance is OTHER. */
  insuranceOther: string;
  /** One of `RELIGIONS`, `RELIGION_OTHER`, or '' when not picked yet. */
  religion: string;
  /** Required when religion is `RELIGION_OTHER`. */
  religionOther: string;
  contactPersonName: string;
  contactPersonNumber: string;
  contactPersonAddress: string;
  /** 5-level triage priority; null until the nurse picks one. */
  triageLevel: TriageLevel | null;
  /** `YYYY-MM-DD`; starts as today. */
  triageDate: string;
  /** 24h `HH:mm`; starts as the current time. */
  triageTime: string;
  heartRate: string;
  respRate: string;
  spo2: string;
  bp: string;
  temp: string;
  pain: string;
  /** Complaints checked in the single dropdown. At least one is required. */
  chiefComplaints: string[];
  notes: string;
};
const emptyForm = (): AddPatientFormResult => ({
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  patientClass: 'INPATIENT' as const,
  registrationOrder: '',
  registrationOrderChannel: '',
  physicianId: '',
  consultingPhysicianIds: [],
  contactNumber: '',
  address: '',
  insurance: '',
  insuranceOther: '',
  religion: '',
  religionOther: '',
  contactPersonName: '',
  contactPersonNumber: '',
  contactPersonAddress: '',
  triageLevel: null,
  triageDate: '',
  triageTime: '',
  heartRate: '',
  respRate: '',
  spo2: '',
  bp: '',
  temp: '',
  pain: '',
  chiefComplaints: [],
  notes: '',
});

const BP_PATTERN = /\d{2,3}\s*\/\s*\d{2,3}/;

type VitalKey = 'heartRate' | 'respRate' | 'spo2' | 'bp' | 'temp' | 'pain';

type VitalRule = {
  key: VitalKey;
  label: string;
  /** Range enforced by the number input; absent when the input uses `pattern`. */
  min?: number;
  max?: number;
  unit?: string;
  pattern?: RegExp;
  patternHint?: string;
};

/** Vital-sign rules in form order, re-checked here because the form submits with `noValidate`. */
const VITAL_RULES: VitalRule[] = [
  { key: 'heartRate', label: 'Heart rate', min: 20, max: 300, unit: 'bpm' },
  { key: 'respRate', label: 'Respiratory rate', min: 1, max: 80, unit: '/min' },
  { key: 'spo2', label: 'SpO₂', min: 50, max: 100, unit: '%' },
  { key: 'bp', label: 'Blood pressure', pattern: BP_PATTERN, patternHint: 'systolic/diastolic, e.g. 120/80' },
  { key: 'temp', label: 'Temperature', min: 30, max: 45, unit: '°C' },
  { key: 'pain', label: 'Pain score', min: 0, max: 10, unit: '/10' },
];

/** Vitals that only accept whole numbers (temperature allows one decimal). */
const WHOLE_VITALS = new Set<VitalKey>(['heartRate', 'respRate', 'spo2', 'pain']);


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
      patientClass: 'INPATIENT' as const,
      firstName: sanitizeName(typeof draft.form?.firstName === 'string' ? draft.form.firstName : ''),
      middleName: sanitizeName(typeof draft.form?.middleName === 'string' ? draft.form.middleName : ''),
      lastName: sanitizeName(typeof draft.form?.lastName === 'string' ? draft.form.lastName : ''),
      dateOfBirth:
        typeof draft.form?.dateOfBirth === 'string' && DATE_PATTERN.test(draft.form.dateOfBirth)
          ? draft.form.dateOfBirth
          : '',
      gender: toSex(draft.form?.gender),
      contactNumber: sanitizePhoneNumber(
        typeof draft.form?.contactNumber === 'string' ? draft.form.contactNumber : '',
      ),
      contactPersonName: sanitizeName(
        typeof draft.form?.contactPersonName === 'string' ? draft.form.contactPersonName : '',
      ),
      contactPersonNumber: sanitizePhoneNumber(
        typeof draft.form?.contactPersonNumber === 'string' ? draft.form.contactPersonNumber : '',
      ),
      insurance: toInsurance(draft.form?.insurance),
      ...toReligion(draft.form?.religion, draft.form?.religionOther),
      triageLevel: triageLevelInfo(draft.form?.triageLevel)?.level ?? null,
      triageDate:
        typeof draft.form?.triageDate === 'string' && DATE_PATTERN.test(draft.form.triageDate)
          ? draft.form.triageDate
          : '',
      chiefComplaints: toComplaints(draft.form?.chiefComplaints),
    };
    // Fields of older versions of this form.
    for (const legacy of ['admissionStatus', 'admissionOrder', 'admissionOrderChannel', 'age']) {
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

const nowClock = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

/** Triage is usually recorded as the patient arrives, so blank date and time default to now. */
const withTriageNow = (form: AddPatientFormResult): AddPatientFormResult => ({
  ...form,
  triageDate: form.triageDate || todayValue(),
  triageTime: form.triageTime || nowClock(),
});

/** The defaulted triage date and time alone don't make a draft worth keeping. */
const isPristine = (form: AddPatientFormResult, roomNumber: string) =>
  roomNumber === '' &&
  JSON.stringify({ ...form, triageDate: '', triageTime: '' }) === JSON.stringify(emptyForm());

const isSex = (value: unknown): value is Sex => typeof value === 'string' && value in SEX_LABEL;

/** Older drafts stored the label ('Male'); anything unrecognised means "not picked yet". */
const toSex = (value: unknown): Sex | '' => {
  const upper = typeof value === 'string' ? value.toUpperCase() : value;
  return isSex(upper) ? upper : '';
};

/** Fits a draft's religion to the dropdown; free text from older drafts moves under "Others". */
function toReligion(value: unknown, other: unknown): Pick<AddPatientFormResult, 'religion' | 'religionOther'> {
  const religion = typeof value === 'string' ? value.trim() : '';
  const religionOther = typeof other === 'string' ? other : '';
  if (religion === RELIGION_OTHER || RELIGIONS.includes(religion)) return { religion, religionOther };
  return religion ? { religion: RELIGION_OTHER, religionOther: religion } : { religion: '', religionOther };
}

const toInsurance = (value: unknown): InsuranceType | '' =>
  typeof value === 'string' && value in INSURANCE_LABEL ? (value as InsuranceType) : '';

/** Keeps known complaints, dropping blanks left by the old five-slot dropdowns. */
function toComplaints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const picked: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && CHIEF_COMPLAINTS.includes(item) && !picked.includes(item)) {
      picked.push(item);
    }
  }
  return picked;
}

const toNumber = (value: string) => (value.trim() === '' ? undefined : Number(value));

const doctorName = (doctor: PhysicianOption) => `Dr. ${doctor.firstName} ${doctor.lastName}`;

/** Form controls that submitting can jump to when they still need attention. */
type FieldKey =
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'dateOfBirth'
  | 'gender'
  | 'contactNumber'
  | 'insurance'
  | 'insuranceOther'
  | 'religion'
  | 'religionOther'
  | 'address'
  | 'contactPersonName'
  | 'contactPersonNumber'
  | 'contactPersonAddress'
  | 'room'
  | 'triageLevel'
  | 'triageDate'
  | 'triageTime'
  | 'heartRate'
  | 'respRate'
  | 'spo2'
  | 'bp'
  | 'temp'
  | 'pain'
  | 'chiefComplaints'
  | 'notes'
  | 'physician'
  | 'consultingPhysician'
  | 'registrationOrder';

type RegistrationProblem = { field: FieldKey; message: string };

const fieldId = (field: FieldKey) => `add-patient-field-${field}`;
const FOCUSABLE_SELECTOR = 'input, select, textarea, button';

/** Scrolls the control for `field` into view and focuses it, so the nurse lands where the fix is. */
function focusField(root: HTMLElement | null, field: FieldKey) {
  const container = root?.querySelector<HTMLElement>(`#${fieldId(field)}`);
  if (!container) return;
  const control = container.matches(FOCUSABLE_SELECTOR)
    ? container
    : container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  container.scrollIntoView({ block: 'center', behavior: 'smooth' });
  control?.focus({ preventScroll: true });
}

/**
 * Everything still blocking registration, in the order it appears on the form.
 * Submitting jumps to the first entry; the rest stay in reserve for later attempts.
 */
function registrationProblems(
  form: AddPatientFormResult,
  roomNumber: string,
  rooms: Parameters<typeof roomProblem>[1],
  toWard: boolean,
  needsOrder: boolean,
): RegistrationProblem[] {
  const problems: RegistrationProblem[] = [];
  const add = (field: FieldKey, message: string) => problems.push({ field, message });
  const required = (field: FieldKey, value: string, label: string) => {
    if (!value.trim()) add(field, `${label} is required.`);
  };
  const firstName = form.firstName.trim();
  const middleName = form.middleName.trim();
  const lastName = form.lastName.trim();

  // Patient information
  if (!firstName) add('firstName', 'First name is required.');
  else if (!NAME_PATTERN.test(firstName)) {
    add('firstName', 'First name may contain letters, spaces, hyphens, apostrophes, and periods only.');
  }
  if (middleName && !NAME_PATTERN.test(middleName)) {
    add('middleName', 'Middle name may contain letters, spaces, hyphens, apostrophes, and periods only.');
  }
  if (!lastName) add('lastName', 'Last name is required.');
  else if (!NAME_PATTERN.test(lastName)) {
    add('lastName', 'Last name may contain letters, spaces, hyphens, apostrophes, and periods only.');
  }
  const dateOfBirth = dateOfBirthError(form.dateOfBirth);
  if (dateOfBirth) add('dateOfBirth', dateOfBirth);
  if (!form.gender) add('gender', 'Sex is required.');
  required('contactNumber', form.contactNumber, 'Personal number');
  if (form.contactNumber.trim() && !/^\d{11}$/.test(form.contactNumber)) {
    add('contactNumber', 'Personal number must contain exactly 11 digits.');
  }
  if (!form.insurance) add('insurance', 'Insurance is required.');
  else if (form.insurance === 'OTHER' && !form.insuranceOther.trim()) {
    add('insuranceOther', 'Specify the patient’s insurance.');
  }
  if (!form.religion) add('religion', 'Religion is required.');
  else if (form.religion === RELIGION_OTHER && !form.religionOther.trim()) {
    add('religionOther', 'Specify the patient’s religion.');
  }
  required('address', form.address, 'Address');

  // Contact person
  const contactName = form.contactPersonName.trim();
  required('contactPersonName', contactName, 'Contact person');
  if (contactName && !NAME_PATTERN.test(contactName)) {
    add(
      'contactPersonName',
      'The contact person’s name may contain letters, spaces, hyphens, apostrophes, and periods only.',
    );
  }
  required('contactPersonNumber', form.contactPersonNumber, 'Contact person’s number');
  if (form.contactPersonNumber.trim() && !/^\d{11}$/.test(form.contactPersonNumber)) {
    add('contactPersonNumber', 'Contact number must contain exactly 11 digits.');
  }
  required('contactPersonAddress', form.contactPersonAddress, 'Contact person’s address');

  // Room destination
  if (toWard) {
    if (!normalizeRoom(roomNumber)) add('room', 'Room number is required.');
    else {
      const problem = roomProblem(roomNumber, rooms);
      if (problem) add('room', `${problem}.`);
    }
  }

  // Triage assessment
  if (!form.triageLevel) add('triageLevel', 'Triage level (ESI) is required.');
  required('triageDate', form.triageDate, 'Triage date');
  if (form.triageDate && form.triageDate > todayValue()) {
    add('triageDate', 'Triage date cannot be in the future.');
  }
  required('triageTime', form.triageTime, 'Triage time');
  for (const rule of VITAL_RULES) {
    const raw = String(form[rule.key]).trim();
    if (!raw) {
      add(rule.key, `${rule.label} is required.`);
      continue;
    }
    if (rule.pattern) {
      if (!rule.pattern.test(raw)) add(rule.key, `${rule.label} must be ${rule.patternHint}.`);
      continue;
    }
    const value = Number(raw);
    const min = rule.min ?? Number.NEGATIVE_INFINITY;
    const max = rule.max ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(value)) {
      add(rule.key, `${rule.label} must be a number.`);
    } else if (value < min || value > max) {
      add(rule.key, `${rule.label} must be between ${min} and ${max} ${rule.unit}.`);
    } else if (WHOLE_VITALS.has(rule.key) && !Number.isInteger(value)) {
      add(rule.key, `${rule.label} must be a whole number.`);
    }
  }
  if (!form.chiefComplaints.some((complaint) => CHIEF_COMPLAINTS.includes(complaint))) {
    add('chiefComplaints', 'Chief complaint is required.');
  }
  if (!form.notes.trim()) add('notes', 'Notes are required.');

  // Care team
  if (!form.physicianId) add('physician', 'Attending physician is required.');

  // Admission order
  if (needsOrder && !form.registrationOrder.trim()) {
    add('registrationOrder', 'The physician’s admission order is required.');
  }

  return problems;
}

export function AddPatientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const ownerId = useAuthStore((state) => state.user?.id);
  const [initialDraft] = useState(() => loadDraft(ownerId));
  const [form, setForm] = useState<AddPatientFormResult>(() =>
    withTriageNow(initialDraft?.form ?? emptyForm()),
  );
  const [physicians, setPhysicians] = useState<PhysicianOption[]>([]);
  const [pendingDoctorId, setPendingDoctorId] = useState('');
  const [roomNumber, setRoomNumber] = useState(() => initialDraft?.roomNumber ?? '');
  const [draftRestored, setDraftRestored] = useState(initialDraft !== null);
  const [dobTouched, setDobTouched] = useState(initialDraft !== null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  /** The server found this person already registered. */
  const [duplicate, setDuplicate] = useState<DuplicatePatientError | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const dobMessage = dateOfBirthError(form.dateOfBirth);
  const age = dobMessage ? null : computeAge(form.dateOfBirth);
  const classOption = REGISTRATION_CLASS;
  const toWard = form.patientClass === 'INPATIENT';
  const { rooms, failed: roomsFailed, reload: reloadRooms } = useWardRooms(toWard);
  /** 'Admission' when the class needs a physician order. */
  const orderName = classOption.order;
  const showDobError = dobTouched && dobMessage !== null;
  const problems = registrationProblems(form, roomNumber, rooms, toWard, Boolean(orderName));
  const ready = problems.length === 0;

  /**
   * Message shown beside a field once registration was attempted. Recomputed on every
   * render, so a field's reminder disappears as soon as that field is fixed.
   */
  const problemFor = (field: FieldKey) => {
    if (!submitAttempted) return undefined;
    return problems.find((problem) => problem.field === field)?.message;
  };

  const fieldError = (field: FieldKey) => {
    const message = problemFor(field);
    return message ? <span style={s.fieldError}>{message}</span> : null;
  };

  useEffect(() => {
    if (!ownerId) return;
    saveDraft(isPristine(form, roomNumber) ? null : { ownerId, form, roomNumber });
  }, [ownerId, form, roomNumber]);

  const discardDraft = () => {
    setForm(withTriageNow(emptyForm()));
    setRoomNumber('');
    setPendingDoctorId('');
    setDobTouched(false);
    setSubmitAttempted(false);
    setServerError(null);
    setDuplicate(null);
    setDraftRestored(false);
  };

  useEffect(() => {
    patientsApi
      .listPhysicians()
      .then(({ data }) => setPhysicians(data))
      .catch(() => setPhysicians([]));
  }, []);

  const updateForm = (update: (prev: AddPatientFormResult) => AddPatientFormResult) => {
    setServerError(null);
    setDuplicate(null);
    setForm(update);
  };

  const setField = <K extends keyof AddPatientFormResult>(key: K, value: AddPatientFormResult[K]) => {
    updateForm((prev) => ({ ...prev, [key]: value }));
  };

  const physicianById = (id: string) => physicians.find((doctor) => doctor.id === id);

  const setAttending = (id: string) => {
    updateForm((prev) => ({
      ...prev,
      physicianId: id,
      consultingPhysicianIds: prev.consultingPhysicianIds.filter((other) => other !== id),
    }));
  };

  const addConsulting = () => {
    if (!pendingDoctorId) return;
    updateForm((prev) => ({
      ...prev,
      consultingPhysicianIds: [...prev.consultingPhysicianIds, pendingDoctorId],
    }));
    setPendingDoctorId('');
  };

  const removeConsulting = (id: string) => {
    updateForm((prev) => ({
      ...prev,
      consultingPhysicianIds: prev.consultingPhysicianIds.filter((other) => other !== id),
    }));
  };

  const availableToAdd = physicians.filter(
    (doctor) => doctor.id !== form.physicianId && !form.consultingPhysicianIds.includes(doctor.id),
  );

  /** This stay: what a re-admission sends for a patient already on record. */
  const admissionPayload = () => {
    const complaints = form.chiefComplaints.filter((complaint) => CHIEF_COMPLAINTS.includes(complaint));
    return {
      // No admissionDate: admission is always today, stamped by the server with the current time.
      patientClass: form.patientClass,
      // Inpatient only with the physician's admission order, which is
      // filed on their behalf in the same request.
      ...(orderName && {
        registrationOrder: form.registrationOrder.trim(),
        registrationOrderChannel: form.registrationOrderChannel || undefined,
      }),
      roomNumber: toWard ? normalizeRoom(roomNumber) : undefined,
      physicianId: form.physicianId,
      additionalPhysicianIds: form.consultingPhysicianIds,
      triageLevel: form.triageLevel ?? undefined,
      triageDate: form.triageDate || undefined,
      triageTime: form.triageTime || undefined,
      heartRate: toNumber(form.heartRate),
      respRate: toNumber(form.respRate),
      spo2: toNumber(form.spo2),
      bp: form.bp.replace(/\s+/g, '') || undefined,
      temp: toNumber(form.temp),
      pain: toNumber(form.pain),
      // No chief-complaint column: it leads the initial assessment text.
      notes: `Chief complaint: ${complaints.join(', ')}.\n\n${form.notes.trim()}`,
    };
  };

  const detailsPayload = () => ({
    firstName: form.firstName.trim(),
    middleName: form.middleName.trim() || undefined,
    lastName: form.lastName.trim(),
    dateOfBirth: form.dateOfBirth,
    gender: form.gender,
    contactNumber: form.contactNumber.trim() || undefined,
    address: form.address.trim() || undefined,
    insurance: form.insurance || undefined,
    insuranceOther: form.insurance === 'OTHER' ? form.insuranceOther.trim() : undefined,
    religion: form.religion === RELIGION_OTHER ? form.religionOther.trim() : form.religion,
    contactPersonName: form.contactPersonName.trim() || undefined,
    contactPersonNumber: form.contactPersonNumber.trim() || undefined,
    contactPersonAddress: form.contactPersonAddress.trim() || undefined,
  });

  const save = async (request: () => Promise<unknown>, failure: string) => {
    setServerError(null);
    setSaving(true);
    try {
      await request();
      saveDraft(null);
      onCreated();
      onClose();
    } catch (err: unknown) {
      // Someone may have just taken the room: refresh what is free.
      if (toWard) reloadRooms();
      const body = (err as { response?: { data?: Partial<DuplicatePatientError> } })?.response?.data;
      if (body?.code === 'PATIENT_ALREADY_REGISTERED' && body.existingPatientId) {
        setDuplicate(body as DuplicatePatientError);
      } else {
        setServerError(apiErrorMessage(err, failure));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    setDuplicate(null);

    const found = registrationProblems(form, roomNumber, rooms, toWard, Boolean(orderName));
    if (found.length) {
      if (found.some((problem) => problem.field === 'dateOfBirth')) setDobTouched(true);
      setSubmitAttempted(true);
      focusField(formRef.current, found[0].field);
      return;
    }

    void save(
      () => patientsApi.create({ ...detailsPayload(), ...admissionPayload() }),
      'Could not register the patient. Please try again.',
    );
  };

  /** Starts this stay on the record the server matched, instead of a second record. */
  const readmitExisting = () => {
    if (!duplicate || duplicate.admitted) return;
    const patientId = duplicate.existingPatientId;
    setDuplicate(null);
    void save(
      () => patientsApi.readmit(patientId, admissionPayload()),
      'Could not re-admit the patient. Please try again.',
    );
  };

  const attending = physicianById(form.physicianId);
  const selectedTriage = triageLevelInfo(form.triageLevel);

  return (
    <div style={ui.overlay} onClick={onClose}>
      <form
        ref={formRef}
        className="add-patient-form"
        style={s.modal}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
      >
        <header style={s.header}>
          <div>
            <div style={s.titleRow}>
              <h3 style={s.title}>Add Patient</h3>
              <span
                style={ui.badgeAdmitted}
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
                  id={fieldId('firstName')}
                  style={s.input}
                  value={form.firstName}
                  onChange={(e) => setField('firstName', sanitizeName(e.target.value))}
                  placeholder="e.g. Juan"
                  maxLength={150}
                  required
                />
                {fieldError('firstName')}
              </Field>
              <Field label="Middle Name">
                <input
                  id={fieldId('middleName')}
                  style={s.input}
                  value={form.middleName}
                  onChange={(e) => setField('middleName', sanitizeName(e.target.value))}
                  placeholder="Optional"
                  maxLength={150}
                />
                {fieldError('middleName')}
              </Field>
              <Field label="Last Name" required>
                <input
                  id={fieldId('lastName')}
                  style={s.input}
                  value={form.lastName}
                  onChange={(e) => setField('lastName', sanitizeName(e.target.value))}
                  placeholder="e.g. Dela Cruz"
                  maxLength={150}
                  required
                />
                {fieldError('lastName')}
              </Field>
              <Field label="Date of Birth" required>
                <input
                  id={fieldId('dateOfBirth')}
                  style={{ ...s.input, ...(showDobError ? s.inputInvalid : {}) }}
                  type="date"
                  min={oldestBirthDate()}
                  max={todayValue()}
                  value={form.dateOfBirth}
                  onChange={(e) => setField('dateOfBirth', e.target.value)}
                  onBlur={() => setDobTouched(true)}
                  aria-invalid={showDobError}
                  aria-describedby={showDobError ? 'add-patient-dob-error' : 'add-patient-dob-age'}
                  required
                />
                {showDobError ? (
                  <span id="add-patient-dob-error" style={s.fieldError}>
                    {dobMessage}
                  </span>
                ) : (
                  age !== null && (
                    <span id="add-patient-dob-age" style={s.fieldHint}>
                      {age === 1 ? '1 year old' : `${age} years old`}
                    </span>
                  )
                )}
              </Field>
              <Field label="Sex" required>
                <select
                  id={fieldId('gender')}
                  style={s.select}
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
                {fieldError('gender')}
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
              <Field label="Personal Number" required>
                <PhoneInput
                  id={fieldId('contactNumber')}
                  value={form.contactNumber}
                  onChange={(v) => setField('contactNumber', v)}
                  placeholder="e.g. 0917 123 4567"
                />
                {fieldError('contactNumber')}
              </Field>
              <Field label="Insurance" required>
                <select
                  id={fieldId('insurance')}
                  style={s.select}
                  value={form.insurance}
                  onChange={(e) => setField('insurance', toInsurance(e.target.value))}
                  required
                >
                  <option value="" disabled>
                    Select insurance
                  </option>
                  {Object.entries(INSURANCE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {fieldError('insurance')}
                {form.insurance === 'OTHER' && (
                  <>
                    <input
                      id={fieldId('insuranceOther')}
                      style={{ ...s.input, marginTop: 8 }}
                      value={form.insuranceOther}
                      onChange={(e) => setField('insuranceOther', e.target.value)}
                      placeholder="Specify insurance, e.g. Intellicare"
                      aria-label="Specify insurance"
                      maxLength={100}
                      required
                    />
                    {fieldError('insuranceOther')}
                  </>
                )}
              </Field>
              <Field label="Religion" required>
                <select
                  id={fieldId('religion')}
                  style={s.select}
                  value={form.religion}
                  onChange={(e) => setField('religion', e.target.value)}
                  required
                >
                  <option value="">Select religion</option>
                  {RELIGIONS.map((religion) => (
                    <option key={religion} value={religion}>
                      {religion}
                    </option>
                  ))}
                  <option value={RELIGION_OTHER}>Others (please specify)</option>
                </select>
                {fieldError('religion')}
                {form.religion === RELIGION_OTHER && (
                  <>
                    <input
                      id={fieldId('religionOther')}
                      style={{ ...s.input, marginTop: 8 }}
                      value={form.religionOther}
                      onChange={(e) => setField('religionOther', e.target.value)}
                      placeholder="Specify religion, e.g. Baptist"
                      aria-label="Specify religion"
                      maxLength={100}
                      required
                    />
                    {fieldError('religionOther')}
                  </>
                )}
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Address" required>
                  <input
                    id={fieldId('address')}
                    style={s.input}
                    value={form.address}
                    onChange={(e) => setField('address', e.target.value)}
                    placeholder="House no., street, barangay, city / municipality, province"
                    maxLength={300}
                    required
                  />
                  {fieldError('address')}
                </Field>
              </div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748b' }}>
              {classOption.hint}
            </p>

            <h5 style={s.subsectionTitle}>Contact Person</h5>
            <div style={s.grid2}>
              <Field label="Contact Person" required>
                <input
                  id={fieldId('contactPersonName')}
                  style={s.input}
                  value={form.contactPersonName}
                  onChange={(e) => setField('contactPersonName', sanitizeName(e.target.value))}
                  placeholder="e.g. Maria Dela Cruz"
                  maxLength={150}
                  required
                />
                {fieldError('contactPersonName')}
              </Field>
              <Field label="Contact Number" required>
                <PhoneInput
                  id={fieldId('contactPersonNumber')}
                  value={form.contactPersonNumber}
                  onChange={(v) => setField('contactPersonNumber', v)}
                  placeholder="e.g. 0918 765 4321"
                />
                {fieldError('contactPersonNumber')}
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Contact Person Address" required>
                  <input
                    id={fieldId('contactPersonAddress')}
                    style={s.input}
                    value={form.contactPersonAddress}
                    onChange={(e) => setField('contactPersonAddress', e.target.value)}
                    placeholder="House no., street, barangay, city / municipality, province"
                    maxLength={300}
                    required
                  />
                  {fieldError('contactPersonAddress')}
                </Field>
              </div>
            </div>
          </Section>

          {toWard && (
            <Section icon={SECTION_ICONS.room} title="Room Destination" hint="Ward room for the admitted patient">
              <span style={s.label}>
                Room Number<span style={s.required}>*</span>
              </span>
              <RoomPicker
                id={fieldId('room')}
                value={roomNumber}
                onChange={(value) => {
                  setServerError(null);
                  setRoomNumber(value);
                }}
                rooms={rooms}
                failed={roomsFailed}
                disabled={saving}
              />
              {/* RoomPicker flags an occupied room itself; this covers the empty case. */}
              {!normalizeRoom(roomNumber) && fieldError('room')}
            </Section>
          )}

          <Section icon={SECTION_ICONS.triage} title="Triage Assessment" hint="Priority level and initial vital signs">
            <div style={{ marginBottom: 14 }}>
              <span style={s.label}>
                Emergency Severity Index (ESI)<span style={s.required}>*</span>
              </span>
              <div
                id={fieldId('triageLevel')}
                style={s.triageLevels}
                role="radiogroup"
                aria-label="Emergency Severity Index (ESI)"
              >
                {TRIAGE_LEVELS.map((info) => {
                  const active = form.triageLevel === info.level;
                  return (
                    <button
                      key={info.level}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={`${info.name} (${info.tag}) — ${info.target}`}
                      style={{
                        ...s.triageLevel,
                        ...(active
                          ? { backgroundColor: info.background, borderColor: info.color, color: info.color }
                          : {}),
                      }}
                      onClick={() => setField('triageLevel', info.level)}
                    >
                      <span style={s.triageLevelNumber}>Level {info.level}</span>
                      <span style={s.triageLevelName}>{info.name}</span>
                    </button>
                  );
                })}
              </div>
              {fieldError('triageLevel')}
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
                {selectedTriage
                  ? `${selectedTriage.tag} · ${selectedTriage.target}: ${selectedTriage.description} e.g. ${selectedTriage.examples}.`
                  : 'Level 1 is the most urgent. The attending physician sees this priority in their patient list.'}
              </p>
            </div>
            <div style={s.grid4}>
              <div>
                <Vital id={fieldId('triageDate')} label="Date" type="date" max={todayValue()} value={form.triageDate} onChange={(v) => setField('triageDate', v)} required />
                {fieldError('triageDate')}
              </div>
              <div>
                <TimePickerField id={fieldId('triageTime')} value={form.triageTime} onChange={(v) => setField('triageTime', v)} required />
                {fieldError('triageTime')}
              </div>
              <div>
                <Vital id={fieldId('heartRate')} label="Heart Rate" unit="bpm" type="number" min={20} max={300} value={form.heartRate} onChange={(v) => setField('heartRate', v)} placeholder="—" required />
                {fieldError('heartRate')}
              </div>
              <div>
                <Vital id={fieldId('respRate')} label="Resp. Rate" unit="/min" type="number" min={1} max={80} value={form.respRate} onChange={(v) => setField('respRate', v)} placeholder="—" required />
                {fieldError('respRate')}
              </div>
              <div>
                <Vital id={fieldId('spo2')} label="SpO₂" unit="%" type="number" min={50} max={100} value={form.spo2} onChange={(v) => setField('spo2', v)} placeholder="—" required />
                {fieldError('spo2')}
              </div>
              <div>
                <Vital id={fieldId('bp')} label="Blood Pressure" unit="mmHg" value={form.bp} onChange={(v) => setField('bp', v)} placeholder="120/80" pattern={BP_PATTERN.source} title="Systolic/diastolic, e.g. 120/80" required />
                {fieldError('bp')}
              </div>
              <div>
                <Vital id={fieldId('temp')} label="Temp" unit="°C" type="number" min={30} max={45} step={0.1} value={form.temp} onChange={(v) => setField('temp', v)} placeholder="—" required />
                {fieldError('temp')}
              </div>
              <div>
                <Vital id={fieldId('pain')} label="Pain" unit="/10" type="number" min={0} max={10} value={form.pain} onChange={(v) => setField('pain', v)} placeholder="—" required />
                {fieldError('pain')}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <span style={s.label}>
                Chief Complaint<span style={s.required}>*</span>
              </span>
              <ChiefComplaintPicker
                id={fieldId('chiefComplaints')}
                value={form.chiefComplaints}
                onChange={(chiefComplaints) => setField('chiefComplaints', chiefComplaints)}
              />
              {fieldError('chiefComplaints')}
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="Notes" required>
                <textarea
                  id={fieldId('notes')}
                  style={s.textarea}
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Initial assessment, clinical notes..."
                  required
                />
                {fieldError('notes')}
              </Field>
            </div>
          </Section>

          <Section icon={SECTION_ICONS.careTeam} title="Care Team" hint="Attending physician leads care; consultants advise">
            <Field label="Attending Physician" required>
              <PhysicianWardSelect
                id={fieldId('physician')}
                physicians={physicians}
                value={form.physicianId}
                onChange={setAttending}
                selectStyle={s.select}
                placeholder="Select attending physician"
                ariaLabel="Attending physician"
                required
              />
              {fieldError('physician')}
            </Field>

            <div style={{ marginTop: 16 }}>
              <span style={s.label}>
                Consulting Physicians <span style={s.optional}>(optional)</span>
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.consultingPhysicianIds.length ? (
                  form.consultingPhysicianIds.map((id) => {
                    const doctor = physicianById(id);
                    if (!doctor) return null;
                    return (
                      <DoctorCard
                        key={id}
                        name={doctorName(doctor)}
                        meta="Consulting"
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
                <PhysicianWardSelect
                  id={fieldId('consultingPhysician')}
                  physicians={availableToAdd}
                  value={pendingDoctorId}
                  onChange={setPendingDoctorId}
                  selectStyle={{ ...s.select, flex: 1 }}
                  disabled={!availableToAdd.length}
                  placeholder={availableToAdd.length ? 'Select a consulting physician' : 'No other physicians available'}
                  ariaLabel="Consulting physician to add"
                />
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
              {pendingDoctorId && (
                <span style={s.fieldHint}>Click Add to include the consulting physician.</span>
              )}
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
                  id={fieldId('registrationOrder')}
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
                {fieldError('registrationOrder')}
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
                    style={s.select}
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
        </div>

        {duplicate && (
          <div style={s.duplicateNotice} role="alert">
            <span>
              {duplicate.message}.
              {!duplicate.admitted &&
                ' Re-admitting keeps their existing record and adds this stay to it; the details entered here for this stay are used.'}
            </span>
            {!duplicate.admitted && (
              <button
                type="button"
                style={{ ...ui.primaryBtn, height: 36, padding: '0 14px', flexShrink: 0 }}
                onClick={readmitExisting}
                disabled={saving}
              >
                Re-admit existing patient
              </button>
            )}
          </div>
        )}

        <footer style={s.footer}>
          <span style={s.footerHint} role="status" aria-live="polite">
            {serverError ??
              (!ready && !saving
                ? problems.length === 1
                  ? '1 field still needs attention'
                  : `${problems.length} fields still need attention`
                : '')}
          </span>
          <button type="button" style={{ ...ui.outlineBtn, height: 40 }} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            style={{
              ...ui.primaryBtn,
              height: 40,
              padding: '0 20px',
              backgroundColor: ready ? TEAL : '#bfdbfe',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
            disabled={saving}
            title={ready ? undefined : problems[0].message}
          >
            {saving ? 'Registering...' : 'Register Patient'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ChiefComplaintPicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const toggle = (complaint: string) => {
    onChange(
      value.includes(complaint) ? value.filter((item) => item !== complaint) : [...value, complaint],
    );
  };

  return (
    <div ref={rootRef}>
      <button
        id={id}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        style={{
          ...s.select,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          textAlign: 'left',
          backgroundImage: 'none',
          paddingRight: 12,
          borderColor: open ? '#2563eb' : '#cbd5e1',
          boxShadow: open ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
        }}
      >
        <span style={{ color: value.length ? '#0f172a' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value.length ? `${value.length} selected` : 'Select complaint'}
        </span>
        <DropdownChevron />
      </button>
      {open && (
        <div
          role="group"
          aria-label="Chief complaints"
          style={{
            marginTop: 6,
            maxHeight: 220,
            overflowY: 'auto',
            padding: 6,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
          }}
        >
          {CHIEF_COMPLAINTS.map((complaint) => (
            <label
              key={complaint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 8px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                color: '#0f172a',
              }}
            >
              <input
                type="checkbox"
                checked={value.includes(complaint)}
                onChange={() => toggle(complaint)}
                style={{ accentColor: '#2563eb', width: 15, height: 15, margin: 0 }}
              />
              {complaint}
            </label>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {value.map((complaint) => (
            <span
              key={complaint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                maxWidth: '100%',
                padding: '0 4px 0 10px',
                borderRadius: 999,
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1e3a8a',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              <span style={{ lineHeight: 1 }}>{complaint}</span>
              <button
                type="button"
                aria-label={`Remove ${complaint}`}
                title={`Remove ${complaint}`}
                onClick={() => toggle(complaint)}
                style={{
                  width: 18,
                  height: 18,
                  padding: 0,
                  border: 'none',
                  borderRadius: 999,
                  backgroundColor: '#dbeafe',
                  color: '#1d4ed8',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
                  <path d="M1.2 1.2 6.8 6.8M6.8 1.2 1.2 6.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Same 16px mark as the drawn chevron on `s.select`, inset 12px from the right edge. */
function DropdownChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <path d="M6.5 9.5 12 15l5.5-5.5" fill="none" stroke="#0f172a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

function PhoneInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      id={id}
      style={s.input}
      type="tel"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(sanitizePhoneNumber(e.target.value))}
      placeholder={placeholder}
      maxLength={11}
      required
      pattern="\d{11}"
      title="Enter exactly 11 digits"
    />
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
      <span style={s.vitalLabel}>
        {label}
        {inputProps.required && <span style={s.required}>*</span>}
      </span>
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
