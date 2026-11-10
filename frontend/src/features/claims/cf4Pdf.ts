/**
 * Client-side Course in the Ward PDF renderer.
 *
 * The layout mirrors PhilHealth's **CF4 (Claim Form 4, February 2020)** as far
 * as our data goes: the same 8.5" x 13" long-bond page the form is printed on,
 * the same centred small-caps section bands stacked over ruled cells, and
 * Section IV laid out as the form's `Date | DOCTOR'S ORDER/ACTION` table.
 *
 * The table charts the **Course in the Ward for the whole stay**: the model
 * summary the physician approved, not the raw orders and not one row per day.
 *
 * It is deliberately a SUPPORTING DOCUMENT: the PhilHealth letterhead is
 * omitted and the header says so, so a generated sheet can never be mistaken
 * for the form itself. Sections the CF4 has but we hold no data for (HCI
 * information, PIN, diagnoses, case rate codes, physical examination, drugs,
 * outcome of treatment) are not reproduced.
 *
 * The claims export review step shares ONE builder between the embedded
 * preview and the "Download PDF" button, so the document on screen is always
 * identical to the file the processor saves.
 */

import { jsPDF } from 'jspdf';

import { formatDateMedium } from '../../lib/format';
import { courseEntries, type CourseEntry } from './mappers';
import type { Cf4SummaryDraft, ExportSource } from './types';

/** 8.5in — the CF4 is printed on Philippine long bond, not A4. */
const PAGE_W = 612;
/** 13in. Matching the form's paper keeps a printed sheet the same size. */
const PAGE_H = 936;
/** Page margin. */
const M = 32;
const CONTENT_W = PAGE_W - M * 2;
/** Width of the "Date" column in Section IV. */
const DATE_COL_W = 104;
/** The form ships ~17 blank ruled rows; keep some so it still reads as a chart. */
const MIN_TABLE_ROWS = 10;
/** Height of a centred section band. */
const BAND_H = 14;

const INK = '#000000';
const GRAY = '#5b6470';
const FAINT = '#8b93a1';

/** Mutable cursor shared by the section writers. */
type Ctx = { doc: jsPDF; y: number };

/** The stay's Course in the Ward, charted once in Section IV. */

/** A bordered field cell in the patient-data grid. */
type FieldCell = {
  w: number;
  label: string;
  value?: string;
  render?: (doc: jsPDF, x: number, y: number, w: number, h: number) => void;
};

// ── Primitives ─────────────────────────────────────────────────────────────

function newPage(ctx: Ctx): void {
  ctx.doc.addPage([PAGE_W, PAGE_H], 'portrait');
  ctx.y = M;
}

function fits(ctx: Ctx, needed: number): boolean {
  return ctx.y + needed <= PAGE_H - M;
}

/** Ensures `needed` points are free, adding a page only when it has to. */
function reserve(ctx: Ctx, needed: number): void {
  if (!fits(ctx, needed)) newPage(ctx);
}

/** Centred small-caps band, matching the form's section headers. */
function band(ctx: Ctx, title: string, note?: string): void {
  const { doc } = ctx;
  reserve(ctx, BAND_H);
  doc.setDrawColor(INK).setLineWidth(0.6);
  doc.rect(M, ctx.y, CONTENT_W, BAND_H, 'S');
  doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(INK);
  doc.text(title.toUpperCase(), M + CONTENT_W / 2, ctx.y + 9.3, { align: 'center' });
  if (note) {
    doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(GRAY);
    doc.text(note, M + CONTENT_W - 5, ctx.y + 9.3, { align: 'right' });
  }
  ctx.y += BAND_H;
}

/**
 * Band that must not be orphaned. Also reserves room for the section's first
 * block, so a heading can never land alone at the foot of a page with its
 * content overleaf.
 */
function bandWithNext(ctx: Ctx, title: string, keepWith: number, note?: string): void {
  reserve(ctx, BAND_H + keepWith);
  band(ctx, title, note);
}

