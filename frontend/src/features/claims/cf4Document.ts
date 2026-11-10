/** Builds and saves the CF4 document shared by the summary preview and confirmation. */

import type { Cf4SummaryDraft, ExportSource } from './types';

export type Cf4Document = { blob: Blob; note?: string };

export async function buildCf4Document(
  draft: Cf4SummaryDraft,
  source: ExportSource,
  evaluator: string,
  sourceFile?: File,
  sourceFileName?: string,
): Promise<Cf4Document> {
  if (source === 'existing-cf4') {
    if (!sourceFile) throw new Error('Upload an existing CF4 PDF to populate.');
    const { buildExistingCf4Pdf } = await import('./existingCf4Pdf');
    const result = await buildExistingCf4Pdf(
      draft,
      evaluator,
      sourceFile,
      sourceFileName ?? sourceFile.name,
    );
    const buffer = new ArrayBuffer(result.bytes.byteLength);
    new Uint8Array(buffer).set(result.bytes);
    return { blob: new Blob([buffer], { type: 'application/pdf' }), note: result.note };
  }

  const { buildCf4Pdf } = await import('./cf4Pdf');
  const bytes = buildCf4Pdf(draft, source, evaluator).output('arraybuffer');
  return { blob: new Blob([bytes], { type: 'application/pdf' }) };
}

export function cf4FileName(draft: Cf4SummaryDraft, source: ExportSource): string {
  const prefix = source === 'existing-cf4' ? 'completed-cf4' : 'course-in-the-ward';
  return `${prefix}-${draft.patient.patientId}.pdf`;
}

/** Saves a Blob or object URL under `fileName` through a temporary link. */
export function saveFile(target: Blob | string, fileName: string): void {
  const url = typeof target === 'string' ? target : URL.createObjectURL(target);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    /* Revoking immediately can cancel the download in some browsers. */
    if (typeof target !== 'string') window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
