import {
  ActionType,
  CommunicationChannel,
  OrderEnteredBy,
  OrderStatus,
  OrderType,
  PhilHealthCF4Status,
  ResetStatus,
  Role,
  SummaryStatus,
} from '@prisma/client';

/**
 * Mock dataset for local development.
 *
 * Every row carries a deterministic, fixed UUID so the seed is idempotent:
 * re-running `npm run prisma:seed` (or `prisma db seed`) upserts by id and
 * never creates duplicates. Cross-references use symbolic keys (patientKey,
 * admissionKey, courseKey, ...) and the runnable seed resolves them to real
 * FK ids.
 */

/** Deterministic UUID (valid v4-format string, built from a small sequence). */
export function uid(seq: number): string {
  return `00000000-0000-4000-8000-${seq.toString(16).padStart(12, '0')}`;
}

const DAY_MS = 86_400_000;

/** Date `days` days ago, pinned to a fixed clock time (default 09:15). */
export function daysAgo(days: number, hour = 9, minute = 15): Date {
  const d = new Date(Date.now() - days * DAY_MS);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Date `days` days in the future, pinned to a fixed clock time. */
export function daysFromNow(days: number, hour = 9, minute = 15): Date {
  return daysAgo(-days, hour, minute);
}

export const DEMO_PASSWORD = 'Password123!';

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface SeedUser {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive?: boolean;
  mustResetPassword?: boolean;
  sessionVersion?: number;
}

export const users: SeedUser[] = [
  { id: uid(1), userId: 'DOC001', firstName: 'John', lastName: 'Doe', role: Role.PHYSICIAN },
  { id: uid(2), userId: 'DOC002', firstName: 'Maria', lastName: 'Santos', role: Role.PHYSICIAN },
  { id: uid(3), userId: 'DOC003', firstName: 'Antonio', lastName: 'Rivera', role: Role.PHYSICIAN },
  { id: uid(4), userId: 'DOC004', firstName: 'Sofia', lastName: 'Mendoza', role: Role.PHYSICIAN },
  { id: uid(5), userId: 'DOC005', firstName: 'Benjamin', lastName: 'Aquino', role: Role.PHYSICIAN },
  { id: uid(6), userId: 'DOC006', firstName: 'Camille', lastName: 'Domingo', role: Role.PHYSICIAN },

  { id: uid(7), userId: 'NRS001', firstName: 'Angela', lastName: 'Reyes', role: Role.NURSE },
  { id: uid(8), userId: 'NRS002', firstName: 'Mark', lastName: 'Villanueva', role: Role.NURSE },
  { id: uid(9), userId: 'NRS003', firstName: 'Patricia', lastName: 'Gomez', role: Role.NURSE },
  { id: uid(10), userId: 'NRS004', firstName: 'Daniel', lastName: 'Navarro', role: Role.NURSE },
  { id: uid(11), userId: 'NRS005', firstName: 'Beatrice', lastName: 'Salazar', role: Role.NURSE },

  { id: uid(12), userId: 'ADM001', firstName: 'Rafael', lastName: 'Cruz', role: Role.ADMIN },
  { id: uid(13), userId: 'ADM002', firstName: 'Lorena', lastName: 'Ramos', role: Role.ADMIN },
  { id: uid(14), userId: 'ADM003', firstName: 'Victor', lastName: 'Delgado', role: Role.ADMIN },

  { id: uid(15), userId: 'CLM001', firstName: 'Kristine', lastName: 'Bautista', role: Role.CLAIMS_PROCESSOR },
  { id: uid(16), userId: 'CLM002', firstName: 'Ramon', lastName: 'Torres', role: Role.CLAIMS_PROCESSOR },
  { id: uid(17), userId: 'CLM003', firstName: 'Alice', lastName: 'Sandoval', role: Role.CLAIMS_PROCESSOR },
  { id: uid(18), userId: 'CLM004', firstName: 'Gabriel', lastName: 'Pascual', role: Role.CLAIMS_PROCESSOR },
];

/** Next user-id suffix per role (DOC001..DOC006 → next = 7). */
export const userIdCounters: { role: Role; nextNumber: number }[] = [
  { role: Role.PHYSICIAN, nextNumber: 7 },
  { role: Role.NURSE, nextNumber: 6 },
  { role: Role.ADMIN, nextNumber: 4 },
  { role: Role.CLAIMS_PROCESSOR, nextNumber: 5 },
];

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export interface SeedPatient {
  id: string;
  key: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: Date;
}

export const patients: SeedPatient[] = [
  { id: uid(101), key: 'pt1', firstName: 'Juan', lastName: 'Dela Cruz', gender: 'Male', dateOfBirth: new Date(1965, 2, 14) },
  { id: uid(102), key: 'pt2', firstName: 'Maria Clara', lastName: 'Mendoza', gender: 'Female', dateOfBirth: new Date(1978, 6, 22) },
  { id: uid(103), key: 'pt3', firstName: 'Pedro', lastName: 'Lim', gender: 'Male', dateOfBirth: new Date(1952, 10, 2) },
  { id: uid(104), key: 'pt4', firstName: 'Ana Marie', lastName: 'Villanueva', gender: 'Female', dateOfBirth: new Date(1988, 0, 30) },
  { id: uid(105), key: 'pt5', firstName: 'Ramon', lastName: 'Garcia', gender: 'Male', dateOfBirth: new Date(1941, 4, 9) },
  { id: uid(106), key: 'pt6', firstName: 'Liza', lastName: 'Fernandez', gender: 'Female', dateOfBirth: new Date(1996, 8, 18) },
  { id: uid(107), key: 'pt7', firstName: 'Carlos', lastName: 'Reyes', gender: 'Male', dateOfBirth: new Date(1970, 3, 12) },
  { id: uid(108), key: 'pt8', firstName: 'Rosario', lastName: 'Bautista', gender: 'Female', dateOfBirth: new Date(1955, 5, 4) },
  { id: uid(109), key: 'pt9', firstName: 'Miguel', lastName: 'Santos', gender: 'Male', dateOfBirth: new Date(1982, 11, 19) },
  { id: uid(110), key: 'pt10', firstName: 'Elena', lastName: 'Cruz', gender: 'Female', dateOfBirth: new Date(1990, 1, 8) },
  { id: uid(111), key: 'pt11', firstName: 'Ricardo', lastName: 'Aquino', gender: 'Male', dateOfBirth: new Date(1968, 7, 27) },
  { id: uid(112), key: 'pt12', firstName: 'Josefina', lastName: 'Ramos', gender: 'Female', dateOfBirth: new Date(1948, 9, 3) },
  { id: uid(113), key: 'pt13', firstName: 'Eduardo', lastName: 'Torres', gender: 'Male', dateOfBirth: new Date(1975, 2, 16) },
  { id: uid(114), key: 'pt14', firstName: 'Carmen', lastName: 'Delgado', gender: 'Female', dateOfBirth: new Date(1985, 6, 5) },
  { id: uid(115), key: 'pt15', firstName: 'Fernando', lastName: 'Pascual', gender: 'Male', dateOfBirth: new Date(1960, 0, 23) },
  { id: uid(116), key: 'pt16', firstName: 'Gloria', lastName: 'Sandoval', gender: 'Female', dateOfBirth: new Date(1993, 4, 11) },
  { id: uid(117), key: 'pt17', firstName: 'Andres', lastName: 'Navarro', gender: 'Male', dateOfBirth: new Date(1958, 8, 30) },
  { id: uid(118), key: 'pt18', firstName: 'Teresa', lastName: 'Gomez', gender: 'Female', dateOfBirth: new Date(1963, 10, 17) },
  { id: uid(119), key: 'pt19', firstName: 'Rafael', lastName: 'Villanueva', gender: 'Male', dateOfBirth: new Date(1987, 3, 9) },
  { id: uid(120), key: 'pt20', firstName: 'Lucila', lastName: 'Domingo', gender: 'Female', dateOfBirth: new Date(1972, 1, 26) },
  { id: uid(121), key: 'pt21', firstName: 'Arturo', lastName: 'Salazar', gender: 'Male', dateOfBirth: new Date(1945, 7, 13) },
  { id: uid(122), key: 'pt22', firstName: 'Maribel', lastName: 'Castillo', gender: 'Female', dateOfBirth: new Date(1999, 11, 1) },
  { id: uid(123), key: 'pt23', firstName: 'Joaquin', lastName: 'Mercado', gender: 'Male', dateOfBirth: new Date(1980, 5, 21) },
  { id: uid(124), key: 'pt24', firstName: 'Pilar', lastName: 'Espinosa', gender: 'Female', dateOfBirth: new Date(1957, 9, 28) },
  { id: uid(125), key: 'pt25', firstName: 'Nestor', lastName: 'Agustin', gender: 'Male', dateOfBirth: new Date(1976, 2, 7) },
  { id: uid(126), key: 'pt26', firstName: 'Rosalinda', lastName: 'Padilla', gender: 'Female', dateOfBirth: new Date(1966, 4, 15) },
  { id: uid(127), key: 'pt27', firstName: 'Emilio', lastName: 'Buenaventura', gender: 'Male', dateOfBirth: new Date(1991, 8, 24) },
  { id: uid(128), key: 'pt28', firstName: 'Corazon', lastName: 'Lumibao', gender: 'Female', dateOfBirth: new Date(1950, 6, 30) },
  { id: uid(129), key: 'pt29', firstName: 'Ismael', lastName: 'Ocampo', gender: 'Male', dateOfBirth: new Date(1969, 1, 18) },
  { id: uid(130), key: 'pt30', firstName: 'Dolores', lastName: 'Manalo', gender: 'Female', dateOfBirth: new Date(1983, 10, 12) },
];

// ---------------------------------------------------------------------------
// Admissions
// ---------------------------------------------------------------------------

export interface SeedAdmission {
  id: string;
  key: string;
  patientKey: string;
  /** Attending physician's login userId, e.g. DOC001. */
  physicianUserId: string;
  admissionDate: Date;
  dischargeDate?: Date;
  isOutpatient?: boolean;
  outpatientSetAt?: Date;
  initialAssessment?: string;
}

export const admissions: SeedAdmission[] = [
  // Currently admitted
  { id: uid(201), key: 'adm1', patientKey: 'pt1', physicianUserId: 'DOC001', admissionDate: daysAgo(10), initialAssessment: 'Community-acquired pneumonia, moderate risk. Productive cough, febrile on admission.' },
  { id: uid(202), key: 'adm2', patientKey: 'pt2', physicianUserId: 'DOC002', admissionDate: daysAgo(5), initialAssessment: 'Acute pyelonephritis, right. Flank pain, dysuria, fever.' },
  { id: uid(203), key: 'adm4', patientKey: 'pt4', physicianUserId: 'DOC002', admissionDate: daysAgo(3), initialAssessment: 'Acute appendicitis. Underwent emergency appendectomy.' },
  { id: uid(204), key: 'adm6', patientKey: 'pt6', physicianUserId: 'DOC002', admissionDate: daysAgo(2), initialAssessment: 'Suspected dengue fever with warning signs monitoring.' },
  { id: uid(205), key: 'adm8', patientKey: 'pt7', physicianUserId: 'DOC003', admissionDate: daysAgo(8), initialAssessment: 'Hypertensive urgency with headache. BP 180/110 on admission.' },
  { id: uid(206), key: 'adm10', patientKey: 'pt9', physicianUserId: 'DOC004', admissionDate: daysAgo(4), initialAssessment: 'Acute decompensated heart failure, NYHA III.' },
  { id: uid(207), key: 'adm11', patientKey: 'pt10', physicianUserId: 'DOC004', admissionDate: daysAgo(7), initialAssessment: 'Severe anemia, etiology to be determined. Hgb 6.8 g/dL.' },
  { id: uid(208), key: 'adm14', patientKey: 'pt13', physicianUserId: 'DOC006', admissionDate: daysAgo(1), initialAssessment: 'Acute coronary syndrome, NSTEMI. Chest pain, troponin elevated.' },
  { id: uid(209), key: 'adm15', patientKey: 'pt14', physicianUserId: 'DOC006', admissionDate: daysAgo(6), initialAssessment: 'Hyperthyroidism, thyroid storm in evolution.' },
  { id: uid(210), key: 'adm17', patientKey: 'pt16', physicianUserId: 'DOC002', admissionDate: daysAgo(3), initialAssessment: 'Acute gastritis with dehydration secondary to NSAID use.' },
  { id: uid(211), key: 'adm19', patientKey: 'pt18', physicianUserId: 'DOC004', admissionDate: daysAgo(2), isOutpatient: true, outpatientSetAt: daysAgo(2, 11), initialAssessment: 'Outpatient chemotherapy infusion, cycle 2 of 6.' },
  { id: uid(212), key: 'adm20', patientKey: 'pt19', physicianUserId: 'DOC005', admissionDate: daysAgo(5), initialAssessment: 'Acute pancreatitis, mild. Alcohol-related.' },
  { id: uid(213), key: 'adm23', patientKey: 'pt22', physicianUserId: 'DOC002', admissionDate: daysAgo(1), initialAssessment: 'Dengue fever with warning signs. Platelet 88 x10^9/L.' },
  { id: uid(214), key: 'adm24', patientKey: 'pt23', physicianUserId: 'DOC003', admissionDate: daysAgo(11), initialAssessment: 'Chronic kidney disease stage 5, uremic symptoms. For dialysis initiation.' },
  { id: uid(215), key: 'adm26', patientKey: 'pt25', physicianUserId: 'DOC005', admissionDate: daysAgo(6), initialAssessment: 'Post-op hernia repair, elective.' },
  { id: uid(216), key: 'adm28', patientKey: 'pt27', physicianUserId: 'DOC001', admissionDate: daysAgo(2), initialAssessment: 'Acute bronchitis, viral versus bacterial.' },
  { id: uid(217), key: 'adm30', patientKey: 'pt29', physicianUserId: 'DOC003', admissionDate: daysAgo(3), initialAssessment: 'Transient ischemic attack, carotid bruit on exam.' },
  { id: uid(218), key: 'adm31', patientKey: 'pt30', physicianUserId: 'DOC004', admissionDate: daysAgo(8), initialAssessment: 'Asthma exacerbation, moderate.' },
  { id: uid(219), key: 'adm36', patientKey: 'pt19', physicianUserId: 'DOC005', admissionDate: daysAgo(4), isOutpatient: true, outpatientSetAt: daysAgo(4, 10), initialAssessment: 'Outpatient follow-up endoscopy for pancreatitis.' },

  // Discharged
  { id: uid(220), key: 'adm3', patientKey: 'pt3', physicianUserId: 'DOC001', admissionDate: daysAgo(21), dischargeDate: daysAgo(6), initialAssessment: 'Infected diabetic foot ulcer, right lower extremity.' },
  { id: uid(221), key: 'adm5', patientKey: 'pt5', physicianUserId: 'DOC001', admissionDate: daysAgo(40), dischargeDate: daysAgo(29), initialAssessment: 'Acute exacerbation of COPD.' },
  { id: uid(222), key: 'adm7', patientKey: 'pt1', physicianUserId: 'DOC002', admissionDate: daysAgo(60), dischargeDate: daysAgo(47), initialAssessment: 'Acute gastroenteritis with moderate dehydration.' },
  { id: uid(223), key: 'adm9', patientKey: 'pt8', physicianUserId: 'DOC003', admissionDate: daysAgo(14), dischargeDate: daysAgo(2), initialAssessment: 'Ischemic stroke, left MCA territory. Thrombolysis not given.' },
  { id: uid(224), key: 'adm12', patientKey: 'pt11', physicianUserId: 'DOC005', admissionDate: daysAgo(12), dischargeDate: daysAgo(3), initialAssessment: 'Chronic obstructive asthma with acute exacerbation.' },
  { id: uid(225), key: 'adm13', patientKey: 'pt12', physicianUserId: 'DOC005', admissionDate: daysAgo(18), dischargeDate: daysAgo(9), initialAssessment: 'Osteoporotic vertebral compression fracture, T8.' },
  { id: uid(226), key: 'adm16', patientKey: 'pt15', physicianUserId: 'DOC001', admissionDate: daysAgo(25), dischargeDate: daysAgo(14), initialAssessment: 'Acute myocardial infarction, STEMI anterior. Underwent PCI.' },
  { id: uid(227), key: 'adm18', patientKey: 'pt17', physicianUserId: 'DOC003', admissionDate: daysAgo(30), dischargeDate: daysAgo(21), initialAssessment: 'Pneumonia, severe CAP. Required ICU stay for 5 days.' },
  { id: uid(228), key: 'adm21', patientKey: 'pt20', physicianUserId: 'DOC006', admissionDate: daysAgo(9), dischargeDate: daysAgo(1), initialAssessment: 'Cholecystitis, acute calculous. Underwent laparoscopic cholecystectomy.' },
  { id: uid(229), key: 'adm22', patientKey: 'pt21', physicianUserId: 'DOC001', admissionDate: daysAgo(45), dischargeDate: daysAgo(33), initialAssessment: 'Congestive heart failure exacerbation, fluid overload.' },
  { id: uid(230), key: 'adm25', patientKey: 'pt24', physicianUserId: 'DOC004', admissionDate: daysAgo(20), dischargeDate: daysAgo(10), initialAssessment: 'Cellulitis, left lower leg. Diabetes mellitus type 2.' },
  { id: uid(231), key: 'adm27', patientKey: 'pt26', physicianUserId: 'DOC006', admissionDate: daysAgo(15), dischargeDate: daysAgo(4), initialAssessment: 'Acute tonsillopharyngitis with peritonsillar abscess.' },
  { id: uid(232), key: 'adm29', patientKey: 'pt28', physicianUserId: 'DOC002', admissionDate: daysAgo(35), dischargeDate: daysAgo(24), initialAssessment: 'Urinary tract infection with sepsis, community-acquired.' },
  { id: uid(233), key: 'adm32', patientKey: 'pt2', physicianUserId: 'DOC002', admissionDate: daysAgo(90), dischargeDate: daysAgo(80), initialAssessment: 'Dengue fever, prior admission.' },
  { id: uid(234), key: 'adm33', patientKey: 'pt7', physicianUserId: 'DOC003', admissionDate: daysAgo(70), dischargeDate: daysAgo(60), initialAssessment: 'Gastroesophageal reflux disease, poorly controlled.' },
  { id: uid(235), key: 'adm34', patientKey: 'pt13', physicianUserId: 'DOC006', admissionDate: daysAgo(100), dischargeDate: daysAgo(92), initialAssessment: 'Stable angina, for coronary angiogram.' },
  { id: uid(236), key: 'adm35', patientKey: 'pt15', physicianUserId: 'DOC001', admissionDate: daysAgo(55), dischargeDate: daysAgo(48), initialAssessment: 'Atrial fibrillation with rapid ventricular response.' },
];

// ---------------------------------------------------------------------------
// Course in the Ward summaries
// ---------------------------------------------------------------------------

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
  philhealthCf4Status?: PhilHealthCF4Status;
  philhealthCf4DecidedAt?: Date;
}