/** The form's tiny uppercase field label. */
function fieldLabel(doc: jsPDF, text: string, x: number, y: number): void {
  doc.setFont('helvetica', 'bold').setFontSize(6.2).setTextColor(GRAY);
  doc.text(text.toUpperCase(), x, y);
}

/** Ticked box, as drawn on the paper form. */
function checkbox(doc: jsPDF, x: number, y: number, size: number, checked: boolean): void {
  doc.setDrawColor(INK).setLineWidth(0.6);
  doc.rect(x, y, size, size, 'S');
  if (!checked) return;
  doc.setLineWidth(1.1);
  doc.line(x + size * 0.2, y + size * 0.52, x + size * 0.42, y + size * 0.78);
  doc.line(x + size * 0.42, y + size * 0.78, x + size * 0.82, y + size * 0.18);
  doc.setLineWidth(0.6);
}

/** Body type. The gap is wider than the glyphs so one line cannot touch the next. */
const BODY = 9;
const LEAD = 16;

/**
 * Wraps `value` into lines that each fit `width`. Newlines stay as their own
 * gap. No returned line contains a line break — jsPDF would draw that break
 * on top of the next line.
 */
function wrapLines(doc: jsPDF, value: string, width: number): string[] {
  const normalized = (value || '—')
    .replace(/\r\n/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
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
  return lines.length ? lines : ['—'];
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

/** A row of bordered cells with a label in each top-left corner. Values wrap inside the cell. */
function fieldRow(ctx: Ctx, cells: FieldCell[], minH: number): void {
  const { doc } = ctx;
  const prepared = cells.map((cell) => {
    if (cell.render || !cell.value) return { cell, lines: [] as string[] };
    return { cell, lines: wrapLines(doc, cell.value, cell.w - 12) };
  });
  const lineCount = prepared.reduce((max, item) => Math.max(max, item.lines.length), 1);
  const h = Math.max(minH, 20 + lineCount * LEAD);
  reserve(ctx, h);
  let x = M;
  doc.setDrawColor(INK).setLineWidth(0.6);
  for (const { cell, lines } of prepared) {
    doc.rect(x, ctx.y, cell.w, h, 'S');
    fieldLabel(doc, cell.label, x + 6, ctx.y + 10);
    if (cell.render) {
      cell.render(doc, x, ctx.y, cell.w, h);
    } else {
      drawLines(doc, lines, x + 6, ctx.y + 24, ctx.y + h - 6);
    }
    x += cell.w;
  }
  ctx.y += h;
}

/** A full-width cell whose value wraps and stays inside the border. */
function textBlock(ctx: Ctx, label: string, value: string): void {
  const { doc } = ctx;
  const lines = wrapLines(doc, value, CONTENT_W - 20);
  const h = 22 + lines.length * LEAD + 8;
  reserve(ctx, h);
  doc.setDrawColor(INK).setLineWidth(0.6);
  doc.rect(M, ctx.y, CONTENT_W, h, 'S');
  fieldLabel(doc, label, M + 8, ctx.y + 12);
  drawLines(doc, lines, M + 8, ctx.y + 28, ctx.y + h - 8);
  ctx.y += h;
}

// ── Sections ───────────────────────────────────────────────────────────────

/** Header block: document identity on the left, the form it supports on the right. */
function letterhead(ctx: Ctx, generatedAt: string): void {
  const { doc } = ctx;
  const h = 52;
  const split = M + CONTENT_W * 0.6;

  doc.setDrawColor(INK).setLineWidth(0.8);
  doc.rect(M, ctx.y, CONTENT_W, h, 'S');
  doc.setLineWidth(0.6);
  doc.line(split, ctx.y, split, ctx.y + h);

  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(INK);
  doc.text('COURSE IN THE WARD', M + 10, ctx.y + 20);
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(GRAY);
  doc.text('PhilHealth Claim Form 4 (CF4) — Section IV', M + 10, ctx.y + 31);
  doc.setFont('helvetica', 'bold').setFontSize(6.2).setTextColor(GRAY);
  doc.text('SUPPORTING DOCUMENT — NOT THE CF4 FORM', M + 10, ctx.y + 43);

  const rx = PAGE_W - M - 10;
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(INK);
  doc.text('CF4', rx, ctx.y + 18, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(INK);
  doc.text('(Claim Form 4)', rx, ctx.y + 29, { align: 'right' });
  doc.text('February 2020', rx, ctx.y + 39, { align: 'right' });
  doc.setFontSize(6.2).setTextColor(FAINT);
  doc.text(`Generated ${generatedAt}`, rx, ctx.y + 48, { align: 'right' });

  ctx.y += h;
}

/** Provenance strip, sitting where the form's reminder box sits. */
function notice(
  ctx: Ctx,
  patientName: string,
  source: ExportSource,
  sourceFileName?: string,
): void {
  const { doc } = ctx;
  const workflow = source === 'new-cf4' ? 'New CF4 workflow' : 'Existing CF4 workflow';
  const text = [
    `Attach to the accomplished CF4 for ${patientName}.`,
    `Generated from the physician-approved Course in the Ward for the whole stay · ${workflow}.`,
    ...(sourceFileName ? [`Source file: ${sourceFileName}.`] : []),
  ].join(' ');

  doc.setFont('helvetica', 'bold').setFontSize(6.2).setTextColor(INK);
  const heading = 'SUPPORTING DOCUMENT:';
  /* Measured, not guessed — a hard-coded offset collides with the label. */
  const textX = M + 8 + doc.getTextWidth(heading) + 5;

  doc.setFont('helvetica', 'normal').setFontSize(6.2).setTextColor(GRAY);
  const lines = doc.splitTextToSize(text, CONTENT_W - (textX - M) - 8) as string[];

  const h = Math.max(19, lines.length * 8 + 11);
  reserve(ctx, h);
  doc.setDrawColor(INK).setLineWidth(0.6);
  doc.rect(M, ctx.y, CONTENT_W, h, 'S');

  doc.setFont('helvetica', 'bold').setFontSize(6.2).setTextColor(INK);
  doc.text(heading, M + 8, ctx.y + 12);
  doc.setFont('helvetica', 'normal').setFontSize(6.2).setTextColor(GRAY);
  let ty = ctx.y + 12;
  for (const line of lines) {
    doc.text(line, textX, ty);
    ty += 8;
  }

  ctx.y += h;
}

/** Section II, carrying the CF4's own field numbering. */
function patientSection(ctx: Ctx, draft: Cf4SummaryDraft): void {
  const { patient } = draft;
  const gender = patient.gender.trim().toLowerCase();

  band(ctx, "II. PATIENT'S DATA");

  fieldRow(ctx, [
    { w: CONTENT_W * 0.6, label: '1. Name of Patient', value: patient.name },
    { w: CONTENT_W * 0.4, label: '2. PIN' },
  ], 30);

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
        const boxY = y + h - 15;
        checkbox(doc, x + 8, boxY, 9, gender.startsWith('m'));
        doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(INK);
        doc.text('Male', x + 21, boxY + 7.5);
        checkbox(doc, x + w * 0.5, boxY, 9, gender.startsWith('f'));
        doc.text('Female', x + w * 0.5 + 13, boxY + 7.5);
      },
    },
    { w: CONTENT_W * 0.3, label: '9. a. Date Admitted', value: patient.admissionDate },
    {
      w: CONTENT_W * 0.3,
      label: '10. a. Date Discharged',
      value: patient.dischargeDateRaw
        ? formatDateMedium(patient.dischargeDateRaw)
        : patient.status === 'admitted' ? 'Present' : '',
    },
  ], 30);
  fieldRow(ctx, [{
    w: CONTENT_W,
    label: 'Admission period included in this document',
    value: patient.coveragePeriod,
  }], 24);

  const { chart } = draft;
  fieldRow(ctx, [
    { w: CONTENT_W * 0.34, label: 'Date of birth', value: chart.dateOfBirth },
    { w: CONTENT_W * 0.33, label: 'Contact number', value: chart.contactNumber },
    { w: CONTENT_W * 0.33, label: 'Insurance', value: chart.insurance },
  ], 30);
  textBlock(ctx, 'Address', chart.address);
  fieldRow(ctx, [
    { w: CONTENT_W * 0.34, label: 'Religion', value: chart.religion },
    { w: CONTENT_W * 0.66, label: 'Emergency contact', value: chart.emergencyContact },
  ], 30);
  fieldRow(ctx, [
    { w: CONTENT_W * 0.4, label: 'Attending physician', value: chart.attending },
    { w: CONTENT_W * 0.34, label: 'Ward / room', value: chart.location },
    { w: CONTENT_W * 0.26, label: 'Patient class', value: chart.patientClass },
  ], 30);
  textBlock(ctx, 'Triage on admission', chart.triage);
  textBlock(ctx, 'Initial assessment', chart.assessment);
}

