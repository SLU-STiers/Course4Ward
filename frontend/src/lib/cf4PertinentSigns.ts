/**
 * PhilHealth CF4 Part III item 3 — Pertinent Signs and Symptoms on Admission.
 * Labels match Claim Form 4 (February 2020). Used by Add Patient checkboxes
 * and by the CF4 PDF so the same ticks print on the form.
 */

export const CF4_PERTINENT_SIGNS = [
  'Altered mental sensorium',
  'Abdominal cramp/pain',
  'Anorexia',
  'Bleeding gums',
  'Body weakness',
  'Blurring of vision',
  'Chest pain/discomfort',
  'Constipation',
  'Cough',
  'Diarrhea',
  'Dizziness',
  'Dysphagia',
  'Dyspnea',
  'Dysuria',
  'Epistaxis',
  'Fever',
  'Frequency of urination',
  'Headache',
  'Hematemesis',
  'Hematuria',
  'Hemoptysis',
  'Irritability',
  'Jaundice',
  'Lower extremity edema',
  'Myalgia',
  'Orthopnea',
  'Pain (site)',
  'Palpitations',
  'Seizures',
  'Skin rashes',
  'Stool, bloody/black tarry/mucoid',
  'Sweating',
  'Urgency',
  'Vomiting',
  'Weight loss',
] as const;

export type Cf4PertinentSign = (typeof CF4_PERTINENT_SIGNS)[number];

/** Older Add Patient labels → CF4 form labels (for stays registered before the rename). */
const LEGACY_CHIEF_COMPLAINT_TO_CF4: Record<string, Cf4PertinentSign | 'Others'> = {
  'Abdominal pain (tummy ache)': 'Abdominal cramp/pain',
  'Allergic reaction': 'Others',
  'Back pain': 'Pain (site)',
  'Body weakness / fatigue': 'Body weakness',
  'Chest pain': 'Chest pain/discomfort',
  'Colds / runny nose': 'Others',
  Cough: 'Cough',
  Diarrhea: 'Diarrhea',
  Dizziness: 'Dizziness',
  'Ear pain': 'Pain (site)',
  'Eye pain / redness': 'Others',
  Fever: 'Fever',
  Headache: 'Headache',
  'Joint pain': 'Myalgia',
  'Loss of appetite': 'Anorexia',
  'Nausea / vomiting': 'Vomiting',
  'Painful urination': 'Dysuria',
  'Shortness of breath': 'Dyspnea',
  'Skin rash / itching': 'Skin rashes',
  'Sore throat': 'Others',
  Toothache: 'Pain (site)',
  'Wound / injury': 'Others',
};

/**
 * Free-text HPI phrases → CF4 ticks. Longer phrases are matched first so
 * "coffee-ground" wins over a bare "ground", etc.
 */
