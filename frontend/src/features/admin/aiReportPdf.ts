/**
 * Client-side PDF of the admin Reporting "AI" tab.
 *
 * Deliberately dumb: the AI tab hands over the very rows it shows on screen,
 * already formatted, plus a sentence describing each group — so the PDF can
 * never disagree with the panel. Loaded on demand (jsPDF is heavy).
 */

import { jsPDF } from 'jspdf';

export type ReportPdfSection = {
  title: string;
  /** What the numbers in this section mean, for a reader outside the system. */
  description: string;
  rows: Array<{ label: string; value: string | number }>;
  emptyLabel?: string;
};

const M = 48;
const INK = '#0f172a';
const GRAY = '#475569';
const FAINT = '#94a3b8';
const RULE = '#e2e8f0';

export function buildAiReportPdf(input: {
  period: string;
  sections: ReportPdfSection[];
}): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - M * 2;
  const labelW = contentW * 0.56;
  const valueW = contentW * 0.4;
  let y = M;

  const reserve = (needed: number) => {
    if (y + needed > pageH - M) {
      doc.addPage();
      y = M;
    }
  };

  /** Wrapped paragraph; `y` ends just below it. */
  const paragraph = (text: string, size: number, color: string, style = 'normal') => {
    /* splitTextToSize measures with the CURRENT font, so set it first. */
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(color);
    const lineH = size * 1.4;
    for (const line of doc.splitTextToSize(text, contentW) as string[]) {
      reserve(lineH);
      y += lineH;
      doc.text(line, M, y);
    }
  };

  const generatedAt = new Date().toLocaleString();
  doc.setProperties({ title: 'AI Statistics Report', subject: `Course4Ward · ${input.period}` });

  paragraph('AI Statistics Report', 18, INK, 'bold');
  paragraph('Course4Ward · SLU Sacred Heart CIMS · Admin reporting', 9, GRAY);
  paragraph(`Period: ${input.period} · Generated ${generatedAt}`, 9, GRAY);
  y += 8;
  paragraph(
    'This report describes how the AI components of Course4Ward performed: the language model ' +
      'that drafts each Course in the Ward summary from the accomplished physician orders of a day, ' +
      'and the embedding model that lets the system look up similar past orders as references ' +
      '(retrieval-augmented generation, RAG). Durations are measured over successful calls only; ' +
      'failed calls are counted separately.',
    9,
    INK,
  );

  for (const section of input.sections) {
    y += 16;
    reserve(70); // never leave a heading alone at the foot of a page
    paragraph(section.title, 12, INK, 'bold');
    paragraph(section.description, 8.5, GRAY);
    y += 6;

    if (!section.rows.length) {
      paragraph(section.emptyLabel ?? 'Nothing recorded in this period.', 9, FAINT, 'italic');
      continue;
    }

    doc.setFont('helvetica', 'normal').setFontSize(9);
    const lineH = 12;
    for (const row of section.rows) {
      const label = doc.splitTextToSize(row.label, labelW) as string[];
      const value = doc.splitTextToSize(String(row.value), valueW) as string[];
      const height = Math.max(label.length, value.length) * lineH + 6;
      reserve(height);
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(GRAY);
      doc.text(label, M, y + lineH, { lineHeightFactor: lineH / 9 });
      doc.setFont('helvetica', 'bold').setTextColor(INK);
      doc.text(value, pageW - M, y + lineH, { align: 'right', lineHeightFactor: lineH / 9 });
      y += height;
      doc.setDrawColor(RULE).setLineWidth(0.5);
      doc.line(M, y, pageW - M, y);
    }
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(FAINT);
    doc.text(`Course4Ward · AI Statistics Report · ${generatedAt}`, M, pageH - 24);
    doc.text(`Page ${page} of ${pages}`, pageW - M, pageH - 24, { align: 'right' });
  }

  return doc;
}
