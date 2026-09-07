import { ActionType, OrderEnteredBy, Role, SummaryStatus } from '@prisma/client';

/**
 * Mock dataset for local development.
 *
 * Every row carries a deterministic, fixed UUID so the seed is idempotent:
 * re-running `npm run prisma:seed` (or `prisma db seed`) upserts by id and
 * never creates duplicates. Cross-references use symbolic keys (patientKey,
 * admissionKey, courseKey) and the runnable seed resolves them to real FK ids.
 */

/** Deterministic UUID (valid v4-format string, built from a small sequence). */
export function uid(seq: number): string {
  return `00000000-0000-4000-8000-${seq.toString(16).padStart(12, '0')}`;
}

const DAY_MS = 86_400_000;

/** Date `days` days ago, pinned to a fixed clock time (default 09:15). */
export function daysAgo(days: number, hour = 9): Date {
  const d = new Date(Date.now() - days * DAY_MS);
  d.setHours(hour, 15, 0, 0);
  return d;
}

export const DEMO_PASSWORD = 'Password123!';

// ---------- Users ----------

export interface SeedUser {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export const users: SeedUser[] = [
  { id: uid(1), userId: 'DOC001', firstName: 'John', lastName: 'Doe', role: Role.PHYSICIAN },
  { id: uid(2), userId: 'DOC002', firstName: 'Maria', lastName: 'Santos', role: Role.PHYSICIAN },
  { id: uid(3), userId: 'NRS001', firstName: 'Angela', lastName: 'Reyes', role: Role.NURSE },
  { id: uid(4), userId: 'ADM001', firstName: 'Rafael', lastName: 'Cruz', role: Role.ADMIN },
  { id: uid(5), userId: 'CLM001', firstName: 'Kristine', lastName: 'Bautista', role: Role.CLAIMS_PROCESSOR },
];

// ---------- Patients ----------

export interface SeedPatient {
  id: string;
  key: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: Date;
}

export const patients: SeedPatient[] = [
  { id: uid(11), key: 'pt1', firstName: 'Juan', lastName: 'Dela Cruz', gender: 'Male', dateOfBirth: new Date(1965, 2, 14) },
  { id: uid(12), key: 'pt2', firstName: 'Maria Clara', lastName: 'Mendoza', gender: 'Female', dateOfBirth: new Date(1978, 6, 22) },
  { id: uid(13), key: 'pt3', firstName: 'Pedro', lastName: 'Lim', gender: 'Male', dateOfBirth: new Date(1952, 10, 2) },
  { id: uid(14), key: 'pt4', firstName: 'Ana Marie', lastName: 'Villanueva', gender: 'Female', dateOfBirth: new Date(1988, 0, 30) },
  { id: uid(15), key: 'pt5', firstName: 'Ramon', lastName: 'Garcia', gender: 'Male', dateOfBirth: new Date(1941, 4, 9) },
  { id: uid(16), key: 'pt6', firstName: 'Liza', lastName: 'Fernandez', gender: 'Female', dateOfBirth: new Date(1996, 8, 18) },
];

// ---------- Admissions ----------

export interface SeedAdmission {
  id: string;
  key: string;
  patientKey: string;
  /** Attending physician's login userId, e.g. DOC001. */
  physicianUserId: string;
  admissionDate: Date;
  dischargeDate?: Date;
}

export const admissions: SeedAdmission[] = [
  { id: uid(21), key: 'adm1', patientKey: 'pt1', physicianUserId: 'DOC001', admissionDate: daysAgo(10) }, // Juan, active
  { id: uid(22), key: 'adm2', patientKey: 'pt2', physicianUserId: 'DOC002', admissionDate: daysAgo(5) }, // Maria, active
  { id: uid(23), key: 'adm3', patientKey: 'pt3', physicianUserId: 'DOC001', admissionDate: daysAgo(21), dischargeDate: daysAgo(6) }, // Pedro, discharged
  { id: uid(24), key: 'adm4', patientKey: 'pt4', physicianUserId: 'DOC002', admissionDate: daysAgo(3) }, // Ana, active
  { id: uid(25), key: 'adm5', patientKey: 'pt5', physicianUserId: 'DOC001', admissionDate: daysAgo(40), dischargeDate: daysAgo(29) }, // Ramon, discharged
  { id: uid(26), key: 'adm6', patientKey: 'pt6', physicianUserId: 'DOC002', admissionDate: daysAgo(2) }, // Liza, active
  { id: uid(27), key: 'adm7', patientKey: 'pt1', physicianUserId: 'DOC002', admissionDate: daysAgo(60), dischargeDate: daysAgo(47) }, // Juan, prior stay
];

// ---------- Course in the Ward summaries ----------

export interface SeedCourseInWard {
  id: string;
  key: string;
  patientKey: string;
  /** Admission whose orders this summary is linked to (via summarizationId). */
  admissionKey: string;
  summaryDate: Date;
  status: SummaryStatus;
  /** Peer physician's login userId; required for APPROVED summaries. */
  validatorUserId?: string;
  validatedAt?: Date;
  summaryContent: string;
}

export const coursesInWard: SeedCourseInWard[] = [
  {
    id: uid(31),
    key: 'c1',
    patientKey: 'pt5',
    admissionKey: 'adm5',
    summaryDate: daysAgo(31),
    status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC002',
    validatedAt: daysAgo(29),
    summaryContent:
      'The patient was admitted for an acute exacerbation of chronic obstructive pulmonary disease. ' +
      'Supplemental oxygen was administered and gradually tapered as oxygen saturation stabilized. ' +
      'Intravenous corticosteroids and scheduled bronchodilator nebulizations were given per physician order. ' +
      'Serial chest radiographs were obtained and showed gradual resolution of the infiltrates. ' +
      'The patient was discharged in improved condition with a maintenance inhaler regimen.',
  },
  {
    id: uid(32),
    key: 'c2',
    patientKey: 'pt3',
    admissionKey: 'adm3',
    summaryDate: daysAgo(8),
    status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC002',
    validatedAt: daysAgo(5),
    summaryContent:
      'The patient was admitted for an infected diabetic foot ulcer on the right lower extremity. ' +
      'Intravenous clindamycin and basal-bolus insulin therapy were administered as ordered. ' +
      'Daily sterile dressing changes with normal saline irrigation were performed on the wound. ' +
      'Blood glucose was monitored four times daily and the insulin regimen was titrated accordingly. ' +
      'The wound showed healthy granulation tissue and the patient was discharged with home wound care instructions.',
  },
  {
    id: uid(33),
    key: 'c3',
    patientKey: 'pt1',
    admissionKey: 'adm1',
    summaryDate: daysAgo(0),
    status: SummaryStatus.DRAFT_AI,
    summaryContent:
      'The patient was admitted for community-acquired pneumonia with productive cough and intermittent fever. ' +
      'Azithromycin was started and antipyretics were given for fever spikes above 38.5 degrees Celsius. ' +
      'Oxygen saturation was monitored and remained above 95 percent on room air. ' +
      'A repeat chest radiograph was requested to document interval improvement of the infiltrates. ' +
      'The patient continues to improve and remains under close observation on the ward.',
  },
  {
    id: uid(34),
    key: 'c4',
    patientKey: 'pt2',
    admissionKey: 'adm2',
    summaryDate: daysAgo(1),
    status: SummaryStatus.DRAFT_EDITED,
    summaryContent:
      'The patient was admitted for acute pyelonephritis presenting with flank pain, dysuria, and fever. ' +
      'Intravenous ceftriaxone and fluid resuscitation were initiated on admission. ' +
      'Urine culture and sensitivity were obtained before the first antibiotic dose. ' +
      'The fever resolved after 48 hours of therapy and repeat urinalysis showed improving pyuria. ' +
      'The patient was advised to complete a seven-day antibiotic course and to follow up at the OPD.',
  },
  {
    id: uid(35),
    key: 'c5',
    patientKey: 'pt6',
    admissionKey: 'adm6',
    summaryDate: daysAgo(0),
    status: SummaryStatus.DRAFT_EDITED,
    summaryContent:
      'The patient was admitted for observation due to suspected dengue fever with fever and body malaise. ' +
      'Serial platelet counts and hematocrit were monitored every 24 hours as ordered. ' +
      'Paracetamol was given for fever and oral rehydration was encouraged. ' +
      'No warning signs of plasma leakage were observed during the observation period. ' +
      'The patient remains clinically stable and may be discharged once the platelet count trends upward.',
  },
  {
    id: uid(36),
    key: 'c6',
    patientKey: 'pt1',
    admissionKey: 'adm7',
    summaryDate: daysAgo(50),
    status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC001',
    validatedAt: daysAgo(46),
    summaryContent:
      'The patient was admitted for acute gastroenteritis with moderate dehydration. ' +
      'Intravenous fluid resuscitation was initiated and oral rehydration was introduced as tolerated. ' +
      'Antiemetics were given for persistent vomiting during the first hospital day. ' +
      'Serial laboratory parameters normalized and oral intake improved progressively. ' +
      'The patient was discharged improved with dietary advice and a scheduled OPD follow-up.',
  },
];

// ---------- Physician orders ----------

export interface SeedOrder {
  id: string;
  orderContent: string;
  dateCreated: Date;
  admissionKey: string;
  /** When set, links this order to a CourseInWard summary via summarizationId. */
  courseKey?: string;
  orderedByUserId: string;
  encodedByUserId: string;
  enteredByRole: OrderEnteredBy;
  active?: boolean;
}

export const orders: SeedOrder[] = [
  // adm1 — Juan Dela Cruz, current stay (DOC001)
  {
    id: uid(41), orderContent: 'Admit to Medical Ward. Chest x-ray PA view STAT.', dateCreated: daysAgo(9, 10),
    admissionKey: 'adm1', courseKey: 'c3', orderedByUserId: 'DOC001', encodedByUserId: 'DOC001', enteredByRole: OrderEnteredBy.PHYSICIAN,
  },
  {
    id: uid(42), orderContent: 'Paracetamol 500 mg tablet every 4 hours as needed for fever above 38.5 degrees Celsius.', dateCreated: daysAgo(5, 18),
    admissionKey: 'adm1', courseKey: 'c3', orderedByUserId: 'DOC001', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  {
    id: uid(43), orderContent: 'Azithromycin 500 mg tablet once daily for 7 days.', dateCreated: daysAgo(2, 11),
    admissionKey: 'adm1', courseKey: 'c3', orderedByUserId: 'DOC001', encodedByUserId: 'DOC001', enteredByRole: OrderEnteredBy.PHYSICIAN,
  },
  {
    id: uid(44), orderContent: 'Repeat complete blood count tomorrow morning before breakfast.', dateCreated: daysAgo(0, 8),
    admissionKey: 'adm1', courseKey: 'c3', orderedByUserId: 'DOC001', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  // adm2 — Maria Clara Mendoza (DOC002)
  {
    id: uid(45), orderContent: 'Admit to Female Medical Ward. Start IVF PNSS 1 liter at 80 ml/hr.', dateCreated: daysAgo(4, 14),
    admissionKey: 'adm2', courseKey: 'c4', orderedByUserId: 'DOC002', encodedByUserId: 'DOC002', enteredByRole: OrderEnteredBy.PHYSICIAN,
  },
  {
    id: uid(46), orderContent: 'Ceftriaxone 1 gram IV once daily.', dateCreated: daysAgo(3, 16),
    admissionKey: 'adm2', courseKey: 'c4', orderedByUserId: 'DOC002', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  {
    id: uid(47), orderContent: 'Urinalysis and urine culture and sensitivity prior to antibiotic administration.', dateCreated: daysAgo(1, 9),
    admissionKey: 'adm2', courseKey: 'c4', orderedByUserId: 'DOC002', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  // adm3 — Pedro Lim, discharged (DOC001)
  {
    id: uid(48), orderContent: 'Admit to Medical Ward for infected diabetic foot ulcer, right foot. Strict blood glucose monitoring.', dateCreated: daysAgo(20, 15),
    admissionKey: 'adm3', courseKey: 'c2', orderedByUserId: 'DOC001', encodedByUserId: 'DOC001', enteredByRole: OrderEnteredBy.PHYSICIAN,
  },
  {
    id: uid(49), orderContent: 'Insulin glargine 20 units subcut once nightly with sliding scale insulin before meals.', dateCreated: daysAgo(15, 12),
    admissionKey: 'adm3', courseKey: 'c2', orderedByUserId: 'DOC001', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  {
    id: uid(50), orderContent: 'Clindamycin 600 mg IV every 8 hours.', dateCreated: daysAgo(12, 17),
    admissionKey: 'adm3', courseKey: 'c2', orderedByUserId: 'DOC001', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  {
    id: uid(51), orderContent: 'Wound care: sterile dressing change once daily with normal saline irrigation.', dateCreated: daysAgo(8, 10),
    admissionKey: 'adm3', courseKey: 'c2', orderedByUserId: 'DOC001', encodedByUserId: 'DOC001', enteredByRole: OrderEnteredBy.PHYSICIAN,
  },
  // adm4 — Ana Marie Villanueva (DOC002), no summary yet
  {
    id: uid(52), orderContent: 'Admit to Surgical Ward. NPO. Prepare for emergency appendectomy.', dateCreated: daysAgo(2, 20),
    admissionKey: 'adm4', orderedByUserId: 'DOC002', encodedByUserId: 'DOC002', enteredByRole: OrderEnteredBy.PHYSICIAN,
  },
  {
    id: uid(53), orderContent: 'Post-operative: Cefuroxime 750 mg IV every 8 hours. Advance diet as tolerated.', dateCreated: daysAgo(1, 8),
    admissionKey: 'adm4', orderedByUserId: 'DOC002', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  // adm5 — Ramon Garcia, discharged (DOC001)
  {
    id: uid(54), orderContent: 'Admit for acute exacerbation of COPD. Start oxygen 2 L/min via nasal cannula.', dateCreated: daysAgo(39, 13),
    admissionKey: 'adm5', courseKey: 'c1', orderedByUserId: 'DOC001', encodedByUserId: 'DOC001', enteredByRole: OrderEnteredBy.PHYSICIAN,
  },
  {
    id: uid(55), orderContent: 'Prednisone 40 mg PO once daily. Salbutamol nebulization every 4 hours.', dateCreated: daysAgo(37, 15),
    admissionKey: 'adm5', courseKey: 'c1', orderedByUserId: 'DOC001', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  {
    id: uid(56), orderContent: 'Chest x-ray PA view.', dateCreated: daysAgo(35, 9),
    admissionKey: 'adm5', courseKey: 'c1', orderedByUserId: 'DOC001', encodedByUserId: 'DOC001', enteredByRole: OrderEnteredBy.PHYSICIAN,
  },
  {
    id: uid(57), orderContent: 'Doxycycline 100 mg PO twice daily for 10 days.', dateCreated: daysAgo(33, 16),
    admissionKey: 'adm5', courseKey: 'c1', orderedByUserId: 'DOC001', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  {
    id: uid(58), orderContent: 'Discharge planning: continue tiotropium inhaler once daily. Follow-up at OPD in 2 weeks.', dateCreated: daysAgo(31, 11),
    admissionKey: 'adm5', courseKey: 'c1', orderedByUserId: 'DOC001', encodedByUserId: 'DOC001', enteredByRole: OrderEnteredBy.PHYSICIAN,
  },
  // adm6 — Liza Fernandez (DOC002)
  {
    id: uid(59), orderContent: 'Admit for dengue fever observation. Strict monitoring of vital signs every 4 hours.', dateCreated: daysAgo(1, 14),
    admissionKey: 'adm6', courseKey: 'c5', orderedByUserId: 'DOC002', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  {
    id: uid(60), orderContent: 'Repeat platelet count and hematocrit today. Encourage oral rehydration.', dateCreated: daysAgo(0, 7),
    admissionKey: 'adm6', courseKey: 'c5', orderedByUserId: 'DOC002', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  // adm7 — Juan Dela Cruz, prior stay (DOC002)
  {
    id: uid(61), orderContent: 'Admit for acute gastroenteritis with dehydration. IVF PNSS 1 liter bolus then 80 ml/hr.', dateCreated: daysAgo(59, 12),
    admissionKey: 'adm7', courseKey: 'c6', orderedByUserId: 'DOC002', encodedByUserId: 'DOC002', enteredByRole: OrderEnteredBy.PHYSICIAN,
  },
  {
    id: uid(62), orderContent: 'Oral rehydration salts sachet after every loose stool as tolerated.', dateCreated: daysAgo(55, 10),
    admissionKey: 'adm7', courseKey: 'c6', orderedByUserId: 'DOC002', encodedByUserId: 'NRS001', enteredByRole: OrderEnteredBy.NURSE_ON_BEHALF,
  },
  {
    id: uid(63), orderContent: 'Advance diet as tolerated. Discharge once tolerating soft diet.', dateCreated: daysAgo(50, 9),
    admissionKey: 'adm7', courseKey: 'c6', orderedByUserId: 'DOC002', encodedByUserId: 'DOC002', enteredByRole: OrderEnteredBy.PHYSICIAN,
  },
  // a few inactive / superseded orders for variety
  {
    id: uid(64), orderContent: 'Paracetamol 500 mg tablet every 6 hours (discontinued).', dateCreated: daysAgo(6, 16),
    admissionKey: 'adm1', orderedByUserId: 'DOC001', encodedByUserId: 'DOC001', enteredByRole: OrderEnteredBy.PHYSICIAN, active: false,
  },
  {
    id: uid(65), orderContent: 'Cefuroxime 750 mg IV every 8 hours (changed to clindamycin).', dateCreated: daysAgo(14, 18),
    admissionKey: 'adm3', orderedByUserId: 'DOC001', encodedByUserId: 'DOC001', enteredByRole: OrderEnteredBy.PHYSICIAN, active: false,
  },
];

// ---------- Physician notes ----------

export interface SeedNote {
  id: string;
  content: string;
  physicianUserId: string;
  patientKey: string;
  createdAt: Date;
  reminderAt?: Date;
}

export const notes: SeedNote[] = [
  {
    id: uid(71), content: 'Patient afebrile for 24 hours and tolerating oral fluids well. Continue current antibiotics.',
    physicianUserId: 'DOC002', patientKey: 'pt2', createdAt: daysAgo(3, 11),
  },
  {
    id: uid(72), content: 'Lung crackles improved on auscultation. Oxygen saturation stable on room air.',
    physicianUserId: 'DOC001', patientKey: 'pt1', createdAt: daysAgo(2, 16),
  },
  {
    id: uid(73), content: 'Post-operative day 1: incision clean, dry, and intact. Ambulated with assistance.',
    physicianUserId: 'DOC002', patientKey: 'pt4', createdAt: daysAgo(1, 10),
  },
  {
    id: uid(74), content: 'Foot ulcer base is clean with early granulation tissue. Continue daily dressing changes.',
    physicianUserId: 'DOC001', patientKey: 'pt3', createdAt: daysAgo(12, 15), reminderAt: daysAgo(-1, 9),
  },
  {
    id: uid(75), content: 'Platelet count stable at 132. No bleeding manifestations noted.',
    physicianUserId: 'DOC002', patientKey: 'pt6', createdAt: daysAgo(0, 13),
  },
];

// ---------- Summary approval requests (claims) ----------

export interface SeedApprovalRequest {
  id: string;
  courseKey: string;
  /** Validating physician's login userId (the summary's validator). */
  physicianUserId: string;
  /** Claims processor's login userId. */
  processorUserId: string;
  requestedAt: Date;
  status: string; // PENDING | PHYSICIAN_VALIDATION_REQUESTED | CF4_GENERATED
}

export const approvalRequests: SeedApprovalRequest[] = [
  {
    id: uid(81), courseKey: 'c1', physicianUserId: 'DOC002', processorUserId: 'CLM001',
    requestedAt: daysAgo(28, 14), status: 'CF4_GENERATED',
  },
  {
    id: uid(82), courseKey: 'c2', physicianUserId: 'DOC002', processorUserId: 'CLM001',
    requestedAt: daysAgo(4, 9), status: 'PHYSICIAN_VALIDATION_REQUESTED',
  },
  {
    id: uid(83), courseKey: 'c6', physicianUserId: 'DOC001', processorUserId: 'CLM001',
    requestedAt: daysAgo(45, 10), status: 'PENDING',
  },
];

// ---------- Audit logs ----------

export interface SeedAuditLog {
  id: string;
  action: ActionType;
  /** Login userId of the acting user. */
  userId: string;
  timeStamp: Date;
}

export const auditLogs: SeedAuditLog[] = [
  { id: uid(91), action: ActionType.ADD_ACCOUNT, userId: 'ADM001', timeStamp: daysAgo(12, 10) },
  { id: uid(92), action: ActionType.REGISTER_PATIENT, userId: 'ADM001', timeStamp: daysAgo(10, 9) },
  { id: uid(93), action: ActionType.LOGIN, userId: 'DOC001', timeStamp: daysAgo(9, 8) },
  { id: uid(94), action: ActionType.LOGIN, userId: 'DOC002', timeStamp: daysAgo(6, 8) },
  { id: uid(95), action: ActionType.ADD_NOTE, userId: 'DOC002', timeStamp: daysAgo(3, 12) },
  { id: uid(96), action: ActionType.CREATE_ORDER_NURSE, userId: 'NRS001', timeStamp: daysAgo(3, 17) },
  { id: uid(97), action: ActionType.CREATE_ORDER, userId: 'DOC001', timeStamp: daysAgo(2, 11) },
  { id: uid(98), action: ActionType.LOGIN, userId: 'CLM001', timeStamp: daysAgo(2, 8) },
  { id: uid(99), action: ActionType.REQUEST_SUMMARY, userId: 'DOC002', timeStamp: daysAgo(1, 9) },
  { id: uid(100), action: ActionType.APPROVE_SUMMARY, userId: 'DOC002', timeStamp: daysAgo(5, 15) },
  { id: uid(101), action: ActionType.EDIT_SUMMARY, userId: 'DOC002', timeStamp: daysAgo(0, 10) },
  { id: uid(102), action: ActionType.LOGIN, userId: 'ADM001', timeStamp: daysAgo(0, 7) },
];