const ASSESSMENT_PHRASE_TO_CF4 = ([
  { phrase: 'altered mental sensorium', sign: 'Altered mental sensorium' },
  { phrase: 'coffee-ground', sign: 'Hematemesis' },
  { phrase: 'coffee ground', sign: 'Hematemesis' },
  { phrase: 'hematemesis', sign: 'Hematemesis' },
  { phrase: 'black stool', sign: 'Stool, bloody/black tarry/mucoid' },
  { phrase: 'black stools', sign: 'Stool, bloody/black tarry/mucoid' },
  { phrase: 'tarry stool', sign: 'Stool, bloody/black tarry/mucoid' },
  { phrase: 'bloody stool', sign: 'Stool, bloody/black tarry/mucoid' },
  { phrase: 'melena', sign: 'Stool, bloody/black tarry/mucoid' },
  { phrase: 'shortness of breath', sign: 'Dyspnea' },
  { phrase: 'difficulty breathing', sign: 'Dyspnea' },
  { phrase: 'difficulty of breathing', sign: 'Dyspnea' },
  { phrase: 'dyspnea', sign: 'Dyspnea' },
  { phrase: 'orthopnea', sign: 'Orthopnea' },
  { phrase: 'chest pain', sign: 'Chest pain/discomfort' },
  { phrase: 'chest discomfort', sign: 'Chest pain/discomfort' },
  { phrase: 'abdominal pain', sign: 'Abdominal cramp/pain' },
  { phrase: 'abdominal cramp', sign: 'Abdominal cramp/pain' },
  { phrase: 'tummy ache', sign: 'Abdominal cramp/pain' },
  { phrase: 'body weakness', sign: 'Body weakness' },
  { phrase: 'general weakness', sign: 'Body weakness' },
  { phrase: 'blurring of vision', sign: 'Blurring of vision' },
  { phrase: 'blurred vision', sign: 'Blurring of vision' },
  { phrase: 'bleeding gums', sign: 'Bleeding gums' },
  { phrase: 'gum bleeding', sign: 'Bleeding gums' },
  { phrase: 'loss of appetite', sign: 'Anorexia' },
  { phrase: 'poor feeding', sign: 'Anorexia' },
  { phrase: 'poor appetite', sign: 'Anorexia' },
  { phrase: 'anorexia', sign: 'Anorexia' },
  { phrase: 'painful urination', sign: 'Dysuria' },
  { phrase: 'dysuria', sign: 'Dysuria' },
  { phrase: 'frequency of urination', sign: 'Frequency of urination' },
  { phrase: 'frequent urination', sign: 'Frequency of urination' },
  { phrase: 'lower extremity edema', sign: 'Lower extremity edema' },
  { phrase: 'leg edema', sign: 'Lower extremity edema' },
  { phrase: 'pedal edema', sign: 'Lower extremity edema' },
  { phrase: 'skin rash', sign: 'Skin rashes' },
  { phrase: 'skin rashes', sign: 'Skin rashes' },
  { phrase: 'weight loss', sign: 'Weight loss' },
  { phrase: 'joint pain', sign: 'Myalgia' },
  { phrase: 'myalgia', sign: 'Myalgia' },
  { phrase: 'palpitations', sign: 'Palpitations' },
  { phrase: 'palpitation', sign: 'Palpitations' },
  { phrase: 'dizziness', sign: 'Dizziness' },
  { phrase: 'dizzy', sign: 'Dizziness' },
  { phrase: 'vomiting', sign: 'Vomiting' },
  { phrase: 'vomited', sign: 'Vomiting' },
  { phrase: 'nausea', sign: 'Vomiting' },
  { phrase: 'diarrhea', sign: 'Diarrhea' },
  { phrase: 'constipation', sign: 'Constipation' },
  { phrase: 'dysphagia', sign: 'Dysphagia' },
  { phrase: 'difficulty swallowing', sign: 'Dysphagia' },
  { phrase: 'epistaxis', sign: 'Epistaxis' },
  { phrase: 'nosebleed', sign: 'Epistaxis' },
  { phrase: 'nose bleed', sign: 'Epistaxis' },
  { phrase: 'hematuria', sign: 'Hematuria' },
  { phrase: 'bloody urine', sign: 'Hematuria' },
  { phrase: 'hemoptysis', sign: 'Hemoptysis' },
  { phrase: 'coughing blood', sign: 'Hemoptysis' },
  { phrase: 'irritability', sign: 'Irritability' },
  { phrase: 'irritable', sign: 'Irritability' },
  { phrase: 'jaundice', sign: 'Jaundice' },
  { phrase: 'yellowish skin', sign: 'Jaundice' },
  { phrase: 'icteric', sign: 'Jaundice' },
  { phrase: 'seizure', sign: 'Seizures' },
  { phrase: 'seizures', sign: 'Seizures' },
  { phrase: 'convulsion', sign: 'Seizures' },
  { phrase: 'sweating', sign: 'Sweating' },
  { phrase: 'diaphoresis', sign: 'Sweating' },
  { phrase: 'urgency', sign: 'Urgency' },
  { phrase: 'confusion', sign: 'Altered mental sensorium' },
  { phrase: 'confused', sign: 'Altered mental sensorium' },
  { phrase: 'disoriented', sign: 'Altered mental sensorium' },
  { phrase: 'fever', sign: 'Fever' },
  { phrase: 'febrile', sign: 'Fever' },
  { phrase: 'headache', sign: 'Headache' },
  { phrase: 'cough', sign: 'Cough' },
  { phrase: 'wheezing', sign: 'Dyspnea' },
  { phrase: 'pain', sign: 'Pain (site)' },
] satisfies Array<{ phrase: string; sign: Cf4PertinentSign }> as Array<{
  phrase: string;
  sign: Cf4PertinentSign;
}>).sort((a, b) => b.phrase.length - a.phrase.length);

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const CF4_BY_NORMALIZED = new Map(
  CF4_PERTINENT_SIGNS.map((sign) => [normalizeToken(sign), sign] as const),
);