function tableHeader(ctx: Ctx): void {
  const { doc } = ctx;
  const h = 14;
  doc.setDrawColor(INK).setLineWidth(0.6);
  doc.rect(M, ctx.y, DATE_COL_W, h, 'S');
  doc.rect(M + DATE_COL_W, ctx.y, CONTENT_W - DATE_COL_W, h, 'S');
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(INK);
  doc.text('Date', M + DATE_COL_W / 2, ctx.y + 9.3, { align: 'center' });
  doc.text(
    "DOCTOR'S ORDER/ACTION",
    M + DATE_COL_W + (CONTENT_W - DATE_COL_W) / 2,
    ctx.y + 9.3,
    { align: 'center' },
  );
  ctx.y += h;
}

const LINE = 10.5;

/**
 * Section IV, one row per day of the stay: the date column carries the day and
 * the action column that day's physician-approved summary. A day too long for
 * the page continues on the next one under a "(cont.)" date.
 */
function courseTable(ctx: Ctx, entries: CourseEntry[]): void {
  const { doc } = ctx;
  let painted = 0;
  tableHeader(ctx);
  for (const entry of entries) {
    painted += courseRow(ctx, entry);
  }

  for (let blank = painted; blank < MIN_TABLE_ROWS; blank += 1) {
    if (!fits(ctx, 24)) break;
    doc.setDrawColor(INK).setLineWidth(0.6);
    doc.rect(M, ctx.y, DATE_COL_W, 24, 'S');
    doc.rect(M + DATE_COL_W, ctx.y, CONTENT_W - DATE_COL_W, 24, 'S');
    ctx.y += 24;
  }
}