export const coursesInWard: SeedCourseInWard[] = [
  {
    id: uid(301), key: 'c1', patientKey: 'pt5', admissionKey: 'adm5',
    summaryDate: daysAgo(31), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC002', validatedAt: daysAgo(29),
    philhealthCf4Status: PhilHealthCF4Status.APPROVED, philhealthCf4DecidedAt: daysAgo(28),
    summaryContent:
      'The patient was admitted for an acute exacerbation of chronic obstructive pulmonary disease. ' +
      'Supplemental oxygen was administered and gradually tapered as oxygen saturation stabilized. ' +
      'Intravenous corticosteroids and scheduled bronchodilator nebulizations were given per physician order. ' +
      'Serial chest radiographs were obtained and showed gradual resolution of the infiltrates. ' +
      'The patient was discharged in improved condition with a maintenance inhaler regimen.',
  },
  {
    id: uid(302), key: 'c2', patientKey: 'pt3', admissionKey: 'adm3',
    summaryDate: daysAgo(8), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC002', validatedAt: daysAgo(5),
    philhealthCf4Status: PhilHealthCF4Status.APPROVED, philhealthCf4DecidedAt: daysAgo(4),
    summaryContent:
      'The patient was admitted for an infected diabetic foot ulcer on the right lower extremity. ' +
      'Intravenous clindamycin and basal-bolus insulin therapy were administered as ordered. ' +
      'Daily sterile dressing changes with normal saline irrigation were performed on the wound. ' +
      'Blood glucose was monitored four times daily and the insulin regimen was titrated accordingly. ' +
      'The wound showed healthy granulation tissue and the patient was discharged with home wound care instructions.',
  },
  {
    id: uid(303), key: 'c3', patientKey: 'pt1', admissionKey: 'adm1',
    summaryDate: daysAgo(0), status: SummaryStatus.DRAFT_AI,
    summaryContent:
      'The patient was admitted for community-acquired pneumonia with productive cough and intermittent fever. ' +
      'Azithromycin was started and antipyretics were given for fever spikes above 38.5 degrees Celsius. ' +
      'Oxygen saturation was monitored and remained above 95 percent on room air. ' +
      'A repeat chest radiograph was requested to document interval improvement of the infiltrates. ' +
      'The patient continues to improve and remains under close observation on the ward.',
  },
  {
    id: uid(304), key: 'c4', patientKey: 'pt2', admissionKey: 'adm2',
    summaryDate: daysAgo(1), status: SummaryStatus.DRAFT_EDITED,
    summaryContent:
      'The patient was admitted for acute pyelonephritis presenting with flank pain, dysuria, and fever. ' +
      'Intravenous ceftriaxone and fluid resuscitation were initiated on admission. ' +
      'Urine culture and sensitivity were obtained before the first antibiotic dose. ' +
      'The fever resolved after 48 hours of therapy and repeat urinalysis showed improving pyuria. ' +
      'The patient was advised to complete a seven-day antibiotic course and to follow up at the OPD.',
  },
  {
    id: uid(305), key: 'c5', patientKey: 'pt6', admissionKey: 'adm6',
    summaryDate: daysAgo(0), status: SummaryStatus.DRAFT_EDITED,
    summaryContent:
      'The patient was admitted for observation due to suspected dengue fever with fever and body malaise. ' +
      'Serial platelet counts and hematocrit were monitored every 24 hours as ordered. ' +
      'Paracetamol was given for fever and oral rehydration was encouraged. ' +
      'No warning signs of plasma leakage were observed during the observation period. ' +
      'The patient remains clinically stable and may be discharged once the platelet count trends upward.',
  },
  {
    id: uid(306), key: 'c6', patientKey: 'pt1', admissionKey: 'adm7',
    summaryDate: daysAgo(50), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC001', validatedAt: daysAgo(46),
    philhealthCf4Status: PhilHealthCF4Status.APPROVED, philhealthCf4DecidedAt: daysAgo(45),
    summaryContent:
      'The patient was admitted for acute gastroenteritis with moderate dehydration. ' +
      'Intravenous fluid resuscitation was initiated and oral rehydration was introduced as tolerated. ' +
      'Antiemetics were given for persistent vomiting during the first hospital day. ' +
      'Serial laboratory parameters normalized and oral intake improved progressively. ' +
      'The patient was discharged improved with dietary advice and a scheduled OPD follow-up.',
  },
  {
    id: uid(307), key: 'c7', patientKey: 'pt8', admissionKey: 'adm9',
    summaryDate: daysAgo(3), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC004', validatedAt: daysAgo(2),
    philhealthCf4Status: PhilHealthCF4Status.PENDING,
    summaryContent:
      'The patient was admitted for an ischemic stroke involving the left middle cerebral artery territory. ' +
      'Antiplatelet therapy with aspirin was initiated and statin therapy was continued. ' +
      'Blood pressure was cautiously lowered per protocol and dysphagia screening was performed. ' +
      'Physical and occupational therapy were started on hospital day two. ' +
      'The patient was discharged with minimal residual weakness and enrolled in outpatient rehabilitation.',
  },
  {
    id: uid(308), key: 'c8', patientKey: 'pt7', admissionKey: 'adm8',
    summaryDate: daysAgo(0), status: SummaryStatus.DRAFT_AI,
    summaryContent:
      'The patient was admitted for hypertensive urgency presenting with severe headache and blood pressure of 180/110 mmHg. ' +
      'Intravenous antihypertensives were titrated to achieve gradual blood pressure reduction. ' +
      'Neurologic examinations remained non-focal and cranial imaging was unremarkable. ' +
      'The patient reported resolution of headache with controlled blood pressure. ' +
      'He remains admitted for further blood pressure optimization and workup for secondary causes.',
  },
  {
    id: uid(309), key: 'c9', patientKey: 'pt12', admissionKey: 'adm13',
    summaryDate: daysAgo(10), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC006', validatedAt: daysAgo(9),
    philhealthCf4Status: PhilHealthCF4Status.APPROVED, philhealthCf4DecidedAt: daysAgo(8),
    summaryContent:
      'The patient was admitted for an osteoporotic vertebral compression fracture at T8. ' +
      'Analgesics and calcitonin were given and a thoracolumbosacral orthosis was fitted. ' +
      'The patient was mobilized with assistance and physiotherapy was initiated. ' +
      'Vertebroplasty was considered but deferred given clinical improvement with conservative care. ' +
      'She was discharged with a home exercise program and calcium plus vitamin D supplementation.',
  },
  {
    id: uid(310), key: 'c10', patientKey: 'pt11', admissionKey: 'adm12',
    summaryDate: daysAgo(5), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC004', validatedAt: daysAgo(4),
    philhealthCf4Status: PhilHealthCF4Status.APPROVED, philhealthCf4DecidedAt: daysAgo(3),
    summaryContent:
      'The patient was admitted for chronic obstructive asthma with acute exacerbation. ' +
      'Systemic corticosteroids and scheduled bronchodilator nebulizations were administered. ' +
      'Antibiotics were started for a suspected bacterial trigger based on sputum characteristics. ' +
      'Peak expiratory flow rates improved steadily over the hospital course. ' +
      'He was discharged on a controller inhaler regimen with an asthma action plan.',
  },
  {
    id: uid(311), key: 'c11', patientKey: 'pt15', admissionKey: 'adm16',
    summaryDate: daysAgo(15), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC002', validatedAt: daysAgo(14),
    philhealthCf4Status: PhilHealthCF4Status.APPROVED, philhealthCf4DecidedAt: daysAgo(13),
    summaryContent:
      'The patient was admitted for an acute anterior ST-elevation myocardial infarction. ' +
      'He was brought emergently to the catheterization laboratory where primary PCI with stenting of the LAD was performed. ' +
      'Dual antiplatelet therapy and high-intensity statin were started post-procedure. ' +
      'Serial troponins and echocardiography documented an ejection fraction of 45 percent. ' +
      'Cardiac rehabilitation was initiated and he was discharged with medication reconciliation and follow-up.',
  },
  {
    id: uid(312), key: 'c12', patientKey: 'pt17', admissionKey: 'adm18',
    summaryDate: daysAgo(22), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC001', validatedAt: daysAgo(21),
    philhealthCf4Status: PhilHealthCF4Status.APPROVED, philhealthCf4DecidedAt: daysAgo(20),
    summaryContent:
      'The patient was admitted for severe community-acquired pneumonia requiring ICU admission. ' +
      'He required high-flow oxygen and briefly non-invasive ventilation for respiratory failure. ' +
      'Broad-spectrum antibiotics were initiated and later narrowed based on culture results. ' +
      'He was stepped down to the general ward on hospital day five after clinical improvement. ' +
      'He was discharged on oral antibiotics with a follow-up chest radiograph scheduled in four weeks.',
  },
  {
    id: uid(313), key: 'c13', patientKey: 'pt20', admissionKey: 'adm21',
    summaryDate: daysAgo(2), status: SummaryStatus.DRAFT_EDITED,
    summaryContent:
      'The patient was admitted for acute calculous cholecystitis. ' +
      'She underwent a laparoscopic cholecystectomy on hospital day two without complications. ' +
      'Post-operative analgesia and a short course of antibiotics were administered. ' +
      'Diet was advanced as tolerated and the surgical incision remained clean and dry. ' +
      'She was discharged on post-operative day three with wound care instructions.',
  },
  {
    id: uid(314), key: 'c14', patientKey: 'pt21', admissionKey: 'adm22',
    summaryDate: daysAgo(34), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC003', validatedAt: daysAgo(33),
    philhealthCf4Status: PhilHealthCF4Status.APPROVED, philhealthCf4DecidedAt: daysAgo(32),
    summaryContent:
      'The patient was admitted for congestive heart failure exacerbation with fluid overload. ' +
      'Intravenous diuretics were given with strict input and output monitoring and daily weights. ' +
      'He experienced symptomatic improvement with resolution of orthopnea and edema. ' +
      'Medications were optimized including a beta blocker and an ACE inhibitor. ' +
      'He was discharged with a heart failure education packet and a follow-up in two weeks.',
  },
  {
    id: uid(315), key: 'c15', patientKey: 'pt9', admissionKey: 'adm10',
    summaryDate: daysAgo(0), status: SummaryStatus.DRAFT_AI,
    summaryContent:
      'The patient was admitted for acute decompensated heart failure NYHA class III. ' +
      'Intravenous furosemide was administered with strict fluid balance monitoring. ' +
      'Echocardiography revealed a reduced ejection fraction of 35 percent. ' +
      'Guideline-directed medical therapy was initiated and titrated as blood pressure allowed. ' +
      'The patient remains admitted with improving dyspnea and decreasing peripheral edema.',
  },
  {
    id: uid(316), key: 'c16', patientKey: 'pt24', admissionKey: 'adm25',
    summaryDate: daysAgo(11), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC005', validatedAt: daysAgo(10),
    philhealthCf4Status: PhilHealthCF4Status.APPROVED, philhealthCf4DecidedAt: daysAgo(9),
    summaryContent:
      'The patient was admitted for cellulitis of the left lower leg in the setting of type 2 diabetes mellitus. ' +
      'Intravenous antibiotics were administered with clinical improvement in erythema and tenderness. ' +
      'Blood glucose was controlled with basal-bolus insulin and diabetes education was provided. ' +
      'The affected limb was elevated and serial measurements of limb circumference documented decreasing edema. ' +
      'She was discharged on oral antibiotics with a podiatry follow-up.',
  },
  {
    id: uid(317), key: 'c17', patientKey: 'pt26', admissionKey: 'adm27',
    summaryDate: daysAgo(5), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC001', validatedAt: daysAgo(4),
    philhealthCf4Status: PhilHealthCF4Status.APPROVED, philhealthCf4DecidedAt: daysAgo(4),
    summaryContent:
      'The patient was admitted for acute tonsillopharyngitis with a right peritonsillar abscess. ' +
      'Intravenous antibiotics and corticosteroids were started on admission. ' +
      'Incision and drainage of the abscess was performed by ENT on hospital day two. ' +
      'The patient reported significant relief of odynophagia and trismus after drainage. ' +
      'She was discharged on oral antibiotics with ENT follow-up.',
  },
  {
    id: uid(318), key: 'c18', patientKey: 'pt28', admissionKey: 'adm29',
    summaryDate: daysAgo(25), status: SummaryStatus.APPROVED,
    validatorUserId: 'DOC005', validatedAt: daysAgo(24),
    philhealthCf4Status: PhilHealthCF4Status.REJECTED, philhealthCf4DecidedAt: daysAgo(22),
    summaryContent:
      'The patient was admitted for community-acquired urinary tract infection with sepsis. ' +
      'Intravenous fluids and broad-spectrum antibiotics were initiated after blood and urine cultures were obtained. ' +
      'She responded clinically within 48 hours with defervescence and hemodynamic stabilization. ' +
      'Antibiotics were narrowed based on culture sensitivities and she completed a full course. ' +
      'She was discharged with urology follow-up for recurrent urinary tract infections.',
  },
  {
    id: uid(319), key: 'c19', patientKey: 'pt10', admissionKey: 'adm11',
    summaryDate: daysAgo(0), status: SummaryStatus.DRAFT_AI,
    summaryContent:
      'The patient was admitted for severe anemia with an admission hemoglobin of 6.8 g/dL. ' +
      'She received packed red blood cell transfusion with post-transfusion hemoglobin of 9.4 g/dL. ' +
      'Diagnostic workup including iron studies, endoscopy, and gynecologic evaluation was initiated. ' +
      'She reported improvement in fatigue and dyspnea on exertion after transfusion. ' +
      'She remains admitted pending finalization of the anemia workup.',
  },
  {
    id: uid(320), key: 'c20', patientKey: 'pt14', admissionKey: 'adm15',
    summaryDate: daysAgo(1), status: SummaryStatus.DRAFT_EDITED,
    summaryContent:
      'The patient was admitted for hyperthyroidism with features of impending thyroid storm. ' +
      'Thionamides, beta blockers, and stress-dose corticosteroids were administered. ' +
      'She was placed on a cooling blanket for hyperpyrexia and monitored in a telemetry unit. ' +
      'Free T4 and T3 levels were markedly elevated on admission and trended down with treatment. ' +
      'She remains clinically improving and will be transitioned to oral maintenance therapy.',
  },
];