const KNOWN_LABELS_LONGEST_FIRST = [
  ...CF4_PERTINENT_SIGNS,
  ...Object.keys(LEGACY_CHIEF_COMPLAINT_TO_CF4),
].sort((a, b) => b.length - a.length);

/** Maps a free-text complaint label onto a CF4 tick box or Others. */
export function toCf4PertinentSign(label: string): Cf4PertinentSign | 'Others' {
  const trimmed = label.trim();
  if (!trimmed) return 'Others';
  const direct = CF4_BY_NORMALIZED.get(normalizeToken(trimmed));
  if (direct) return direct;
  const legacy = LEGACY_CHIEF_COMPLAINT_TO_CF4[trimmed];
  if (legacy) return legacy;
  return 'Others';
}

/**
 * Pulls chief-complaint ticks from the initial-assessment text the nurse saves
 * as `Chief complaint: A, B.\n\n…`. Labels that contain commas are matched whole.
 */
export function parseChiefComplaintsFromAssessment(assessment: string | null | undefined): string[] {
  const text = assessment?.trim() ?? '';
  const match = /^Chief complaint:\s*([^\n]+)/i.exec(text);
  if (!match) return [];
  let rest = match[1].replace(/\.\s*$/, '').trim();
  const found: string[] = [];
  while (rest) {
    const next = KNOWN_LABELS_LONGEST_FIRST.find((label) =>
      rest.toLowerCase().startsWith(label.toLowerCase()),
    );
    if (next) {
      found.push(next);
      rest = rest.slice(next.length).replace(/^[,\s]+/, '').trim();
      continue;
    }
    const comma = rest.indexOf(',');
    if (comma < 0) {
      if (rest) found.push(rest);
      break;
    }
    const piece = rest.slice(0, comma).trim();
    if (piece) found.push(piece);
    rest = rest.slice(comma + 1).trim();
  }
  return found;
}

/** Scan free-text HPI / notes for CF4 signs via clinical phrase synonyms. */
export function scanAssessmentForCf4Signs(assessment: string | null | undefined): Cf4PertinentSign[] {
  const haystack = normalizeToken(assessment ?? '');
  if (!haystack) return [];
  const checked = new Set<Cf4PertinentSign>();
  for (const { phrase, sign } of ASSESSMENT_PHRASE_TO_CF4) {
    if (haystack.includes(phrase)) checked.add(sign);
  }
  return [...checked];
}

/**
 * Prefer structured chief-complaint ticks; otherwise infer from free-text assessment.
 * Returns the labels to print under Chief Complaint and which CF4 boxes to tick.
 */
export function resolveCf4SignsFromAssessment(assessment: string | null | undefined): {
  complaints: string[];
  checked: Set<Cf4PertinentSign>;
  others: string[];
} {
  const structured = parseChiefComplaintsFromAssessment(assessment);
  if (structured.length) {
    const { checked, others } = cf4SignsFromComplaints(structured);
    return { complaints: structured, checked, others };
  }
  const scanned = scanAssessmentForCf4Signs(assessment);
  return {
    complaints: scanned,
    checked: new Set(scanned),
    others: [],
  };
}

/** Which CF4 boxes should be ticked, plus free-text leftovers for “Others”. */
export function cf4SignsFromComplaints(complaints: string[]): {
  checked: Set<Cf4PertinentSign>;
  others: string[];
} {
  const checked = new Set<Cf4PertinentSign>();
  const others: string[] = [];
  for (const complaint of complaints) {
    const mapped = toCf4PertinentSign(complaint);
    if (mapped === 'Others') {
      if (!others.includes(complaint.trim())) others.push(complaint.trim());
    } else {
      checked.add(mapped);
    }
  }
  return { checked, others };
}