/** Paints one day, split across pages when needed; returns how many rows it took. */
function courseRow(ctx: Ctx, entry: CourseEntry): number {
  const { doc } = ctx;
  const bodyW = CONTENT_W - DATE_COL_W - 14;
  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  const lines = doc.splitTextToSize(entry.text, bodyW) as string[];

  let index = 0;
  let continued = false;
  let painted = 0;

  while (index < lines.length) {
    const room = PAGE_H - M - ctx.y;
    const maxLines = Math.max(1, Math.floor((room - 16) / LINE));
    // Start a short day on a fresh page rather than leave its first lines stranded.
    if (!continued && maxLines < Math.min(lines.length, 3) && ctx.y > M + 40) {
      newPage(ctx);
      tableHeader(ctx);
      continue;
    }
    const slice = lines.slice(index, index + maxLines);
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    const dateLines = doc.splitTextToSize(
      continued ? `${entry.dateLabel} (cont.)` : entry.dateLabel,
      DATE_COL_W - 12,
    ) as string[];
    const height = Math.max(24, slice.length * LINE + 16, dateLines.length * 9 + 16);
    if (!fits(ctx, height)) {
      newPage(ctx);
      tableHeader(ctx);
      continue;
    }

    doc.setDrawColor(INK).setLineWidth(0.6);
    doc.rect(M, ctx.y, DATE_COL_W, height, 'S');
    doc.rect(M + DATE_COL_W, ctx.y, CONTENT_W - DATE_COL_W, height, 'S');

    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(INK);
    let dateY = ctx.y + 14;
    for (const line of dateLines) {
      if (dateY > ctx.y + height - 4) break;
      doc.text(line, M + DATE_COL_W / 2, dateY, { align: 'center' });
      dateY += 9;
    }

    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(INK);
    let ty = ctx.y + 13;
    for (const line of slice) {
      doc.text(line, M + DATE_COL_W + 7, ty);
      ty += LINE;
    }

    ctx.y += height;
    index += slice.length;
    painted += 1;
    continued = true;
  }
  return painted;
}

