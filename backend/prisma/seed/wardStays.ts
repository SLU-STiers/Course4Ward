import {
  CommunicationChannel,
  OrderEnteredBy,
  OrderStatus,
  OrderType,
  PatientClass,
  Sex,
} from '@prisma/client';
import {
  daysAgo,
  patientDetailsFor,
  SeedAdmission,
  SeedOrder,
  SeedPatient,
  SeedPatientDetails,
  SeedTriage,
  uid,
} from './data';

/**
 * Multi-day ward stays written in the shorthand of the real order sheets
 * (fine_tuning_data/1000 DOCTORS ORDERS.xlsx), kept to a line or two each.
 * One inner array per hospital day; the last day of a current stay is today.
 * Past days are carried out by the nurse (FINISHED), so they are ready for
 * Course in the Ward summarization; today's orders are a mix of statuses.
 */
interface Stay {
  key: string;
  patient: [firstName: string, lastName: string, gender: Sex, dateOfBirth: Date];
  doc: string;
  consultants?: string[];
  nurses: string[];
  room?: string;
  /** Discharged this many days ago (the last day's orders end with the discharge). */
  dischargedDaysAgo?: number;
  assessment: string;
  triage: SeedTriage;
  days: string[][];
}

const tri = (
  level: number,
  heartRate: number,
  respRate: number,
  spo2: number,
  bp: [number, number],
  temp: number,
  pain: number,
  complaints: string[],
): SeedTriage => ({ level, time: '08:45', heartRate, respRate, spo2, bp, temp, pain, complaints });

