/** Builds and saves the CF4 document shared by the summary preview and confirmation. */

import type { Cf4SummaryDraft } from './types';

export type Cf4Document = { blob: Blob; note?: string };

export async function buildCf4Document(
  draft: Cf4SummaryDraft,
  evaluator: string,
): Promise<Cf4Document> {
  const { buildCf4Pdf } = await import('./cf4Pdf');
  const bytes = buildCf4Pdf(draft, evaluator).output('arraybuffer');
  return { blob: new Blob([bytes], { type: 'application/pdf' }) };
}

export function cf4FileName(draft: Cf4SummaryDraft): string {
  return `course-in-the-ward-${draft.patient.patientId}.pdf`;
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