// ---------------------------------------------------------------------------
// Physician orders
// ---------------------------------------------------------------------------

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
  type?: OrderType;
  status?: OrderStatus;
  nurseComment?: string;
  executedByUserId?: string;
  executedAt?: Date;
  communicationChannel?: CommunicationChannel;
}

type OrderExtra = Partial<
  Pick<
    SeedOrder,
    | 'active'
    | 'type'
    | 'status'
    | 'nurseComment'
    | 'executedByUserId'
    | 'executedAt'
    | 'communicationChannel'
  >
>;

function o(
  seq: number,
  admissionKey: string,
  courseKey: string | null,
  content: string,
  created: Date,
  orderedBy: string,
  encodedBy: string,
  role: OrderEnteredBy,
  extra: OrderExtra = {},
): SeedOrder {
  return {
    id: uid(seq),
    orderContent: content,
    dateCreated: created,
    admissionKey,
    courseKey: courseKey ?? undefined,
    orderedByUserId: orderedBy,
    encodedByUserId: encodedBy,
    enteredByRole: role,
    ...extra,
  };
}

export const orders: SeedOrder[] = [
  // ---------- adm1 — Juan Dela Cruz (current stay, DOC001) ----------
  o(401, 'adm1', 'c3', 'Admit to Medical Ward. Chest x-ray PA view STAT.', daysAgo(9, 10), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(9, 11) }),
  o(402, 'adm1', 'c3', 'Paracetamol 500 mg tablet every 4 hours as needed for fever above 38.5 degrees Celsius.', daysAgo(5, 18), 'DOC001', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(5, 19) }),
  o(403, 'adm1', 'c3', 'Azithromycin 500 mg tablet once daily for 7 days.', daysAgo(2, 11), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(2, 12) }),
  o(404, 'adm1', 'c3', 'Repeat complete blood count tomorrow morning before breakfast.', daysAgo(0, 8), 'DOC001', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.TO_ACCOMPLISH }),
  o(405, 'adm1', 'c3', 'Continue oxygen at 2 L/min via nasal cannula titrated to keep SpO2 above 95 percent.', daysAgo(6, 14), 'DOC001', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(6, 14), communicationChannel: CommunicationChannel.VERBAL }),
  o(406, 'adm1', null, 'Paracetamol 500 mg tablet every 6 hours (discontinued).', daysAgo(6, 16), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { active: false, status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(6, 17), nurseComment: 'Discontinued per physician after fever resolved.' }),
  o(407, 'adm1', 'c3', 'Encourage oral fluids up to 2 liters per day unless contraindicated.', daysAgo(4, 9), 'DOC001', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(4, 9) }),

  // ---------- adm2 — Maria Clara Mendoza (DOC002) ----------
  o(410, 'adm2', 'c4', 'Admit to Female Medical Ward. Start IVF PNSS 1 liter at 80 ml/hr.', daysAgo(4, 14), 'DOC002', 'DOC002', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(4, 15) }),
  o(411, 'adm2', 'c4', 'Ceftriaxone 1 gram IV once daily.', daysAgo(3, 16), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(3, 17) }),
  o(412, 'adm2', 'c4', 'Urinalysis and urine culture and sensitivity prior to antibiotic administration.', daysAgo(1, 9), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(1, 10) }),
  o(413, 'adm2', 'c4', 'Monitor temperature every 4 hours and document fever spikes.', daysAgo(4, 15), 'DOC002', 'NRS004', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS004', executedAt: daysAgo(4, 15) }),
  o(414, 'adm2', 'c4', 'Repeat creatinine and CBC on hospital day 3.', daysAgo(2, 10), 'DOC002', 'DOC002', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.TO_ACCOMPLISH }),

  // ---------- adm4 — Ana Marie Villanueva (DOC002), no summary ----------
  o(420, 'adm4', null, 'Admit to Surgical Ward. NPO. Prepare for emergency appendectomy.', daysAgo(2, 20), 'DOC002', 'DOC002', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(2, 21), communicationChannel: CommunicationChannel.VERBAL }),
  o(421, 'adm4', null, 'Post-operative: Cefuroxime 750 mg IV every 8 hours. Advance diet as tolerated.', daysAgo(1, 8), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(1, 9) }),
  o(422, 'adm4', null, 'Ketorolac 30 mg IV every 6 hours as needed for pain.', daysAgo(1, 8), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(1, 9), nurseComment: 'Given for breakthrough pain post-op day 1.' }),
  o(423, 'adm4', null, 'Strict input and output monitoring. Daily weights.', daysAgo(1, 9), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(1, 9) }),

  // ---------- adm6 — Liza Fernandez (DOC002) ----------
  o(430, 'adm6', 'c5', 'Admit for dengue fever observation. Strict monitoring of vital signs every 4 hours.', daysAgo(1, 14), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(1, 15) }),
  o(431, 'adm6', 'c5', 'Repeat platelet count and hematocrit today. Encourage oral rehydration.', daysAgo(0, 7), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(0, 8) }),
  o(432, 'adm6', 'c5', 'Paracetamol 500 mg every 6 hours as needed for fever. Avoid NSAIDs.', daysAgo(1, 14), 'DOC002', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(1, 15) }),
  o(433, 'adm6', 'c5', 'Watch for warning signs: persistent vomiting, abdominal pain, bleeding, restlessness.', daysAgo(1, 14), 'DOC002', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(1, 14) }),

  // ---------- adm8 — Carlos Reyes (DOC003) ----------
  o(440, 'adm8', 'c8', 'Admit to Medical Ward. Neurologic checks every 2 hours.', daysAgo(8, 10), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(8, 11) }),
  o(441, 'adm8', 'c8', 'Nicardipine drip titrated to keep SBP between 140 and 160 mmHg.', daysAgo(8, 10), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(8, 11) }),
  o(442, 'adm8', 'c8', 'Cranial CT scan non-contrast STAT.', daysAgo(8, 11), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(8, 12) }),
  o(443, 'adm8', 'c8', 'Amlodipine 10 mg PO once daily once SBP consistently below 160 mmHg.', daysAgo(5, 8), 'DOC003', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(5, 9) }),
  o(444, 'adm8', 'c8', 'Low-salt, low-fat diet. Diabetic diet if fasting glucose above 126 mg/dL.', daysAgo(7, 7), 'DOC003', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(7, 7) }),

  // ---------- adm10 — Miguel Santos (DOC004) ----------
  o(450, 'adm10', 'c15', 'Admit to Medical Ward. Strict input and output. Daily weights.', daysAgo(4, 11), 'DOC004', 'DOC004', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS004', executedAt: daysAgo(4, 12) }),
  o(451, 'adm10', 'c15', 'Furosemide 40 mg IV every 12 hours.', daysAgo(4, 11), 'DOC004', 'DOC004', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS004', executedAt: daysAgo(4, 12) }),
  o(452, 'adm10', 'c15', 'Echocardiography transthoracic, complete.', daysAgo(3, 9), 'DOC004', 'NRS004', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(3, 10) }),
  o(453, 'adm10', 'c15', 'Carvedilol 3.125 mg PO twice daily.', daysAgo(2, 8), 'DOC004', 'NRS004', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS004', executedAt: daysAgo(2, 9) }),
  o(454, 'adm10', 'c15', 'Low-sodium diet 2 grams per day. Fluid restriction 1.5 liters per day.', daysAgo(4, 11), 'DOC004', 'NRS004', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS004', executedAt: daysAgo(4, 11) }),

  // ---------- adm11 — Elena Cruz (DOC004) ----------
  o(460, 'adm11', 'c19', 'Admit to Medical Ward. Type and screen, crossmatch 2 units PRBC.', daysAgo(7, 13), 'DOC004', 'DOC004', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(7, 14) }),
  o(461, 'adm11', 'c19', 'Transfuse 2 units packed RBC. Premedicate with paracetamol and diphenhydramine.', daysAgo(7, 14), 'DOC004', 'DOC004', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(7, 15) }),
  o(462, 'adm11', 'c19', 'Iron studies, vitamin B12, folate, reticulocyte count.', daysAgo(6, 8), 'DOC004', 'NRS005', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(6, 9) }),
  o(463, 'adm11', 'c19', 'Upper GI endoscopy and colonoscopy under conscious sedation.', daysAgo(3, 8), 'DOC004', 'DOC004', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.TO_ACCOMPLISH }),
  o(464, 'adm11', 'c19', 'Ferrous sulfate 325 mg PO once daily with vitamin C.', daysAgo(2, 9), 'DOC004', 'NRS005', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS005', executedAt: daysAgo(2, 9) }),

  // ---------- adm14 — Eduardo Torres (DOC006) ----------
  o(470, 'adm14', null, 'Admit to Coronary Care Unit. Continuous cardiac monitoring.', daysAgo(1, 15), 'DOC006', 'DOC006', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(1, 16), communicationChannel: CommunicationChannel.VERBAL }),
  o(471, 'adm14', null, 'Aspirin 300 mg PO loading dose, then 80 mg once daily.', daysAgo(1, 15), 'DOC006', 'DOC006', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(1, 16) }),
  o(472, 'adm14', null, 'Ticagrelor 180 mg PO loading dose, then 90 mg twice daily.', daysAgo(1, 15), 'DOC006', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(1, 16) }),
  o(473, 'adm14', null, 'Serial troponin I every 6 hours for 3 sets. STAT 12-lead ECG now.', daysAgo(1, 15), 'DOC006', 'DOC006', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(1, 17) }),
  o(474, 'adm14', null, 'Atorvastatin 80 mg PO once daily at bedtime.', daysAgo(0, 8), 'DOC006', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(0, 9) }),

  // ---------- adm15 — Carmen Delgado (DOC006) ----------
  o(480, 'adm15', 'c20', 'Admit to Medical Ward. Telemetry monitoring.', daysAgo(6, 16), 'DOC006', 'DOC006', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(6, 17) }),
  o(481, 'adm15', 'c20', 'Methimazole 20 mg PO every 8 hours.', daysAgo(6, 16), 'DOC006', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(6, 17) }),
  o(482, 'adm15', 'c20', 'Propranolol 40 mg PO every 6 hours.', daysAgo(6, 16), 'DOC006', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(6, 17) }),
  o(483, 'adm15', 'c20', 'Hydrocortisone 100 mg IV every 8 hours.', daysAgo(6, 16), 'DOC006', 'DOC006', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(6, 17) }),
  o(484, 'adm15', 'c20', 'Free T4, T3, TSH daily while inpatient.', daysAgo(5, 7), 'DOC006', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(5, 8) }),

  // ---------- adm17 — Gloria Sandoval (DOC002) ----------
  o(490, 'adm17', null, 'Admit to Medical Ward. IVF PNSS 1 liter at 100 ml/hr.', daysAgo(3, 10), 'DOC002', 'NRS004', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS004', executedAt: daysAgo(3, 11) }),
  o(491, 'adm17', null, 'Pantoprazole 40 mg IV every 12 hours.', daysAgo(3, 10), 'DOC002', 'NRS004', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS004', executedAt: daysAgo(3, 11) }),
  o(492, 'adm17', null, 'Soft bland diet. Avoid NSAIDs, caffeine, and spicy food.', daysAgo(3, 11), 'DOC002', 'NRS004', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS004', executedAt: daysAgo(3, 12) }),

  // ---------- adm19 — Teresa Gomez (DOC004) outpatient ----------
  o(500, 'adm19', null, 'Outpatient chemotherapy infusion cycle 2 of 6. Paclitaxel + carboplatin.', daysAgo(2, 8), 'DOC004', 'DOC004', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(2, 12) }),
  o(501, 'adm19', null, 'Ondansetron 8 mg IV 30 minutes before chemotherapy.', daysAgo(2, 8), 'DOC004', 'DOC004', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(2, 9) }),
  o(502, 'adm19', null, 'Dexamethasone 8 mg IV 30 minutes before chemotherapy.', daysAgo(2, 8), 'DOC004', 'DOC004', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(2, 9) }),

  // ---------- adm20 — Rafael Villanueva (DOC005) ----------
  o(510, 'adm20', null, 'Admit to Medical Ward. NPO then clear liquids as tolerated.', daysAgo(5, 9), 'DOC005', 'DOC005', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(5, 10) }),
  o(511, 'adm20', null, 'Morphine 4 mg IV every 4 hours as needed for severe pain.', daysAgo(5, 9), 'DOC005', 'DOC005', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(5, 10) }),
  o(512, 'adm20', null, 'IVF Lactated Ringer solution 1 liter at 100 ml/hr.', daysAgo(5, 9), 'DOC005', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(5, 10) }),
  o(513, 'adm20', null, 'Serum lipase and amylase daily.', daysAgo(4, 7), 'DOC005', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(4, 8) }),

  // ---------- adm23 — Maribel Castillo (DOC002) ----------
  o(520, 'adm23', null, 'Admit for dengue fever with warning signs. Monitoring every 2 hours.', daysAgo(1, 10), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(1, 11) }),
  o(521, 'adm23', null, 'CBC with platelet count and hematocrit every 12 hours.', daysAgo(1, 10), 'DOC002', 'DOC002', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(1, 11) }),
  o(522, 'adm23', null, 'Paracetamol 500 mg PO every 6 hours as needed for fever.', daysAgo(1, 10), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(1, 11) }),
  o(523, 'adm23', null, 'Strict input and output monitoring. Encourage oral fluids.', daysAgo(1, 11), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(1, 11) }),

  // ---------- adm24 — Joaquin Mercado (DOC003) ----------
  o(530, 'adm24', null, 'Admit to Medical Ward. Nephrology referral for dialysis initiation.', daysAgo(11, 14), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(11, 15) }),
  o(531, 'adm24', null, 'Strict input and output. Fluid restriction 1 liter per day.', daysAgo(11, 14), 'DOC003', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(11, 15) }),
  o(532, 'adm24', null, 'Renal diet: low potassium, low phosphorus, 60 grams protein per day.', daysAgo(11, 14), 'DOC003', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(11, 15) }),
  o(533, 'adm24', null, 'Calcium carbonate 500 mg PO with meals. Calcitriol 0.25 mcg once daily.', daysAgo(10, 8), 'DOC003', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(10, 9) }),

  // ---------- adm26 — Nestor Agustin (DOC005) ----------
  o(540, 'adm26', null, 'Post-op hernia repair: Cefazolin 1 gram IV every 8 hours for 24 hours.', daysAgo(6, 12), 'DOC005', 'DOC005', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(6, 13) }),
  o(541, 'adm26', null, 'Regular diet as tolerated. Early ambulation.', daysAgo(6, 12), 'DOC005', 'NRS005', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS005', executedAt: daysAgo(6, 13) }),
  o(542, 'adm26', null, 'Wound inspection daily. Dry sterile dressing.', daysAgo(6, 12), 'DOC005', 'NRS005', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS005', executedAt: daysAgo(6, 13) }),

  // ---------- adm28 — Emilio Buenaventura (DOC001) ----------
  o(550, 'adm28', null, 'Admit for acute bronchitis. Guaifenesin 600 mg PO every 12 hours.', daysAgo(2, 10), 'DOC001', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(2, 11) }),
  o(551, 'adm28', null, 'Azithromycin 500 mg PO once daily for 3 days (Z-pack).', daysAgo(2, 10), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS001', executedAt: daysAgo(2, 11) }),
  o(552, 'adm28', null, 'Chest x-ray PA and lateral to rule out pneumonia.', daysAgo(2, 10), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(2, 12) }),

  // ---------- adm30 — Ismael Ocampo (DOC003) ----------
  o(560, 'adm30', null, 'Admit for TIA workup. Neuro checks every 4 hours.', daysAgo(3, 11), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(3, 12) }),
  o(561, 'adm30', null, 'Carotid Doppler ultrasound bilateral.', daysAgo(3, 11), 'DOC003', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(3, 13) }),
  o(562, 'adm30', null, 'Aspirin 81 mg PO once daily. Atorvastatin 40 mg once daily.', daysAgo(3, 11), 'DOC003', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS002', executedAt: daysAgo(3, 12) }),

  // ---------- adm31 — Dolores Manalo (DOC004) ----------
  o(570, 'adm31', null, 'Admit for asthma exacerbation. Salbutamol nebulization every 4 hours.', daysAgo(8, 9), 'DOC004', 'NRS005', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS005', executedAt: daysAgo(8, 10) }),
  o(571, 'adm31', null, 'Methylprednisolone 40 mg IV every 12 hours.', daysAgo(8, 9), 'DOC004', 'DOC004', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS005', executedAt: daysAgo(8, 10) }),
  o(572, 'adm31', null, 'Ipratropium nebulization every 6 hours.', daysAgo(8, 9), 'DOC004', 'NRS005', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS005', executedAt: daysAgo(8, 10) }),
  o(573, 'adm31', null, 'Peak expiratory flow rate before and after nebulization.', daysAgo(7, 7), 'DOC004', 'NRS005', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS005', executedAt: daysAgo(7, 8) }),

  // ---------- adm3 — Pedro Lim (discharged, DOC001) ----------
  o(580, 'adm3', 'c2', 'Admit to Medical Ward for infected diabetic foot ulcer, right foot. Strict blood glucose monitoring.', daysAgo(20, 15), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(20, 16) }),
  o(581, 'adm3', 'c2', 'Insulin glargine 20 units subcut once nightly with sliding scale insulin before meals.', daysAgo(15, 12), 'DOC001', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(15, 13) }),
  o(582, 'adm3', 'c2', 'Clindamycin 600 mg IV every 8 hours.', daysAgo(12, 17), 'DOC001', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(12, 18) }),
  o(583, 'adm3', 'c2', 'Wound care: sterile dressing change once daily with normal saline irrigation.', daysAgo(8, 10), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(8, 11) }),
  o(584, 'adm3', 'c2', 'Cefuroxime 750 mg IV every 8 hours (changed to clindamycin).', daysAgo(14, 18), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { active: false, status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(14, 19), nurseComment: 'Discontinued due to culture results favoring clindamycin.' }),

  // ---------- adm5 — Ramon Garcia (discharged, DOC001) ----------
  o(590, 'adm5', 'c1', 'Admit for acute exacerbation of COPD. Start oxygen 2 L/min via nasal cannula.', daysAgo(39, 13), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(39, 14) }),
  o(591, 'adm5', 'c1', 'Prednisone 40 mg PO once daily. Salbutamol nebulization every 4 hours.', daysAgo(37, 15), 'DOC001', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(37, 16) }),
  o(592, 'adm5', 'c1', 'Chest x-ray PA view.', daysAgo(35, 9), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(35, 10) }),
  o(593, 'adm5', 'c1', 'Doxycycline 100 mg PO twice daily for 10 days.', daysAgo(33, 16), 'DOC001', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(33, 17) }),
  o(594, 'adm5', 'c1', 'Discharge planning: continue tiotropium inhaler once daily. Follow-up at OPD in 2 weeks.', daysAgo(31, 11), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(31, 12) }),

  // ---------- adm7 — Juan Dela Cruz (prior stay, DOC002) ----------
  o(600, 'adm7', 'c6', 'Admit for acute gastroenteritis with dehydration. IVF PNSS 1 liter bolus then 80 ml/hr.', daysAgo(59, 12), 'DOC002', 'DOC002', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(59, 13) }),
  o(601, 'adm7', 'c6', 'Oral rehydration salts sachet after every loose stool as tolerated.', daysAgo(55, 10), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(55, 11) }),
  o(602, 'adm7', 'c6', 'Advance diet as tolerated. Discharge once tolerating soft diet.', daysAgo(50, 9), 'DOC002', 'DOC002', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(50, 10) }),

  // ---------- adm9 — Rosario Bautista (discharged, DOC003) ----------
  o(610, 'adm9', 'c7', 'Admit to Stroke Unit. Neuro checks every 1 hour for 6 hours then every 2 hours.', daysAgo(14, 10), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(14, 11) }),
  o(611, 'adm9', 'c7', 'Aspirin 300 mg PO loading dose then 81 mg once daily.', daysAgo(14, 10), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(14, 11) }),
  o(612, 'adm9', 'c7', 'Atorvastatin 80 mg PO once daily at bedtime.', daysAgo(14, 10), 'DOC003', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(14, 11) }),
  o(613, 'adm9', 'c7', 'Dysphagia screening prior to any oral intake.', daysAgo(14, 11), 'DOC003', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(14, 12) }),
  o(614, 'adm9', 'c7', 'Physical therapy and occupational therapy evaluation.', daysAgo(12, 8), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(12, 9) }),

  // ---------- adm12 — Ricardo Aquino (discharged, DOC005) ----------
  o(620, 'adm12', 'c10', 'Admit for COPD exacerbation. Salbutamol + ipratropium nebulization every 4 hours.', daysAgo(12, 13), 'DOC005', 'DOC005', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(12, 14) }),
  o(621, 'adm12', 'c10', 'Prednisolone 30 mg PO once daily for 5 days.', daysAgo(12, 13), 'DOC005', 'NRS005', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(12, 14) }),
  o(622, 'adm12', 'c10', 'Levofloxacin 500 mg PO once daily for 7 days.', daysAgo(11, 9), 'DOC005', 'NRS005', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(11, 10) }),
  o(623, 'adm12', 'c10', 'Pulse oximetry every shift and PRN.', daysAgo(12, 13), 'DOC005', 'NRS005', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(12, 14) }),

  // ---------- adm13 — Josefina Ramos (discharged, DOC005) ----------
  o(630, 'adm13', 'c9', 'Admit for osteoporotic vertebral compression fracture. Analgesia as needed.', daysAgo(18, 11), 'DOC005', 'DOC005', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(18, 12) }),
  o(631, 'adm13', 'c9', 'Calcitonin 100 IU subcut every 12 hours for 3 days.', daysAgo(18, 11), 'DOC005', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(18, 12) }),
  o(632, 'adm13', 'c9', 'Thoracolumbosacral orthosis fitted by orthotist.', daysAgo(16, 9), 'DOC005', 'DOC005', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(16, 10) }),
  o(633, 'adm13', 'c9', 'Calcium carbonate + vitamin D 500 mg/400 IU PO twice daily.', daysAgo(15, 8), 'DOC005', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(15, 9) }),

  // ---------- adm16 — Fernando Pascual (discharged, DOC001) ----------
  o(640, 'adm16', 'c11', 'Admit to CCU. STAT 12-lead ECG and troponin I.', daysAgo(25, 12), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(25, 13) }),
  o(641, 'adm16', 'c11', 'Activate catheterization laboratory for primary PCI.', daysAgo(25, 12), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(25, 13), communicationChannel: CommunicationChannel.CALL }),
  o(642, 'adm16', 'c11', 'Aspirin 300 mg loading, ticagrelor 180 mg loading, atorvastatin 80 mg.', daysAgo(25, 12), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(25, 13) }),
  o(643, 'adm16', 'c11', 'Metoprolol succinate 50 mg PO once daily. Ramipril 2.5 mg once daily.', daysAgo(22, 8), 'DOC001', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(22, 9) }),
  o(644, 'adm16', 'c11', 'Cardiac rehabilitation consult. Low-sodium, low-fat diet.', daysAgo(20, 9), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(20, 10) }),

  // ---------- adm18 — Andres Navarro (discharged, DOC003) ----------
  o(650, 'adm18', 'c12', 'Admit to ICU for severe CAP. High-flow nasal cannula at 40 L/min FiO2 60 percent.', daysAgo(30, 14), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(30, 15) }),
  o(651, 'adm18', 'c12', 'Ceftriaxone 2 grams IV once daily plus azithromycin 500 mg IV once daily.', daysAgo(30, 14), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(30, 15) }),
  o(652, 'adm18', 'c12', 'Blood cultures x2, sputum culture, urine antigen for Legionella and pneumococcus.', daysAgo(30, 14), 'DOC003', 'NRS004', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(30, 16) }),
  o(653, 'adm18', 'c12', 'Step down to general ward on hospital day 5 if clinically improved.', daysAgo(25, 9), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(25, 10) }),
  o(654, 'adm18', 'c12', 'Oral antibiotics on discharge: amoxicillin-clavulanate 625 mg TID for 7 days.', daysAgo(21, 10), 'DOC003', 'DOC003', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(21, 11) }),

  // ---------- adm21 — Lucila Domingo (discharged, DOC006) ----------
  o(660, 'adm21', 'c13', 'Admit for acute cholecystitis. NPO. IVF PNSS 1 liter at 100 ml/hr.', daysAgo(9, 15), 'DOC006', 'DOC006', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(9, 16) }),
  o(661, 'adm21', 'c13', 'Ceftriaxone 1 gram IV every 12 hours plus metronidazole 500 mg IV every 8 hours.', daysAgo(9, 15), 'DOC006', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(9, 16) }),
  o(662, 'adm21', 'c13', 'Laparoscopic cholecystectomy on hospital day 2.', daysAgo(7, 8), 'DOC006', 'DOC006', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(7, 9) }),
  o(663, 'adm21', 'c13', 'Post-op: advance diet as tolerated. Ketorolac 30 mg IV every 6 hours PRN.', daysAgo(6, 9), 'DOC006', 'NRS002', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS002', executedAt: daysAgo(6, 10) }),

  // ---------- adm22 — Arturo Salazar (discharged, DOC001) ----------
  o(670, 'adm22', 'c14', 'Admit for CHF exacerbation. Strict input and output. Daily weights.', daysAgo(45, 13), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(45, 14) }),
  o(671, 'adm22', 'c14', 'Furosemide 40 mg IV every 12 hours.', daysAgo(45, 13), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(45, 14) }),
  o(672, 'adm22', 'c14', 'Enalapril 5 mg PO twice daily. Carvedilol 6.25 mg twice daily.', daysAgo(43, 8), 'DOC001', 'NRS005', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(43, 9) }),
  o(673, 'adm22', 'c14', 'Heart failure education packet. Follow-up in 2 weeks.', daysAgo(34, 10), 'DOC001', 'DOC001', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS005', executedAt: daysAgo(34, 11) }),

  // ---------- adm25 — Pilar Espinosa (discharged, DOC004) ----------
  o(680, 'adm25', 'c16', 'Admit for cellulitis of left lower leg. Elevate affected limb.', daysAgo(20, 10), 'DOC004', 'DOC004', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(20, 11) }),
  o(681, 'adm25', 'c16', 'Clindamycin 600 mg IV every 8 hours. Blood glucose monitoring four times daily.', daysAgo(20, 10), 'DOC004', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(20, 11) }),
  o(682, 'adm25', 'c16', 'Insulin glargine 15 units SC nightly, sliding scale with meals.', daysAgo(19, 8), 'DOC004', 'NRS003', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(19, 9) }),
  o(683, 'adm25', 'c16', 'Discharge on cephalexin 500 mg PO four times daily for 7 days.', daysAgo(10, 10), 'DOC004', 'DOC004', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(10, 11) }),

  // ---------- adm27 — Rosalinda Padilla (discharged, DOC006) ----------
  o(690, 'adm27', 'c17', 'Admit for peritonsillar abscess. IVF PNSS 1 liter at 80 ml/hr.', daysAgo(15, 16), 'DOC006', 'DOC006', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(15, 17) }),
  o(691, 'adm27', 'c17', 'Ampicillin-sulbactam 3 grams IV every 6 hours. Dexamethasone 8 mg IV every 8 hours.', daysAgo(15, 16), 'DOC006', 'NRS004', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(15, 17) }),
  o(692, 'adm27', 'c17', 'ENT consult for incision and drainage.', daysAgo(15, 16), 'DOC006', 'DOC006', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(15, 17) }),
  o(693, 'adm27', 'c17', 'NPO then cool clear liquids post-drainage. Advance as tolerated.', daysAgo(13, 8), 'DOC006', 'NRS004', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS004', executedAt: daysAgo(13, 9) }),

  // ---------- adm29 — Corazon Lumibao (discharged, DOC002) ----------
  o(700, 'adm29', 'c18', 'Admit for UTI with sepsis. Blood and urine cultures before antibiotics.', daysAgo(35, 14), 'DOC002', 'DOC002', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(35, 15) }),
  o(701, 'adm29', 'c18', 'Piperacillin-tazobactam 4.5 grams IV every 6 hours.', daysAgo(35, 14), 'DOC002', 'DOC002', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(35, 15) }),
  o(702, 'adm29', 'c18', 'IVF PNSS 1 liter at 100 ml/hr for resuscitation.', daysAgo(35, 14), 'DOC002', 'NRS001', OrderEnteredBy.NURSE_ON_BEHALF,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(35, 15) }),
  o(703, 'adm29', 'c18', 'Narrow antibiotics based on culture sensitivities.', daysAgo(32, 8), 'DOC002', 'DOC002', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(32, 9) }),
  o(704, 'adm29', 'c18', 'Urology follow-up for recurrent UTI.', daysAgo(25, 10), 'DOC002', 'DOC002', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS001', executedAt: daysAgo(25, 11) }),

  // ---------- adm36 — Rafael Villanueva outpatient follow-up ----------
  o(710, 'adm36', null, 'Outpatient EGD for evaluation of chronic epigastric pain.', daysAgo(4, 9), 'DOC005', 'DOC005', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.FINISHED, executedByUserId: 'NRS003', executedAt: daysAgo(4, 10) }),
  o(711, 'adm36', null, 'Pantoprazole 40 mg PO once daily for 8 weeks.', daysAgo(4, 9), 'DOC005', 'DOC005', OrderEnteredBy.PHYSICIAN,
    { status: OrderStatus.ONGOING, executedByUserId: 'NRS003', executedAt: daysAgo(4, 10) }),
];

