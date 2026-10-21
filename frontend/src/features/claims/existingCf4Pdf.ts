import {
  PDFDocument,
  PDFTextField,
  StandardFonts,
} from 'pdf-lib';

import { buildCf4Pdf } from './cf4Pdf';
import type { Cf4SummaryDraft } from './types';

function normalizedFieldName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valueForTemplateField(
  name: string,
  draft: Cf4SummaryDraft,
): string | undefined {
  const normalized = normalizedFieldName(name);
  const { patient } = draft;
  const physician = draft.request?.doctor;

  if (normalized.includes('patient') && normalized.includes('name')) return patient.name;
  if (
    normalized === 'age' ||
    normalized.endsWith('age') ||
    normalized.includes('patientage') ||
    normalized.includes('ageofpatient')
  ) {
    return patient.age === null ? undefined : String(patient.age);
  }
  if (
    normalized === 'sex' ||
    normalized.endsWith('sex') ||
    normalized === 'gender' ||
    normalized.includes('patientsex') ||
    normalized.includes('patientgender')
  ) {
    return patient.gender;
  }
  if (
    (normalized.includes('admission') || normalized.includes('admitted')) &&
    normalized.includes('date')
  ) {
    return patient.admissionDateRaw;
  }
  if (
    physician &&
    (normalized.includes('attendingphysician') ||
      normalized.includes('attendingdoctor') ||
      normalized.includes('attendinghealthcareprofessional') ||
      normalized === 'physician' ||
      normalized === 'doctor')
  ) {
    return physician;
  }
  return undefined;
}

/**
 * Populates recognizable AcroForm patient fields, preserves all original
 * template pages, and appends the populated Course-in-the-Ward supporting
 * document. Appending the summary also supports scanned/flattened templates.
 */
export async function buildExistingCf4Pdf(
  draft: Cf4SummaryDraft,
  evaluator: string,
  sourceFile: File,
  sourceFileName: string,
): Promise<{ bytes: Uint8Array; note: string }> {
  const template = await PDFDocument.load(await sourceFile.arrayBuffer());
  const form = template.getForm();
  const font = await template.embedFont(StandardFonts.Helvetica);
  let populatedFields = 0;

  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    const value = valueForTemplateField(field.getName(), draft);
    if (value === undefined) continue;
    const maxLength = field.getMaxLength();
    if (maxLength !== undefined && value.length > maxLength) continue;
    field.setText(value);
    populatedFields += 1;
  }
  form.updateFieldAppearances(font);

  const supportingDoc = buildCf4Pdf(
    draft,
    'existing-cf4',
    evaluator,
    sourceFileName,
  );
  const supporting = await PDFDocument.load(supportingDoc.output('arraybuffer'));
  const supportingPages = await template.copyPages(
    supporting,
    supporting.getPageIndices(),
  );
  supportingPages.forEach((page) => template.addPage(page));

  const bytes = await template.save();
  const note = populatedFields
    ? `Filled ${populatedFields} matching template field${populatedFields === 1 ? '' : 's'} and appended the Course in the Ward summary.`
    : 'The template has no recognizable fillable fields. Its original pages were preserved and a populated Course in the Ward summary was appended.';
  return { bytes, note };
}
