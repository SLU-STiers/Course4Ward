/**
 * Client-side PhilHealth CF4 supporting PDF (February 2020 layout cues).
 *
 * Fills what Course4Ward stores for Sections I–IV and VII:
 * HCI identity, patient data, reason for admission (HPI + CF4 sign ticks),
 * Course in the Ward (one row per approved day), and certification.
 * Case rates, drugs, and outcome stay blank when not captured.
 *
 * Preview and download share this builder via `cf4Document.ts`.
 */

import { jsPDF } from 'jspdf';

import {
  CF4_PERTINENT_SIGNS,
  resolveCf4SignsFromAssessment,
} from '../../lib/cf4PertinentSigns';
import { formatDatePhilHealth } from '../../lib/format';
import { triageLevelInfo, type TriageDisplay } from '../../lib/triage';
import philHealthLogoUrl from './assets/philhealth-logo.png';
import { courseEntries, type CourseEntry } from './mappers';
import type { Cf4SummaryDraft } from './types';

let philHealthLogoDataUrl: string | null = null;

async function loadPhilHealthLogo(): Promise<string> {
  if (philHealthLogoDataUrl) return philHealthLogoDataUrl;
  const response = await fetch(philHealthLogoUrl);
  const blob = await response.blob();
  philHealthLogoDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read PhilHealth logo'));
    reader.readAsDataURL(blob);
  });
  return philHealthLogoDataUrl;
}

/** 8.5in — Philippine long bond. */
const PAGE_W = 612;
/** 13in. */
const PAGE_H = 936;
const M = 26;
const CONTENT_W = PAGE_W - M * 2;
const DATE_COL_W = 90;
const MIN_TABLE_ROWS = 8;
const BAND_H = 15;
const LINE = 10.5;

const HCI_NAME = 'SLU Sacred Heart Medical Center';

const INK = '#000000';
const GRAY = '#4b5563';
const FAINT = '#6b7280';

type Ctx = { doc: jsPDF; y: number };

type FieldCell = {
  w: number;
  label: string;
  value?: string;
  render?: (doc: jsPDF, x: number, y: number, w: number, h: number) => void;
};

type CheckboxMark = { x: number; y: number; size: number };

// ── Primitives ─────────────────────────────────────────────────────────────

function newPage(ctx: Ctx): void {
  ctx.doc.addPage([PAGE_W, PAGE_H], 'portrait');
  ctx.y = M;
}

function fits(ctx: Ctx, needed: number): boolean {
  return ctx.y + needed <= PAGE_H - M - 18;
}

function reserve(ctx: Ctx, needed: number): void {
  if (!fits(ctx, needed)) newPage(ctx);
}

function band(ctx: Ctx, title: string): void {
  const { doc } = ctx;
  reserve(ctx, BAND_H);
  doc.setDrawColor(INK).setLineWidth(0.7);
  doc.rect(M, ctx.y, CONTENT_W, BAND_H, 'S');
  doc.setFont('helvetica', 'bold').setFontSize(6.8).setTextColor(INK);
  doc.text(title.toUpperCase(), M + CONTENT_W / 2, ctx.y + 10, { align: 'center' });
  ctx.y += BAND_H;
}

function bandWithNext(ctx: Ctx, title: string, keepWith: number): void {
  reserve(ctx, BAND_H + keepWith);
  band(ctx, title);
}

function fieldLabel(doc: jsPDF, text: string, x: number, y: number): void {
  doc.setFont('helvetica', 'bold').setFontSize(5.8).setTextColor(GRAY);
  doc.text(text.toUpperCase(), x, y);
}

function checkbox(doc: jsPDF, x: number, y: number, size: number, checked: boolean): void {
  doc.setDrawColor(INK).setLineWidth(0.55);
  doc.rect(x, y, size, size, 'S');
  if (!checked) return;
  doc.setLineWidth(1);
  doc.line(x + size * 0.2, y + size * 0.52, x + size * 0.42, y + size * 0.78);
  doc.line(x + size * 0.42, y + size * 0.78, x + size * 0.82, y + size * 0.18);
  doc.setLineWidth(0.55);
}

const BODY = 8;
const LEAD = 11;