// ---------------------------------------------------------------------------
// Physician notes
// ---------------------------------------------------------------------------

export interface SeedNote {
  id: string;
  content: string;
  physicianUserId: string;
  patientKey: string;
  createdAt: Date;
  reminderAt?: Date;
}

export const notes: SeedNote[] = [
  { id: uid(601), content: 'Patient afebrile for 24 hours and tolerating oral fluids well. Continue current antibiotics.', physicianUserId: 'DOC002', patientKey: 'pt2', createdAt: daysAgo(3, 11) },
  { id: uid(602), content: 'Lung crackles improved on auscultation. Oxygen saturation stable on room air.', physicianUserId: 'DOC001', patientKey: 'pt1', createdAt: daysAgo(2, 16) },
  { id: uid(603), content: 'Post-operative day 1: incision clean, dry, and intact. Ambulated with assistance.', physicianUserId: 'DOC002', patientKey: 'pt4', createdAt: daysAgo(1, 10) },
  { id: uid(604), content: 'Foot ulcer base is clean with early granulation tissue. Continue daily dressing changes.', physicianUserId: 'DOC001', patientKey: 'pt3', createdAt: daysAgo(12, 15), reminderAt: daysFromNow(1, 9) },
  { id: uid(605), content: 'Platelet count stable at 132. No bleeding manifestations noted.', physicianUserId: 'DOC002', patientKey: 'pt6', createdAt: daysAgo(0, 13) },
  { id: uid(606), content: 'Blood pressure controlled at 138/86 on nicardipine drip. Plan to transition to oral.', physicianUserId: 'DOC003', patientKey: 'pt7', createdAt: daysAgo(5, 8) },
  { id: uid(607), content: 'Echocardiography shows EF 35 percent with global hypokinesia. Start carvedilol low dose.', physicianUserId: 'DOC004', patientKey: 'pt9', createdAt: daysAgo(3, 10) },
  { id: uid(608), content: 'Post-transfusion Hgb 9.4 g/dL. Tolerated transfusion without reaction.', physicianUserId: 'DOC004', patientKey: 'pt10', createdAt: daysAgo(6, 15) },
  { id: uid(609), content: 'Patient reports chest pain resolved after PCI. Troponin trending down.', physicianUserId: 'DOC006', patientKey: 'pt13', createdAt: daysAgo(1, 7) },
  { id: uid(610), content: 'Free T4 trending down. Continue methimazole and propranolol.', physicianUserId: 'DOC006', patientKey: 'pt14', createdAt: daysAgo(2, 9) },
  { id: uid(611), content: 'Epigastric pain improved on pantoprazole. Tolerating soft diet.', physicianUserId: 'DOC002', patientKey: 'pt16', createdAt: daysAgo(2, 11) },
  { id: uid(612), content: 'Lipase trending down. Pain controlled with morphine PRN. Advancing diet slowly.', physicianUserId: 'DOC005', patientKey: 'pt19', createdAt: daysAgo(3, 14) },
  { id: uid(613), content: 'Platelet count 88. Watch closely for warning signs. Encourage oral fluids.', physicianUserId: 'DOC002', patientKey: 'pt22', createdAt: daysAgo(0, 14) },
  { id: uid(614), content: 'Uremic symptoms improving after dialysis. Continue renal diet.', physicianUserId: 'DOC003', patientKey: 'pt23', createdAt: daysAgo(7, 10) },
  { id: uid(615), content: 'Post-op hernia repair: minimal incisional pain. Tolerating regular diet.', physicianUserId: 'DOC005', patientKey: 'pt25', createdAt: daysAgo(4, 9) },
  { id: uid(616), content: 'Cough improving. Chest x-ray shows no consolidation. Likely viral bronchitis.', physicianUserId: 'DOC001', patientKey: 'pt27', createdAt: daysAgo(1, 12) },
  { id: uid(617), content: 'Carotid Doppler shows 40 percent stenosis on the right. Continue medical management.', physicianUserId: 'DOC003', patientKey: 'pt29', createdAt: daysAgo(2, 13) },
  { id: uid(618), content: 'Peak expiratory flow improving. Continue nebulizations and taper steroids.', physicianUserId: 'DOC004', patientKey: 'pt30', createdAt: daysAgo(5, 11) },
  { id: uid(619), content: 'Wound granulation improving. Continue daily dressing changes.', physicianUserId: 'DOC001', patientKey: 'pt3', createdAt: daysAgo(15, 14) },
  { id: uid(620), content: 'Oxygen requirement weaning. Plan for discharge in 2 days.', physicianUserId: 'DOC001', patientKey: 'pt5', createdAt: daysAgo(30, 9) },
  { id: uid(621), content: 'Neurologic exam stable with mild residual left-sided weakness.', physicianUserId: 'DOC003', patientKey: 'pt8', createdAt: daysAgo(5, 10) },
  { id: uid(622), content: 'Tolerating soft diet. Discharge planning in progress.', physicianUserId: 'DOC002', patientKey: 'pt1', createdAt: daysAgo(48, 11) },
  { id: uid(623), content: 'Discharge medications reviewed with patient and family.', physicianUserId: 'DOC001', patientKey: 'pt15', createdAt: daysAgo(15, 10) },
  { id: uid(624), content: 'Pneumonia resolving. Continue oral antibiotics on discharge.', physicianUserId: 'DOC003', patientKey: 'pt17', createdAt: daysAgo(22, 14) },
  { id: uid(625), content: 'Post-op day 3 cholecystectomy: tolerating regular diet, ambulating.', physicianUserId: 'DOC006', patientKey: 'pt20', createdAt: daysAgo(6, 9) },
  { id: uid(626), content: 'Heart failure symptoms improved. Daily weights stable.', physicianUserId: 'DOC001', patientKey: 'pt21', createdAt: daysAgo(35, 11) },
  { id: uid(627), content: 'Cellulitis erythema improved. Continue IV antibiotics.', physicianUserId: 'DOC004', patientKey: 'pt24', createdAt: daysAgo(15, 13) },
  { id: uid(628), content: 'Post-drainage: significant relief of odynophagia. Tolerating cool liquids.', physicianUserId: 'DOC006', patientKey: 'pt26', createdAt: daysAgo(13, 11) },
  { id: uid(629), content: 'Sepsis resolving. Defervesced within 48 hours of antibiotics.', physicianUserId: 'DOC002', patientKey: 'pt28', createdAt: daysAgo(30, 12) },
  { id: uid(630), content: 'Thyroid function improving. Plan for outpatient endocrinology follow-up.', physicianUserId: 'DOC006', patientKey: 'pt14', createdAt: daysAgo(1, 11), reminderAt: daysFromNow(3, 9) },
  { id: uid(631), content: 'Repeat CBC shows Hgb 9.6 g/dL. Continue iron supplementation.', physicianUserId: 'DOC004', patientKey: 'pt10', createdAt: daysAgo(1, 8) },
  { id: uid(632), content: 'Patient denies chest pain. Ambulating without dyspnea.', physicianUserId: 'DOC006', patientKey: 'pt13', createdAt: daysAgo(0, 9) },
  { id: uid(633), content: 'Blood pressure at goal. Discharge on amlodipine 10 mg daily.', physicianUserId: 'DOC003', patientKey: 'pt7', createdAt: daysAgo(3, 10) },
  { id: uid(634), content: 'Amylase normalizing. Tolerating low-fat diet.', physicianUserId: 'DOC005', patientKey: 'pt19', createdAt: daysAgo(2, 15) },
  { id: uid(635), content: 'Patient ambulating with assistance. Physiotherapy continues.', physicianUserId: 'DOC003', patientKey: 'pt8', createdAt: daysAgo(3, 11) },
  { id: uid(636), content: 'Asthma well-controlled on inhalers. Peak flow at 85 percent personal best.', physicianUserId: 'DOC004', patientKey: 'pt30', createdAt: daysAgo(2, 10) },
  { id: uid(637), content: 'Surgical wound healing well. No signs of infection.', physicianUserId: 'DOC005', patientKey: 'pt25', createdAt: daysAgo(3, 12) },
  { id: uid(638), content: 'Dialysis initiated via temporary catheter. Plan for AV fistula creation.', physicianUserId: 'DOC003', patientKey: 'pt23', createdAt: daysAgo(5, 14) },
  { id: uid(639), content: 'Patient tolerating oral antibiotics. Discharge tomorrow.', physicianUserId: 'DOC002', patientKey: 'pt2', createdAt: daysAgo(0, 8) },
  { id: uid(640), content: 'Dengue with warning signs. Platelet trend improving, no bleeding.', physicianUserId: 'DOC002', patientKey: 'pt22', createdAt: daysAgo(0, 12), reminderAt: daysFromNow(1, 7) },
  { id: uid(641), content: 'Cardiac rehab progressing well. Six-minute walk test improved.', physicianUserId: 'DOC001', patientKey: 'pt15', createdAt: daysAgo(18, 10) },
  { id: uid(642), content: 'Awaiting endoscopy results. Continue PPI therapy.', physicianUserId: 'DOC005', patientKey: 'pt19', createdAt: daysAgo(1, 14) },
  { id: uid(643), content: 'TIA workup negative for arrhythmia on 24-hour Holter.', physicianUserId: 'DOC003', patientKey: 'pt29', createdAt: daysAgo(1, 11) },
  { id: uid(644), content: 'Post-operative day 2 appendectomy: pain controlled with oral analgesics.', physicianUserId: 'DOC002', patientKey: 'pt4', createdAt: daysAgo(0, 10) },
  { id: uid(645), content: 'Patient stable, defervesced. Plan for discharge on oral antibiotics.', physicianUserId: 'DOC004', patientKey: 'pt16', createdAt: daysAgo(0, 14) },
];