const STAYS: Stay[] = [
  {
    key: 'ws1', patient: ['Teodoro', 'Ilagan', Sex.MALE, new Date(1959, 3, 2)], doc: 'DOC001', consultants: ['DOC004'],
    nurses: ['NRS001'], room: '205',
    assessment: 'Community-acquired pneumonia, high risk. Hypoxemic at room air.',
    triage: tri(2, 116, 28, 88, [100, 60], 38.9, 4, ['Cough', 'Fever', 'Shortness of breath']),
    days: [
      ['Admit to MICU under IM service. Secure consent.', 'IVF: PNSS 1 L x 100 cc/hr. O2 via face mask at 8 LPM, keep SpO2 > 94%.', 'CBC, Na, K, Crea, ABG, blood CS x 2 sites, sputum GS/CS. CXR PA-L.', 'Start Piperacillin-Tazobactam 4.5 g IV q6h and Azithromycin 500 mg IV OD.', 'Paracetamol 1 g IV q6h PRN T ≥ 38.5.'],
      ['Repeat ABG at 6 AM.', 'Nebulize Salbutamol + Ipratropium 1 neb q6h.', 'Shift O2 to nasal cannula at 4 LPM if SpO2 > 95%.', 'Refer to IM-Pulmo for co-management.'],
      ['Follow up blood CS result.', 'Repeat CBC tomorrow AM.', 'Soft diet as tolerated. Encourage deep breathing exercises.'],
      ['O2 at 2 LPM via NC. Wean as tolerated.', 'Shift Azithromycin to 500 mg tab OD.', 'Ambulate with assistance.'],
      ['Discontinue O2 if SpO2 ≥ 95% at room air.', 'Repeat CXR PA tomorrow.', 'Regular diet.'],
      ['Shift Piperacillin-Tazobactam to Amoxicillin-Clavulanate 625 mg tab q8h.', 'Monitor VS q4h.', 'For possible discharge tomorrow if afebrile.'],
    ],
  },
  {
    key: 'ws2', patient: ['Merlinda', 'Soriano', Sex.FEMALE, new Date(1971, 7, 19)], doc: 'DOC004',
    nurses: ['NRS004', 'NRS001'],
    assessment: 'Diabetic ketoacidosis, moderate. Known T2DM, poor compliance.',
    triage: tri(2, 118, 26, 97, [98, 62], 37.4, 5, ['Nausea / vomiting', 'Abdominal pain (tummy ache)', 'Body weakness / fatigue']),
    days: [
      ['Admit to Medical ward. NPO except meds.', 'IVF: PNSS 1 L fast drip, then 500 cc/hr x 4 hrs.', 'CBG q1h, ABG, serum ketones, Na, K, Crea, BUN, Mg, urinalysis.', 'Insulin regular drip at 0.1 u/kg/hr. Refer for titration.'],
      ['Add KCl 20 mEq to each liter of IVF while K < 5.0.', 'Repeat Na, K, ABG at 4 PM.', 'Shift IVF to D5 0.45 NaCl at 150 cc/hr once CBG < 250.'],
      ['Start diabetic diet 1800 kcal.', 'Shift to insulin glargine 14 u SC at HS and regular insulin 4 u SC pre-meals.', 'CBG pre-meals and HS.', 'Discontinue insulin drip 2 hrs after first SC dose.'],
      ['HbA1c, lipid profile.', 'Diabetes education with dietitian.', 'Hep-lock IV line.'],
      ['Increase glargine to 16 u SC at HS.', 'Continue CBG monitoring pre-meals and HS.', 'Metformin 500 mg tab BID with meals.'],
    ],
  },
  {
    key: 'ws3', patient: ['Rogelio', 'Baltazar', Sex.MALE, new Date(1954, 10, 23)], doc: 'DOC005', consultants: ['DOC006'],
    nurses: ['NRS004', 'NRS001'],
    assessment: 'Upper GI bleeding, probably peptic ulcer disease. Melena x 2 days.',
    triage: tri(2, 112, 22, 97, [92, 58], 36.8, 4, ['Abdominal pain (tummy ache)', 'Dizziness', 'Body weakness / fatigue']),
    days: [
      ['Admit to Medical ward. NPO.', 'Insert 2 large-bore IV lines. IVF: PLR 1 L fast drip then 120 cc/hr.', 'CBC, PT/PTT, type and crossmatch 2 u PRBC, BUN, Crea.', 'Omeprazole 80 mg IV bolus then 8 mg/hr drip.'],
      ['Transfuse 1 u PRBC over 4 hrs. Premedicate with Diphenhydramine 25 mg IV.', 'Repeat Hgb 6 hrs post-transfusion.', 'Refer to GI for EGD.'],
      ['For EGD today. NPO since midnight.', 'Post-EGD: clear liquids after 4 hrs if no rebleeding.', 'H. pylori rapid urease test from biopsy.'],
      ['Shift Omeprazole drip to 40 mg IV q12h.', 'Full liquid diet.', 'Repeat CBC tomorrow AM.'],
      ['Soft diet.', 'Shift Omeprazole to 40 mg cap BID.', 'Start Clarithromycin 500 mg + Amoxicillin 1 g BID x 14 days (H. pylori positive).'],
    ],
  },
  {
    key: 'ws4', patient: ['Analyn', 'Pacis', Sex.FEMALE, new Date(1994, 1, 11)], doc: 'DOC002',
    nurses: ['NRS005'], room: '104',
    assessment: 'G2P1 at 38 weeks, preeclampsia with severe features. For cesarean delivery.',
    triage: tri(2, 96, 20, 98, [164, 108], 36.9, 6, ['Headache', 'Abdominal pain (tummy ache)']),
    days: [
      ['Admit to OB ward. NPO for CS.', 'Magnesium sulfate 4 g IV loading then 1 g/hr drip. Monitor DTRs, RR, urine output q1h.', 'CBC, platelet, AST, ALT, LDH, Crea, urine protein.', 'Hydralazine 5 mg IV PRN BP ≥ 160/110.', 'Prep for low transverse CS. Cefazolin 2 g IV 30 min before incision.'],
      ['Post-op: continue MgSO4 drip x 24 hrs post-delivery.', 'Ketorolac 30 mg IV q8h x 3 doses, then Paracetamol 500 mg tab q6h.', 'Remove IFC after 24 hrs.'],
      ['Discontinue MgSO4.', 'Start Nifedipine 30 mg ER tab OD. BP q4h.', 'Soft diet. Early ambulation.', 'Breastfeeding support.'],
      ['Repeat CBC, AST, ALT.', 'Wound care: dry dressing.', 'BP log for possible discharge tomorrow.'],
    ],
  },
  {
    key: 'ws5', patient: ['Bernardo', 'Calimlim', Sex.MALE, new Date(1949, 5, 14)], doc: 'DOC006', consultants: ['DOC004'],
    nurses: ['NRS004'],
    assessment: 'Heart failure with reduced EF, acute decompensation. Bipedal edema, orthopnea.',
    triage: tri(2, 108, 26, 90, [158, 96], 36.6, 3, ['Shortness of breath', 'Body weakness / fatigue']),
    days: [
      ['Admit to Medical ward. Moderate high back rest.', 'O2 via NC at 3 LPM. Strict I/O. Daily weight.', 'Furosemide 40 mg IV q8h.', '12-L ECG, CXR PA, Troponin I, NT-proBNP, Na, K, Crea.', 'Low salt diet, fluid restriction 1 L/day.'],
      ['Continue Furosemide 40 mg IV q8h. Record urine output q4h.', 'Repeat K and Crea tomorrow.', '2D echo with doppler.'],
      ['Start Losartan 25 mg tab OD.', 'Spironolactone 25 mg tab OD.', 'KCl 750 mg tab BID x 3 days.'],
      ['Shift Furosemide to 40 mg IV q12h.', 'Start Carvedilol 3.125 mg tab BID.', 'Wean O2 to keep SpO2 > 94%.'],
      ['Shift Furosemide to 40 mg tab OD.', 'Repeat Na, K, Crea.', 'Ambulate within room.'],
      ['Discontinue O2.', 'Cardiac rehab referral.', 'Repeat daily weight and I/O.'],
    ],
  },
  {
    key: 'ws6', patient: ['Shirley', 'Dumalo', Sex.FEMALE, new Date(1980, 8, 3)], doc: 'DOC005',
    nurses: ['NRS002'], room: '208',
    assessment: 'Acute calculous cholecystitis. For laparoscopic cholecystectomy.',
    triage: tri(3, 102, 20, 98, [128, 82], 38.2, 8, ['Abdominal pain (tummy ache)', 'Fever', 'Nausea / vomiting']),
    days: [
      ['Admit to Surgery ward. NPO.', 'IVF: D5LR 1 L x 100 cc/hr.', 'CBC, ALT, AST, ALP, total and direct bili, amylase, lipase. HBT ultrasound.', 'Ceftriaxone 2 g IV OD and Metronidazole 500 mg IV q8h.', 'Ketorolac 30 mg IV q8h PRN pain.'],
      ['Schedule lap chole tomorrow. Secure consent.', 'Anesthesia clearance.', 'NPO post-midnight.'],
      ['Post-op: clear liquids after 6 hrs if no nausea.', 'Tramadol 50 mg IV q8h PRN pain.', 'Ambulate as tolerated.'],
      ['Soft diet.', 'Shift to Cefuroxime 500 mg tab BID x 5 days.', 'Remove IV line once tolerating diet.'],
      ['Wound check, dry dressing.', 'Paracetamol 500 mg tab q6h PRN pain.', 'May go home tomorrow AM.'],
    ],
  },
  {
    key: 'ws7', patient: ['Ernesto', 'Galvez', Sex.MALE, new Date(1966, 0, 27)], doc: 'DOC003',
    nurses: ['NRS001', 'NRS004'],
    assessment: 'Acute ischemic stroke, right MCA. Left-sided weakness, outside thrombolysis window.',
    triage: tri(2, 88, 18, 97, [186, 104], 36.7, 0, ['Body weakness / fatigue', 'Dizziness']),
    days: [
      ['Admit to Medical ward. Neuro vital signs q2h.', 'Cranial CT plain STAT.', 'Allow permissive HTN up to 220/120. Do not lower BP unless above.', 'NPO pending swallow screen. IVF: PNSS 1 L x 80 cc/hr.', 'CBC, FBS, lipid profile, HbA1c, Crea, PT/PTT.'],
      ['Aspirin 160 mg via NGT OD.', 'Atorvastatin 80 mg tab HS.', 'Swallow screen by speech therapy.'],
      ['Start dysphagia diet if swallow screen passed.', 'PT/OT referral. Turn to sides q2h.', 'Carotid doppler.'],
      ['Start Amlodipine 5 mg tab OD. Target BP < 160/100.', 'Clopidogrel 75 mg tab OD for 21 days.', 'Aspiration precautions.'],
      ['Repeat CBC, Na, K.', 'Continue PT, sit up in chair BID.', 'Compression stockings.'],
      ['2D echo.', 'Shift to soft diet.', 'Family teaching on home care.'],
    ],
  },
  {
    key: 'ws8', patient: ['Jocelyn', 'Tabora', Sex.FEMALE, new Date(1987, 4, 30)], doc: 'DOC002',
    nurses: ['NRS004'],
    assessment: 'Dengue fever with warning signs, critical phase. Platelet 62.',
    triage: tri(3, 104, 20, 98, [98, 64], 38.4, 5, ['Fever', 'Headache', 'Abdominal pain (tummy ache)']),
    days: [
      ['Admit to Medical ward. Bleeding precautions.', 'IVF: PNSS 1 L x 120 cc/hr.', 'CBC with platelet q12h. Dengue NS1, IgM/IgG.', 'Paracetamol 500 mg tab q4h PRN T ≥ 38. No NSAIDs.'],
      ['Decrease IVF to 80 cc/hr.', 'Strict I/O. Monitor for warning signs q4h.', 'Repeat Hct and platelet at 6 PM.'],
      ['Platelet 41. Continue CBC q12h.', 'Soft diet, encourage oral fluids.', 'Hold IM injections.'],
      ['Platelet 78. CBC OD.', 'Decrease IVF to KVO.'],
    ],
  },
  {
    key: 'ws9', patient: ['Wilfredo', 'Sison', Sex.MALE, new Date(1973, 9, 8)], doc: 'DOC003', consultants: ['DOC002'],
    nurses: ['NRS001'],
    assessment: 'Acute kidney injury on CKD stage 3b with hyperkalemia (K 6.4).',
    triage: tri(2, 58, 18, 97, [166, 98], 36.6, 2, ['Body weakness / fatigue', 'Nausea / vomiting', 'Loss of appetite']),
    days: [
      ['Admit to Medical ward. Cardiac monitor.', 'Calcium gluconate 10% 1 amp SIVP now.', 'Insulin regular 10 u + D50W 50 cc SIVP now.', 'Repeat K after 2 hrs. 12-L ECG.', 'Low K, low salt renal diet.'],
      ['Sodium polystyrene sulfonate 15 g PO TID.', 'Strict I/O. Insert IFC.', 'KUB ultrasound. Na, K, Crea, BUN, Ca, Phos.'],
      ['Repeat K, Crea.', 'Furosemide 40 mg IV q12h.', 'Refer to Nephro for possible HD.'],
      ['Discontinue sodium polystyrene sulfonate.', 'Shift Furosemide to 40 mg tab OD.', 'Remove IFC.'],
      ['Repeat Crea, K tomorrow AM.', 'Amlodipine 10 mg tab OD.', 'Renal diet teaching.'],
    ],
  },
  {
    key: 'ws10', patient: ['Cecilia', 'Bumanglag', Sex.FEMALE, new Date(1962, 11, 15)], doc: 'DOC005',
    nurses: ['NRS002'], room: '210',
    assessment: 'Open fracture, left tibia (Gustilo II) from fall. For debridement and ORIF.',
    triage: tri(2, 106, 20, 98, [140, 86], 37.0, 9, ['Wound / injury', 'Joint pain']),
    days: [
      ['Admit to Surgery ward. NPO.', 'Cefazolin 2 g IV q8h and Gentamicin 240 mg IV OD.', 'Tetanus toxoid 0.5 ml IM. ATS skin test.', 'X-ray left leg AP-L. CBC, PT/PTT, Crea.', 'Tramadol 50 mg IV q6h PRN pain. Elevate left leg.'],
      ['For I&D and ORIF today. NPO since midnight.', 'Post-op: neurovascular checks of left foot q2h.', 'Diet as tolerated after 6 hrs.'],
      ['Continue IV antibiotics.', 'Celecoxib 200 mg cap BID with food.', 'Post-op x-ray left leg.'],
      ['Enoxaparin 40 mg SC OD.', 'PT referral: non-weight bearing on left leg with walker.', 'Wound dressing change.'],
      ['Shift to Cefuroxime 500 mg tab BID.', 'Repeat CBC.', 'Wound check for discharge planning.'],
    ],
  },

  // Discharged
  {
    key: 'ws11', patient: ['Danilo', 'Aban', Sex.MALE, new Date(1977, 6, 6)], doc: 'DOC001',
    nurses: ['NRS004'], dischargedDaysAgo: 3,
    assessment: 'Acute gastroenteritis with moderate dehydration.',
    triage: tri(3, 112, 20, 98, [96, 60], 37.9, 5, ['Diarrhea', 'Nausea / vomiting', 'Abdominal pain (tummy ache)']),
    days: [
      ['Admit to Medical ward.', 'IVF: PLR 1 L fast drip then 120 cc/hr.', 'CBC, Na, K, Crea. Fecalysis.', 'Metoclopramide 10 mg IV q8h PRN vomiting.'],
      ['Oral rehydration solution 200 ml after each loose stool.', 'Zinc sulfate 20 mg tab OD.', 'Repeat Na, K.'],
      ['Soft diet. Decrease IVF to 80 cc/hr.', 'Hep-lock if tolerating oral fluids.'],
      ['May go home. Discharge meds: ORS, Zinc x 10 days.', 'Follow up at OPD after 1 week.'],
    ],
  },
  {
    key: 'ws12', patient: ['Felicidad', 'Tolentino', Sex.FEMALE, new Date(1952, 2, 21)], doc: 'DOC002', consultants: ['DOC005'],
    nurses: ['NRS004', 'NRS001'], dischargedDaysAgo: 1,
    assessment: 'Urosepsis from complicated UTI. Known T2DM.',
    triage: tri(2, 118, 24, 95, [90, 56], 39.1, 4, ['Fever', 'Painful urination', 'Body weakness / fatigue']),
    days: [
      ['Admit to Medical ward.', 'IVF: PNSS 1 L fast drip, then 120 cc/hr.', 'Urinalysis, urine CS, blood CS x 2. CBC, Crea, procalcitonin, lactate.', 'Meropenem 1 g IV q8h.'],
      ['CBG pre-meals and HS. Insulin regular sliding scale.', 'Paracetamol 500 mg tab q4h PRN T ≥ 38.', 'KUB ultrasound.'],
      ['Urine CS: E. coli ESBL. Continue Meropenem.', 'Diabetic diet 1600 kcal.'],
      ['Afebrile x 24 hrs. Repeat CBC.', 'Ambulate as tolerated.'],
      ['Shift to Ertapenem 1 g IV OD via OPD infusion x 5 days.', 'May go home. Follow up with IM after 1 week.'],
    ],
  },
];