function wrapLines(doc: jsPDF, value: string, width: number): string[] {
  const normalized = (value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
  if (!normalized) return [];
  doc.setFont('helvetica', 'normal').setFontSize(BODY);
  const lines: string[] = [];
  for (const paragraph of normalized.split('\n')) {
    const chunk = paragraph.trim();
    if (!chunk) {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('');
      continue;
    }
    const wrapped = doc.splitTextToSize(chunk, Math.max(12, width)) as string[];
    for (const line of wrapped) lines.push(String(line).replace(/[\r\n\u2028\u2029]/g, ' '));
  }
  return lines;
}

function drawLines(doc: jsPDF, lines: string[], x: number, y: number, bottom: number): void {
  doc.setFont('helvetica', 'normal').setFontSize(BODY).setTextColor(INK);
  let ty = y;
  for (const line of lines) {
    if (ty > bottom) break;
    if (line) doc.text(line, x, ty);
    ty += LEAD;
  }
}

function fieldRow(ctx: Ctx, cells: FieldCell[], minH: number): void {
  const { doc } = ctx;
  const prepared = cells.map((cell) => {
    if (cell.render || cell.value === undefined) return { cell, lines: [] as string[] };
    return { cell, lines: wrapLines(doc, cell.value, cell.w - 10) };
  });
  const lineCount = Math.max(1, prepared.reduce((max, item) => Math.max(max, item.lines.length), 0));
  const h = Math.max(minH, 16 + lineCount * LEAD);
  reserve(ctx, h);
  let x = M;
  doc.setDrawColor(INK).setLineWidth(0.55);
  for (const { cell, lines } of prepared) {
    doc.rect(x, ctx.y, cell.w, h, 'S');
    fieldLabel(doc, cell.label, x + 4, ctx.y + 8);
    if (cell.render) {
      cell.render(doc, x, ctx.y, cell.w, h);
    } else if (lines.length) {
      drawLines(doc, lines, x + 4, ctx.y + 18, ctx.y + h - 3);
    }
    x += cell.w;
  }
  ctx.y += h;
}

function textBlock(ctx: Ctx, label: string, value: string, minH = 28): void {
  const { doc } = ctx;
  const lines = wrapLines(doc, value || '—', CONTENT_W - 16);
  const h = Math.max(minH, 18 + Math.max(1, lines.length) * LEAD + 4);
  reserve(ctx, h);
  doc.setDrawColor(INK).setLineWidth(0.55);
  doc.rect(M, ctx.y, CONTENT_W, h, 'S');
  fieldLabel(doc, label, M + 5, ctx.y + 9);
  drawLines(doc, lines.length ? lines : ['—'], M + 5, ctx.y + 19, ctx.y + h - 3);
  ctx.y += h;
}

function shown(value: string | null | undefined): string {
  const text = value?.trim();
  return text && text !== '—' ? text : '';
}

/** Chief complaint from structured ticks / scanned signs, else first assessment sentence. */
function chiefComplaintOf(assessment: string): string {
  const { complaints } = resolveCf4SignsFromAssessment(assessment);
  if (complaints.length) return complaints.join(', ');
  const text = shown(assessment);
  if (!text || /^no notes/i.test(text)) return '';
  const first = text.split(/[\n.]+/).map((part) => part.trim()).find(Boolean);
  return first || text;
}

/** CF4 Part III item 3 — four-column checkbox grid matching Claim Form 4. */
function pertinentSignsBlock(
  ctx: Ctx,
  assessment: string,
): void {
  const { doc } = ctx;
  const { checked, others } = resolveCf4SignsFromAssessment(assessment);
  const items: Array<{ label: string; isChecked: boolean }> = [
    ...CF4_PERTINENT_SIGNS.map((label) => ({
      label,
      isChecked: checked.has(label),
    })),
    { label: 'Others', isChecked: others.length > 0 },
  ];

  const cols = 4;
  const rows = Math.ceil(items.length / cols);
  const boxSize = 7;
  const rowH = 12;
  const headerH = 16;
  const othersLineH = others.length ? 14 : 0;
  const h = headerH + rows * rowH + othersLineH + 6;
  reserve(ctx, h);

  doc.setDrawColor(INK).setLineWidth(0.55);
  doc.rect(M, ctx.y, CONTENT_W, h, 'S');
  fieldLabel(doc, '3. Pertinent Signs and Symptoms on Admission', M + 5, ctx.y + 9);

  const colW = CONTENT_W / cols;
  const gridTop = ctx.y + headerH;
  doc.setFont('helvetica', 'normal').setFontSize(6.2).setTextColor(INK);

  for (let i = 0; i < items.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = M + col * colW + 5;
    const y = gridTop + row * rowH;
    checkbox(doc, x, y, boxSize, items[i].isChecked);
    const labelW = colW - boxSize - 12;
    const labelLines = doc.splitTextToSize(items[i].label, labelW) as string[];
    doc.text(labelLines[0] ?? items[i].label, x + boxSize + 3, y + 5.5);
  }

  if (others.length) {
    const othersY = gridTop + rows * rowH + 4;
    doc.setFont('helvetica', 'normal').setFontSize(6.2).setTextColor(INK);
    const othersText = wrapLines(doc, `Others: ${others.join('; ')}`, CONTENT_W - 16);
    drawLines(doc, othersText.slice(0, 1), M + 5, othersY + 4, ctx.y + h - 2);
  }

  ctx.y += h;
}

// ── Sections ───────────────────────────────────────────────────────────────

function letterhead(ctx: Ctx, generatedAt: string, logoDataUrl: string): void {
  const { doc } = ctx;
  const h = 42;
  const logoW = 108;
  const logoH = 34;
  const textX = M + logoW + 12;

  doc.setDrawColor(INK).setLineWidth(0.8);
  doc.rect(M, ctx.y, CONTENT_W, h, 'S');

  try {
    doc.addImage(logoDataUrl, 'PNG', M + 4, ctx.y + 4, logoW, logoH);
  } catch {
    /* Logo is branding only; the form still prints without it. */
  }

  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(INK);
  doc.text('CF4 (Claim Form 4) · February 2020', textX, ctx.y + 15);
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(INK);
  doc.text('PhilHealth Claim Form 4 — supporting document from Course4Ward', textX, ctx.y + 26);

  const rx = PAGE_W - M - 7;
  doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(GRAY);
  doc.text('Not a substitute for the accomplished CF4', rx, ctx.y + 15, { align: 'right' });
  doc.setTextColor(FAINT);
  doc.text(`Generated ${generatedAt}`, rx, ctx.y + 26, { align: 'right' });

  ctx.y += h;
}

function hciSection(ctx: Ctx): void {
  band(ctx, 'I. HEALTH CARE INSTITUTION (HCI) INFORMATION');
  fieldRow(ctx, [
    { w: CONTENT_W * 0.62, label: '1. Name of HCI', value: HCI_NAME },
    { w: CONTENT_W * 0.38, label: '2. Accreditation Number', value: '' },
  ], 24);
  fieldRow(ctx, [
    { w: CONTENT_W, label: '3. Address of HCI', value: '' },
  ], 22);
}

function patientDataSection(ctx: Ctx, draft: Cf4SummaryDraft, triage: TriageDisplay | undefined): void {
  const { patient, chart } = draft;
  const gender = patient.gender.trim().toLowerCase();
  const assessment = shown(chart.assessment);
  const admitted = formatDatePhilHealth(patient.admissionDateRaw) || patient.admissionDate || '';
  const discharged = patient.dischargeDateRaw
    ? formatDatePhilHealth(patient.dischargeDateRaw)
    : patient.status === 'admitted'
      ? 'Present'
      : '';
  const admitTime = triage?.time && triage.time !== '—' ? triage.time : '';

  band(ctx, "II. PATIENT'S DATA");

  fieldRow(ctx, [
    { w: CONTENT_W * 0.62, label: '1. Name of Patient', value: patient.name },
    { w: CONTENT_W * 0.38, label: '2. PhilHealth Identification Number (PIN)', value: '' },
  ], 24);

  fieldRow(ctx, [
    {
      w: CONTENT_W * 0.14,
      label: '3. Age',
      value: patient.age === null ? '' : String(patient.age),
    },
    {
      w: CONTENT_W * 0.26,
      label: '4. Sex',
      render: (doc, x, y, w, h) => {
        const boxY = y + h - 13;
        checkbox(doc, x + 5, boxY, 7.5, gender.startsWith('m'));
        doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(INK);
        doc.text('Male', x + 15, boxY + 6);
        checkbox(doc, x + w * 0.48, boxY, 7.5, gender.startsWith('f'));
        doc.text('Female', x + w * 0.48 + 10, boxY + 6);
      },
    },
    { w: CONTENT_W * 0.3, label: 'Date of Birth', value: shown(chart.dateOfBirth) },
    { w: CONTENT_W * 0.3, label: 'Contact Number', value: shown(chart.contactNumber) },
  ], 26);

  textBlock(ctx, '5. Chief Complaint', chiefComplaintOf(assessment) || assessment || '—', 26);
  textBlock(ctx, '6. Admitting Diagnosis / Impression', assessment || '—', 26);
  textBlock(
    ctx,
    '7. Discharge Diagnosis',
    shown(chart.dischargeDiagnosis) || '—',
    26,
  );

  fieldRow(ctx, [
    { w: CONTENT_W * 0.5, label: '8. a. 1st Case Rate Code', value: '' },
    { w: CONTENT_W * 0.5, label: '8. b. 2nd Case Rate Code', value: '' },
  ], 22);

  fieldRow(ctx, [
    { w: CONTENT_W * 0.28, label: '9. a. Date Admitted', value: admitted },
    { w: CONTENT_W * 0.22, label: '9. b. Time Admitted', value: admitTime },
    { w: CONTENT_W * 0.28, label: '10. a. Date Discharged', value: discharged },
    { w: CONTENT_W * 0.22, label: '10. b. Time Discharged', value: '' },
  ], 24);

  fieldRow(ctx, [
    { w: CONTENT_W * 0.34, label: 'Attending Physician', value: shown(chart.attending) },
    { w: CONTENT_W * 0.28, label: 'Ward', value: shown(chart.ward) || shown(chart.location) },
    { w: CONTENT_W * 0.18, label: 'Room / Bed', value: shown(chart.room) },
    { w: CONTENT_W * 0.2, label: 'Patient Class', value: shown(chart.patientClass) },
  ], 24);

  fieldRow(ctx, [
    { w: CONTENT_W * 0.5, label: 'Address', value: shown(chart.address) },
    { w: CONTENT_W * 0.25, label: 'Religion', value: shown(chart.religion) },
    { w: CONTENT_W * 0.25, label: 'Insurance', value: shown(chart.insurance) },
  ], 24);

  fieldRow(ctx, [
    { w: CONTENT_W, label: 'Emergency Contact', value: shown(chart.emergencyContact) },
  ], 22);
}

function vitalCell(value: string, unit = ''): string {
  if (!value || value === '—') return '';
  return unit ? `${value} ${unit}` : value;
}

function reasonForAdmissionSection(
  ctx: Ctx,
  draft: Cf4SummaryDraft,
  triage: TriageDisplay | undefined,
): void {
  const assessment = shown(draft.chart.assessment);
  const level = triageLevelInfo(triage?.level ?? null);
  const vitalsLine = [
    vitalCell(triage?.bp ?? '', 'mmHg'),
    vitalCell(triage?.heartRate ?? '', 'bpm'),
    vitalCell(triage?.respRate ?? '', '/min'),
    vitalCell(triage?.temp ?? '', '°C'),
    vitalCell(triage?.spo2 ?? '', '%'),
    vitalCell(triage?.pain ?? '', '/10'),
  ]
    .filter(Boolean)
    .join(' · ');

  band(ctx, 'III. REASON FOR ADMISSION');

  textBlock(
    ctx,
    '1. History of Present Illness',
    assessment && !/^no notes/i.test(assessment) ? assessment : '—',
    36,
  );

  {
    const history = shown(draft.chart.medicalSurgicalHistory);
    const { doc } = ctx;
    const lines = wrapLines(doc, history || '', CONTENT_W * 0.7 - 12);
    const h = Math.max(28, 18 + Math.max(1, lines.length) * LEAD + 4);
    reserve(ctx, h);
    let x = M;
    doc.setDrawColor(INK).setLineWidth(0.55);
    doc.rect(x, ctx.y, CONTENT_W * 0.7, h, 'S');
    fieldLabel(doc, '2. a. Past / Present Medical / Surgical History', x + 4, ctx.y + 8);
    drawLines(doc, lines.length ? lines : ['—'], x + 4, ctx.y + 18, ctx.y + h - 3);
    x += CONTENT_W * 0.7;
    doc.rect(x, ctx.y, CONTENT_W * 0.3, h, 'S');
    fieldLabel(doc, '2. b. OB / GYN History', x + 4, ctx.y + 8);
    const boxY = ctx.y + h - 13;
    checkbox(doc, x + 6, boxY, 8, true);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(INK);
    doc.text('N/A', x + 17, boxY + 6.5);
    ctx.y += h;
  }

  pertinentSignsBlock(ctx, assessment);

  fieldRow(ctx, [
    {
      w: CONTENT_W,
      label: '4. Referred from another HCI',
      render: (doc, x, y, _w, h) => {
        const boxY = y + h - 13;
        checkbox(doc, x + 6, boxY, 8, false);
        doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(INK);
        doc.text('Yes', x + 17, boxY + 6.5);
        checkbox(doc, x + 48, boxY, 8, true);
        doc.text('No', x + 59, boxY + 6.5);
        doc.setFont('helvetica', 'normal').setFontSize(6.2).setTextColor(GRAY);
        doc.text('If Yes, reason / originating HCI:', x + 92, boxY + 6.5);
      },
    },
  ], 24);

  band(ctx, '5. Physical Examination on Admission');
  fieldRow(ctx, [
    { w: CONTENT_W * 0.22, label: 'Blood Pressure (mmHg)', value: vitalCell(triage?.bp ?? '') },
    { w: CONTENT_W * 0.18, label: 'Heart Rate (bpm)', value: vitalCell(triage?.heartRate ?? '') },
    { w: CONTENT_W * 0.18, label: 'Resp. Rate (/min)', value: vitalCell(triage?.respRate ?? '') },
    { w: CONTENT_W * 0.14, label: 'Temp (°C)', value: vitalCell(triage?.temp ?? '') },
    { w: CONTENT_W * 0.14, label: 'SpO₂ (%)', value: vitalCell(triage?.spo2 ?? '') },
    { w: CONTENT_W * 0.14, label: 'Pain (/10)', value: vitalCell(triage?.pain ?? '') },
  ], 26);

  fieldRow(ctx, [
    { w: CONTENT_W * 0.25, label: 'Height (cm)', value: vitalCell(triage?.height ?? '') },
    { w: CONTENT_W * 0.25, label: 'Weight (kg)', value: vitalCell(triage?.weight ?? '') },
    {
      w: CONTENT_W * 0.5,
      label: 'General Survey',
      render: (doc, x, y, _w, h) => {
        const boxY = y + h - 13;
        const hasVitals = Boolean(vitalsLine);
        checkbox(doc, x + 6, boxY, 8, !hasVitals);
        doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(INK);
        doc.text('Essentially normal', x + 17, boxY + 6.5);
        checkbox(doc, x + 110, boxY, 8, hasVitals);
        doc.text('Abnormal / see vitals above', x + 121, boxY + 6.5);
      },
    },
  ], 24);

  if (level || triage?.date && triage.date !== '—') {
    fieldRow(ctx, [
      {
        w: CONTENT_W * 0.55,
        label: 'Triage Level',
        value: level ? `${level.name} (ESI ${level.level}) · ${level.target}` : '',
      },
      { w: CONTENT_W * 0.225, label: 'Triage Date', value: triage?.date !== '—' ? triage?.date : '' },
      { w: CONTENT_W * 0.225, label: 'Triage Time', value: triage?.time !== '—' ? triage?.time : '' },
    ], 24);
  }
}

function courseSectionBand(
  ctx: Ctx,
  ward: string,
  room: string,
): CheckboxMark {
  const { doc } = ctx;
  const h = 38;
  reserve(ctx, h + 14);

  doc.setDrawColor(INK).setLineWidth(0.7);
  doc.rect(M, ctx.y, CONTENT_W, h, 'S');

  doc.setFont('helvetica', 'bold').setFontSize(6.8).setTextColor(INK);
  doc.text(
    'IV. COURSE IN THE WARD (Attach photocopy of laboratory/imaging results)',
    M + CONTENT_W / 2,
    ctx.y + 10,
    { align: 'center' },
  );

  doc.setFont('helvetica', 'normal').setFontSize(6.2).setTextColor(INK);
  doc.text(`Ward: ${shown(ward) || '—'}`, M + 8, ctx.y + 22);
  doc.text(`Room / Bed: ${shown(room) || '—'}`, M + CONTENT_W * 0.42, ctx.y + 22);

  const size = 7.5;
  const boxX = M + 7;
  const boxY = ctx.y + 27;
  checkbox(doc, boxX, boxY, size, false);
  doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(INK);
  doc.text('Check box if there is/are additional sheet(s).', boxX + size + 4, boxY + 6);

  ctx.y += h;
  return { x: boxX, y: boxY, size };
}

function tableHeader(ctx: Ctx): void {
  const { doc } = ctx;
  const h = 13;
  if (!fits(ctx, h + 22)) newPage(ctx);
  doc.setDrawColor(INK).setLineWidth(0.55);
  doc.rect(M, ctx.y, DATE_COL_W, h, 'S');
  doc.rect(M + DATE_COL_W, ctx.y, CONTENT_W - DATE_COL_W, h, 'S');
  doc.setFont('helvetica', 'bold').setFontSize(6.8).setTextColor(INK);
  doc.text('Date', M + DATE_COL_W / 2, ctx.y + 9, { align: 'center' });
  doc.text(
    "DOCTOR'S ORDER/ACTION",
    M + DATE_COL_W + (CONTENT_W - DATE_COL_W) / 2,
    ctx.y + 9,
    { align: 'center' },
  );
  ctx.y += h;
}

function courseTable(ctx: Ctx, entries: CourseEntry[]): number {
  const { doc } = ctx;
  let painted = 0;
  tableHeader(ctx);
  for (const entry of entries) {
    painted += courseRow(ctx, entry);
  }

  for (let blank = painted; blank < MIN_TABLE_ROWS; blank += 1) {
    if (!fits(ctx, 20)) break;
    doc.setDrawColor(INK).setLineWidth(0.55);
    doc.rect(M, ctx.y, DATE_COL_W, 20, 'S');
    doc.rect(M + DATE_COL_W, ctx.y, CONTENT_W - DATE_COL_W, 20, 'S');
    ctx.y += 20;
    painted += 1;
  }
  return painted;
}

function courseRow(ctx: Ctx, entry: CourseEntry): number {
  const { doc } = ctx;
  const bodyW = CONTENT_W - DATE_COL_W - 12;
  doc.setFont('helvetica', 'normal').setFontSize(7.5);
  const lines = doc.splitTextToSize(entry.text || '—', bodyW) as string[];

  let index = 0;
  let continued = false;
  let painted = 0;

  while (index < lines.length) {
    const room = PAGE_H - M - 18 - ctx.y;
    const maxLines = Math.max(1, Math.floor((room - 12) / LINE));
    if (!continued && maxLines < Math.min(lines.length, 3) && ctx.y > M + 40) {
      newPage(ctx);
      tableHeader(ctx);
      continue;
    }
    const slice = lines.slice(index, index + maxLines);
    doc.setFont('helvetica', 'normal').setFontSize(6.8);
    const dateText = continued ? `${entry.dateLabel} (cont.)` : entry.dateLabel;
    const dateLines = doc.splitTextToSize(dateText, DATE_COL_W - 8) as string[];
    const height = Math.max(20, slice.length * LINE + 10, dateLines.length * 8 + 10);
    if (!fits(ctx, height)) {
      newPage(ctx);
      tableHeader(ctx);
      continue;
    }

    doc.setDrawColor(INK).setLineWidth(0.55);
    doc.rect(M, ctx.y, DATE_COL_W, height, 'S');
    doc.rect(M + DATE_COL_W, ctx.y, CONTENT_W - DATE_COL_W, height, 'S');

    doc.setFont('helvetica', 'normal').setFontSize(6.8).setTextColor(INK);
    let dateY = ctx.y + 11;
    for (const line of dateLines) {
      if (dateY > ctx.y + height - 3) break;
      doc.text(line, M + DATE_COL_W / 2, dateY, { align: 'center' });
      dateY += 8;
    }

    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(INK);
    let ty = ctx.y + 10;
    for (const line of slice) {
      doc.text(line, M + DATE_COL_W + 5, ty);
      ty += LINE;
    }

    ctx.y += height;
    index += slice.length;
    painted += 1;
    continued = true;
  }
  return painted;
}

function surgicalProcedureLine(ctx: Ctx): void {
  const { doc } = ctx;
  const h = 24;
  reserve(ctx, h);
  doc.setDrawColor(INK).setLineWidth(0.55);
  doc.rect(M, ctx.y, CONTENT_W, h, 'S');
  doc.setFont('helvetica', 'bold').setFontSize(5.8).setTextColor(GRAY);
  doc.text(
    'SURGICAL PROCEDURE/RVS CODE (Attach photocopy of OR technique):',
    M + 5,
    ctx.y + 10,
  );
  ctx.y += h;
}

function certification(ctx: Ctx, physician: string, evaluator: string): void {
  const { doc } = ctx;
  const h = 84;
  reserve(ctx, h);
  doc.setDrawColor(INK).setLineWidth(0.55);
  doc.rect(M, ctx.y, CONTENT_W, h, 'S');

  let ty = ctx.y + 11;
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(INK);
  doc.text('Certification of Attending Health Care Professional:', M + 6, ty);

  ty += 12;
  doc.setFont('helvetica', 'italic').setFontSize(6.8).setTextColor(GRAY);
  doc.text(
    'I certify that the above information given in this form, including all attachments, are true and correct.',
    M + CONTENT_W / 2,
    ty,
    { align: 'center' },
  );

  ty += 22;
  const sigX = M + 24;
  const sigW = 230;
  doc.setDrawColor(INK).setLineWidth(0.55);
  doc.line(sigX, ty, sigX + sigW, ty);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(INK);
  doc.text(physician || '—', sigX, ty + 9);
  doc.setFont('helvetica', 'normal').setFontSize(5.8).setTextColor(GRAY);
  doc.text('Signature over Printed Name of', sigX, ty + 17);
  doc.text('Attending Health Care Professional', sigX, ty + 24);

  const dateX = M + CONTENT_W - 160;
  doc.line(dateX, ty, dateX + 130, ty);
  doc.setFont('helvetica', 'normal').setFontSize(5.8).setTextColor(GRAY);
  doc.text('Date Signed', dateX + 65, ty + 17, { align: 'center' });

  doc.setFont('helvetica', 'normal').setFontSize(5.8).setTextColor(FAINT);
  doc.text(`Prepared by: ${evaluator} · Claims Processor`, M + 6, ctx.y + h - 6);

  ctx.y += h;
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function buildCf4Pdf(draft: Cf4SummaryDraft, evaluator: string): Promise<jsPDF> {
  const { patient } = draft;
  const triage = draft.requests[0]?.triage;
  const logoDataUrl = await loadPhilHealthLogo();
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    orientation: 'portrait',
    compress: true,
  });
  const ctx: Ctx = { doc, y: M };

  doc.setProperties({
    title: `CF4 Supporting Document — ${patient.name}`,
    subject: 'PhilHealth Claim Form 4 (CF4) — supporting document',
    author: evaluator,
  });

  letterhead(ctx, new Date().toLocaleString(), logoDataUrl);
  hciSection(ctx);
  patientDataSection(ctx, draft, triage);
  reasonForAdmissionSection(ctx, draft, triage);

  const additionalSheets = courseSectionBand(ctx, draft.chart.ward, draft.chart.room);
  courseTable(ctx, courseEntries(draft));
  surgicalProcedureLine(ctx);

  bandWithNext(ctx, 'VII. CERTIFICATION OF HEALTH CARE PROFESSIONAL', 84);
  certification(ctx, draft.chart.attending === '—' ? evaluator : draft.chart.attending, evaluator);

  const pages = doc.getNumberOfPages();
  if (pages > 1) {
    doc.setPage(1);
    checkbox(doc, additionalSheets.x, additionalSheets.y, additionalSheets.size, true);
  }

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal').setFontSize(6.2).setTextColor(FAINT);
    doc.text(`Course4Ward · ${patient.patientId} · ${patient.name}`, M, PAGE_H - 11);
    doc.text(`Page ${page} of ${pages}`, PAGE_W - M, PAGE_H - 11, { align: 'right' });
  }

  return doc;
}