// ---------------------------------------------------------------------------
// Summary approval requests (claims)
// ---------------------------------------------------------------------------

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
  { id: uid(701), courseKey: 'c1', physicianUserId: 'DOC002', processorUserId: 'CLM001', requestedAt: daysAgo(28, 14), status: 'CF4_GENERATED' },
  { id: uid(702), courseKey: 'c2', physicianUserId: 'DOC002', processorUserId: 'CLM001', requestedAt: daysAgo(4, 9), status: 'PHYSICIAN_VALIDATION_REQUESTED' },
  { id: uid(703), courseKey: 'c6', physicianUserId: 'DOC001', processorUserId: 'CLM001', requestedAt: daysAgo(45, 10), status: 'PENDING' },
  { id: uid(704), courseKey: 'c7', physicianUserId: 'DOC004', processorUserId: 'CLM002', requestedAt: daysAgo(2, 11), status: 'PHYSICIAN_VALIDATION_REQUESTED' },
  { id: uid(705), courseKey: 'c9', physicianUserId: 'DOC006', processorUserId: 'CLM003', requestedAt: daysAgo(9, 8), status: 'CF4_GENERATED' },
  { id: uid(706), courseKey: 'c10', physicianUserId: 'DOC004', processorUserId: 'CLM002', requestedAt: daysAgo(3, 14), status: 'CF4_GENERATED' },
  { id: uid(707), courseKey: 'c11', physicianUserId: 'DOC002', processorUserId: 'CLM004', requestedAt: daysAgo(13, 10), status: 'CF4_GENERATED' },
  { id: uid(708), courseKey: 'c12', physicianUserId: 'DOC001', processorUserId: 'CLM001', requestedAt: daysAgo(20, 9), status: 'CF4_GENERATED' },
  { id: uid(709), courseKey: 'c14', physicianUserId: 'DOC003', processorUserId: 'CLM003', requestedAt: daysAgo(32, 15), status: 'CF4_GENERATED' },
  { id: uid(710), courseKey: 'c16', physicianUserId: 'DOC005', processorUserId: 'CLM004', requestedAt: daysAgo(9, 11), status: 'CF4_GENERATED' },
  { id: uid(711), courseKey: 'c17', physicianUserId: 'DOC001', processorUserId: 'CLM001', requestedAt: daysAgo(3, 16), status: 'PHYSICIAN_VALIDATION_REQUESTED' },
  { id: uid(712), courseKey: 'c18', physicianUserId: 'DOC005', processorUserId: 'CLM002', requestedAt: daysAgo(21, 10), status: 'PHYSICIAN_VALIDATION_REQUESTED' },
  { id: uid(713), courseKey: 'c3', physicianUserId: 'DOC001', processorUserId: 'CLM001', requestedAt: daysAgo(0, 9), status: 'PENDING' },
  { id: uid(714), courseKey: 'c4', physicianUserId: 'DOC002', processorUserId: 'CLM003', requestedAt: daysAgo(0, 10), status: 'PENDING' },
  { id: uid(715), courseKey: 'c5', physicianUserId: 'DOC002', processorUserId: 'CLM004', requestedAt: daysAgo(0, 8), status: 'PENDING' },
  { id: uid(716), courseKey: 'c8', physicianUserId: 'DOC003', processorUserId: 'CLM001', requestedAt: daysAgo(0, 11), status: 'PENDING' },
  { id: uid(717), courseKey: 'c13', physicianUserId: 'DOC006', processorUserId: 'CLM002', requestedAt: daysAgo(1, 9), status: 'PENDING' },
  { id: uid(718), courseKey: 'c15', physicianUserId: 'DOC004', processorUserId: 'CLM003', requestedAt: daysAgo(0, 12), status: 'PENDING' },
  { id: uid(719), courseKey: 'c19', physicianUserId: 'DOC004', processorUserId: 'CLM004', requestedAt: daysAgo(0, 13), status: 'PENDING' },
  { id: uid(720), courseKey: 'c20', physicianUserId: 'DOC006', processorUserId: 'CLM001', requestedAt: daysAgo(1, 10), status: 'PENDING' },
];

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export interface SeedAuditLog {
  id: string;
  action: ActionType;
  userId: string;
  timeStamp: Date;
}