const ORDER_HOURS = [9, 12, 15, 18, 21];

const stayStart = (s: Stay) => s.days.length - 1 + (s.dischargedDaysAgo ?? 0);

export const stayPatients: SeedPatient[] = STAYS.map((s, i) => {
  const [firstName, lastName, gender, dateOfBirth] = s.patient;
  return { id: uid(1101 + i), key: `${s.key}p`, firstName, lastName, gender, dateOfBirth };
});

export const stayPatientDetails: Record<string, SeedPatientDetails> = Object.fromEntries(
  stayPatients.map((p, i) => [p.key, patientDetailsFor(p, 30 + i)]),
);

export const stayAdmissions: SeedAdmission[] = STAYS.map((s, i) => ({
  id: uid(1201 + i),
  key: s.key,
  patientKey: `${s.key}p`,
  physicianUserId: s.doc,
  admissionDate: daysAgo(stayStart(s), 8, 30),
  dischargeDate: s.dischargedDaysAgo !== undefined ? daysAgo(s.dischargedDaysAgo, 16) : undefined,
  patientClass: PatientClass.INPATIENT,
  initialAssessment: s.assessment,
}));

export const stayTriages: Record<string, SeedTriage> = Object.fromEntries(STAYS.map((s) => [s.key, s.triage]));