/** Section VII, verbatim wording from the form. */
function certification(ctx: Ctx, physician: string, evaluator: string): void {
  const { doc } = ctx;
  const h = 96;
  reserve(ctx, h);
  doc.setDrawColor(INK).setLineWidth(0.6);
  doc.rect(M, ctx.y, CONTENT_W, h, 'S');

  let ty = ctx.y + 14;
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(INK);
  doc.text('Certification of Attending Health Care Professional:', M + 8, ty);

  ty += 15;
  doc.setFont('helvetica', 'italic').setFontSize(7.5).setTextColor(GRAY);
  doc.text(
    'I certify that the above information given in this form, including all attachments, are true and correct.',
    M + CONTENT_W / 2,
    ty,
    { align: 'center' },
  );

  ty += 26;
  const sigX = M + 36;
  const sigW = 250;
  doc.setDrawColor(INK).setLineWidth(0.6);
  doc.line(sigX, ty, sigX + sigW, ty);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(INK);
  doc.text(physician || '—', sigX, ty + 11);
  doc.setFont('helvetica', 'normal').setFontSize(6.2).setTextColor(GRAY);
  doc.text('Signature over Printed Name of', sigX, ty + 21);
  doc.text('Attending Health Care Professional', sigX, ty + 28);

  const dateX = M + CONTENT_W - 186;
  doc.line(dateX, ty, dateX + 150, ty);
  doc.setFont('helvetica', 'normal').setFontSize(6.2).setTextColor(GRAY);
  doc.text('Date Signed', dateX + 75, ty + 21, { align: 'center' });

  doc.setFont('helvetica', 'normal').setFontSize(6.2).setTextColor(FAINT);
  doc.text(`Prepared by: ${evaluator} · Claims Processor`, M + 8, ctx.y + h - 7);

  ctx.y += h;
}

// ── Entry point ────────────────────────────────────────────────────────────

/**
 * Builds one CF4 supporting document for a patient's whole stay.
 *
 * @param draft Patient + the persisted summary the document is projected from.
 * @param source Which export workflow produced the draft.
 * @param evaluator Claims processor recorded as the evaluator of record.
 * @param sourceFileName Uploaded local PDF's name for the existing-CF4 flow.
 */
export function buildCf4Pdf(
  draft: Cf4SummaryDraft,
  source: ExportSource,
  evaluator: string,
  sourceFileName?: string,
): jsPDF {
  const { patient } = draft;
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    orientation: 'portrait',
    compress: true,
  });
  const ctx: Ctx = { doc, y: M };

  doc.setProperties({
    title: `Course in the Ward — ${patient.name}`,
    subject: 'PhilHealth Claim Form 4 (CF4) — supporting document',
    author: evaluator,
  });

  letterhead(ctx, new Date().toLocaleString());
  notice(ctx, patient.name, source, sourceFileName);
  patientSection(ctx, draft);

  bandWithNext(ctx, 'IV. COURSE IN THE WARD', BAND_H, 'Entire stay · attach laboratory/imaging results');
  courseTable(ctx, courseEntries(draft));

  bandWithNext(ctx, 'VII. CERTIFICATION OF HEALTH CARE PROFESSIONAL', 96);
  certification(ctx, draft.chart.attending === '—' ? evaluator : draft.chart.attending, evaluator);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal').setFontSize(6.8).setTextColor(FAINT);
    doc.text(`Course4Ward · ${patient.patientId} · ${patient.name}`, M, PAGE_H - 13);
    doc.text(`Page ${page} of ${pages}`, PAGE_W - M, PAGE_H - 13, { align: 'right' });
  }

  return doc;
}