export const auditLogs: SeedAuditLog[] = [];

// ---------------------------------------------------------------------------
// Password reset requests
// ---------------------------------------------------------------------------

export interface SeedPasswordReset {
  id: string;
  userLoginId: string;
  ipAddress?: string;
  token: string;
  temporaryPassword?: string;
  requestedAt: Date;
  expiresAt: Date;
  resolvedAt?: Date;
  status: ResetStatus;
}

export const passwordResets: SeedPasswordReset[] = [
  { id: uid(801), userLoginId: 'DOC001', token: 'reset-token-0001', requestedAt: daysAgo(30, 8), expiresAt: daysAgo(29, 8), resolvedAt: daysAgo(29, 9), status: ResetStatus.APPROVED, ipAddress: '192.168.1.10' },
  { id: uid(802), userLoginId: 'NRS001', token: 'reset-token-0002', requestedAt: daysAgo(25, 14), expiresAt: daysAgo(24, 14), resolvedAt: daysAgo(24, 15), status: ResetStatus.APPROVED, ipAddress: '192.168.1.20' },
  { id: uid(803), userLoginId: 'DOC002', token: 'reset-token-0003', requestedAt: daysAgo(20, 9), expiresAt: daysAgo(19, 9), status: ResetStatus.EXPIRED, ipAddress: '192.168.1.11' },
  { id: uid(804), userLoginId: 'CLM001', token: 'reset-token-0004', requestedAt: daysAgo(18, 11), expiresAt: daysAgo(17, 11), resolvedAt: daysAgo(17, 11), status: ResetStatus.REJECTED, ipAddress: '10.0.0.5', temporaryPassword: 'WrongUserProvided' },
  { id: uid(805), userLoginId: 'NRS002', token: 'reset-token-0005', requestedAt: daysAgo(15, 7), expiresAt: daysAgo(14, 7), resolvedAt: daysAgo(14, 8), status: ResetStatus.APPROVED, ipAddress: '192.168.1.22' },
  { id: uid(806), userLoginId: 'ADM001', token: 'reset-token-0006', requestedAt: daysAgo(12, 16), expiresAt: daysAgo(11, 16), resolvedAt: daysAgo(11, 17), status: ResetStatus.APPROVED, ipAddress: '192.168.1.5' },
  { id: uid(807), userLoginId: 'DOC003', token: 'reset-token-0007', requestedAt: daysAgo(10, 10), expiresAt: daysAgo(9, 10), status: ResetStatus.EXPIRED, ipAddress: '192.168.1.12' },
  { id: uid(808), userLoginId: 'NRS003', token: 'reset-token-0008', requestedAt: daysAgo(9, 13), expiresAt: daysAgo(8, 13), resolvedAt: daysAgo(8, 14), status: ResetStatus.APPROVED, ipAddress: '192.168.1.23' },
  { id: uid(809), userLoginId: 'CLM002', token: 'reset-token-0009', requestedAt: daysAgo(7, 8), expiresAt: daysAgo(6, 8), resolvedAt: daysAgo(6, 9), status: ResetStatus.APPROVED, ipAddress: '10.0.0.6' },
  { id: uid(810), userLoginId: 'DOC004', token: 'reset-token-0010', requestedAt: daysAgo(6, 15), expiresAt: daysAgo(5, 15), status: ResetStatus.PENDING, ipAddress: '192.168.1.13' },
  { id: uid(811), userLoginId: 'NRS004', token: 'reset-token-0011', requestedAt: daysAgo(4, 9), expiresAt: daysAgo(3, 9), resolvedAt: daysAgo(3, 10), status: ResetStatus.APPROVED, ipAddress: '192.168.1.24' },
  { id: uid(812), userLoginId: 'ADM002', token: 'reset-token-0012', requestedAt: daysAgo(3, 14), expiresAt: daysAgo(2, 14), status: ResetStatus.PENDING, ipAddress: '192.168.1.6' },
  { id: uid(813), userLoginId: 'CLM003', token: 'reset-token-0013', requestedAt: daysAgo(2, 11), expiresAt: daysAgo(1, 11), resolvedAt: daysAgo(1, 12), status: ResetStatus.APPROVED, ipAddress: '10.0.0.7' },
  { id: uid(814), userLoginId: 'DOC005', token: 'reset-token-0014', requestedAt: daysAgo(1, 10), expiresAt: daysFromNow(1, 10), status: ResetStatus.PENDING, ipAddress: '192.168.1.14' },
];