export const stayConsultants: Record<string, string[]> = Object.fromEntries(
  STAYS.filter((s) => s.consultants).map((s) => [s.key, s.consultants!]),
);

export const stayRooms: Record<string, string> = Object.fromEntries(
  STAYS.filter((s) => s.room).map((s) => [s.key, s.room!]),
);

let seq = 3001;
export const stayOrders: SeedOrder[] = STAYS.flatMap((s) =>
  s.days.flatMap((day, d) => {
    const ago = stayStart(s) - d;
    const isToday = ago === 0;
    const lastDay = d === s.days.length - 1;
    return day.map((content, n): SeedOrder => {
      const k = seq;
      seq += 1;
      const created = isToday ? daysAgo(0, 6, 10 * n) : daysAgo(ago, ORDER_HOURS[n % ORDER_HOURS.length], 5 * (k % 9));
      // Past days are done by the nurse; a few long-running orders stay ONGOING. Today is a mix.
      const status = isToday
        ? [OrderStatus.FINISHED, OrderStatus.ONGOING, OrderStatus.TO_ACCOMPLISH][n % 3]
        : !s.dischargedDaysAgo && k % 9 === 0
          ? OrderStatus.ONGOING
          : OrderStatus.FINISHED;
      const nurse = s.nurses[(d + n) % s.nurses.length];
      const onBehalf = k % 4 === 0;
      const type =
        d === 0 && n === 0 ? OrderType.ADMISSION : s.dischargedDaysAgo && lastDay && n === 0 ? OrderType.DISCHARGE : undefined;
      return {
        id: uid(k),
        orderContent: content,
        dateCreated: created,
        admissionKey: s.key,
        orderedByUserId: s.doc,
        encodedByUserId: onBehalf ? nurse : s.doc,
        enteredByRole: onBehalf ? OrderEnteredBy.NURSE_ON_BEHALF : OrderEnteredBy.PHYSICIAN,
        communicationChannel: onBehalf ? (k % 8 === 0 ? CommunicationChannel.CALL : CommunicationChannel.VERBAL) : undefined,
        type,
        status,
        executedByUserId: status === OrderStatus.TO_ACCOMPLISH ? undefined : nurse,
        executedAt: status === OrderStatus.TO_ACCOMPLISH ? undefined : new Date(created.getTime() + 50 * 60_000),
        nurseComment: status === OrderStatus.FINISHED && k % 7 === 0 ? 'Done, endorsed to next shift.' : undefined,
      };
    });
  }),
);
