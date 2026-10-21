/** Part of the claims dashboard — see index.tsx for the screen shell. */

import { useEffect, useMemo, useState } from 'react';

import { Button, Modal, StatusBadge } from '../../components/ui';
import type { Cf4SummaryDraft, ExportSource } from './types';
import { styles } from './styles';

type Cf4SummaryPreviewProps = {
  /** Every patient queued for CF4 generation, in the order the table showed them. */
  drafts: Cf4SummaryDraft[];
  /** Index of the patient currently on screen. */
  index: number;
  onIndexChange: (index: number) => void;
  /** Which export workflow produced these drafts. */
  source: ExportSource;
  /** Attending physician recorded on the JSON. */
  evaluator: string;
  /** Uploaded local PDF's name for the existing-CF4 workflow. */
  sourceFileName?: string;
  /** Uploaded existing CF4 PDF, retained locally for preview and population. */
  sourceFile?: File;
  /** Validation/confirmation message shown above the footer. */
  error?: string;
  onBack: () => void;
  onConfirm: () => void;
  confirming?: boolean;
};

/** `Juan Dela Cruz` → `JD`. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Review step between picking patients and generating the CF4: steps through
 * every queued patient and shows the Course in the Ward content plus the exact
 * JSON payload that will be written for it, so the processor can confirm before
 * anything is persisted.
 */
export function Cf4SummaryPreview({
  drafts,
  index,
  onIndexChange,
  source,
  evaluator,
  sourceFileName,
  sourceFile,
  error,
  onBack,
  onConfirm,
  confirming = false,
}: Cf4SummaryPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<'json' | 'pdf'>('json');
  const [rendered, setRendered] = useState<{
    draft: Cf4SummaryDraft;
    url: string;
    note?: string;
  } | null>(null);
  const [renderFailure, setRenderFailure] = useState<{
    draft: Cf4SummaryDraft;
    message: string;
  } | null>(null);
  const [downloadFailure, setDownloadFailure] = useState<{
    draft: Cf4SummaryDraft;
    message: string;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  /** Full-screen PDF viewer, opened by clicking the inline preview. */
  const [viewerOpen, setViewerOpen] = useState(false);

  const total = drafts.length;
  const activeIndex = total ? Math.min(Math.max(index, 0), total - 1) : 0;
  const active = drafts[activeIndex];
  const patient = active?.patient;
  const request = active?.request;

  const json = useMemo(() => {
    if (!patient) return '';
    const payload = {
      document: 'Course in the Ward Summary',
      formatVersion: '1.0',
      generatedAt: new Date().toISOString(),
      source: source === 'new-cf4' ? 'NEW_CF4' : 'EXISTING_CF4',
      ...(sourceFileName ? { sourceFile: sourceFileName } : {}),
      claim: {
        id: patient.claimId,
        status: request?.status ?? 'Pending Review',
      },
      patient: {
        id: patient.patientId,
        name: patient.name,
        sex: patient.gender,
        age: patient.age,
        admitted: patient.admissionDateRaw,
        daysInCare: patient.daysInCare,
        status: patient.status,
      },
      courseInTheWard: {
        summaryDate: request?.date ?? patient.admissionDate,
        text: request?.summaryText ?? '',
        orders: (request?.orders ?? []).map((order) => ({
          id: order.id,
          orderedAt: order.dateCreated,
          physician: order.doctor,
          order: order.content,
        })),
      },
      attendingPhysician: request?.doctor ?? evaluator,
      evaluator,
    };
    return JSON.stringify(payload, null, 2);
  }, [patient, request, evaluator, source, sourceFileName]);

  /* Build one document per draft. The preview and download both use this same
     Blob; a template PDF is retained and populated for the existing-CF4 flow. */
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        if (source === 'existing-cf4') {
          if (!sourceFile) throw new Error('Upload an existing CF4 PDF to populate.');
          const { buildExistingCf4Pdf } = await import('./existingCf4Pdf');
          const result = await buildExistingCf4Pdf(
            active,
            evaluator,
            sourceFile,
            sourceFileName ?? sourceFile.name,
          );
          const pdfBuffer = new ArrayBuffer(result.bytes.byteLength);
          new Uint8Array(pdfBuffer).set(result.bytes);
          const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          if (!cancelled) {
            setRendered({ draft: active, url, note: result.note });
          } else {
            URL.revokeObjectURL(url);
          }
          return;
        }

        const { buildCf4Pdf } = await import('./cf4Pdf');
        const doc = buildCf4Pdf(active, source, evaluator);
        const bytes = doc.output('arraybuffer');
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        if (!cancelled) {
          setRendered({ draft: active, url });
        } else {
          URL.revokeObjectURL(url);
        }
      } catch (cause) {
        if (!cancelled) {
          setRenderFailure({
            draft: active,
            message: cause instanceof Error
              ? `Could not prepare the PDF: ${cause.message}`
              : 'Could not prepare the PDF. Please try again.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, source, evaluator, sourceFileName, sourceFile, retryCount]);

  useEffect(() => {
    if (!rendered) return;
    return () => URL.revokeObjectURL(rendered.url);
  }, [rendered]);

  /* Ignore stale output while another patient/template is being prepared. */
  const pdf = rendered?.draft === active ? rendered : null;
  const pdfUrl = pdf?.url ?? null;
  const renderError =
    !pdf && renderFailure?.draft === active ? renderFailure.message : '';
  const downloadError =
    downloadFailure?.draft === active ? downloadFailure.message : '';
  const visibleError = downloadError || renderError;

  if (!patient) return null;

  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex < total - 1;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  /** Saves the exact document shown in the PDF preview tab. */
  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    try {
      link.href = pdfUrl;
      link.download = `${source === 'existing-cf4' ? 'completed-cf4' : 'course-in-the-ward'}-${patient.patientId}.pdf`;
      document.body.appendChild(link);
      link.click();
    } catch (cause) {
      setDownloadFailure({
        draft: active,
        message: cause instanceof Error
          ? `Could not download the PDF: ${cause.message}`
          : 'Could not download the PDF. Please try again.',
      });
    } finally {
      link.remove();
    }
  };

  return (
    <div style={styles.exportContainerCard}>
      <div style={styles.newCf4HeaderRow}>
        <button style={styles.backButton} onClick={onBack}>
          &lt; Back to Selection
        </button>
        <h3 style={styles.newCf4Title}>Course in the Ward Summary</h3>
        <div style={{ width: '120px' }} />
      </div>

      <div style={styles.summarySourceRow}>
        <span style={styles.summarySourceTag}>
          {source === 'new-cf4' ? 'New CF4' : 'Existing CF4'}
        </span>
        <span style={styles.summarySourceHint}>
          {total > 1
            ? `Review each selected patient below — one CF4 is generated per patient. The preview on the right shows the record that gets written for the Course in the Ward.`
            : 'Review the summary below. The preview on the right shows the record that gets written for the Course in the Ward; confirming generates the CF4 document.'}
        </span>
      </div>

      {visibleError && (
        <p style={styles.exportErrorBanner} role="alert">
          {visibleError}{' '}
          <button
            type="button"
            onClick={() => {
              setRenderFailure(null);
              setDownloadFailure(null);
              setRetryCount((count) => count + 1);
            }}
          >
            Retry PDF
          </button>
        </p>
      )}

      {total > 1 && (
        <>
          <div style={styles.summaryNavRow}>
            <span style={styles.summaryNavLabel}>
              Selected patients
              <span style={styles.summaryNavCount}>{total}</span>
            </span>
            <div style={styles.summaryNavControls}>
              <button
                type="button"
                className="ui-icon-btn"
                aria-label="Previous patient"
                disabled={!hasPrevious}
                onClick={() => onIndexChange(activeIndex - 1)}
              >
                ‹
              </button>
              <span style={styles.summaryNavPosition}>
                {activeIndex + 1} / {total}
              </span>
              <button
                type="button"
                className="ui-icon-btn"
                aria-label="Next patient"
                disabled={!hasNext}
                onClick={() => onIndexChange(activeIndex + 1)}
              >
                ›
              </button>
            </div>
          </div>

          <div style={styles.summaryChips}>
            {drafts.map((draft, draftIndex) => (
              <button
                key={draft.patient.id}
                type="button"
                aria-current={draftIndex === activeIndex}
                style={
                  draftIndex === activeIndex
                    ? { ...styles.summaryChip, ...styles.summaryChipActive }
                    : styles.summaryChip
                }
                onClick={() => onIndexChange(draftIndex)}
              >
                {draft.patient.name}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={styles.summaryPatientBanner}>
        <div style={styles.summaryAvatar}>{initialsOf(patient.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={styles.summaryPatientName}>{patient.name}</h4>
          <div style={styles.summaryPatientMeta}>
            <div style={styles.summaryMetaField}>
              <span style={styles.summaryMetaLabel}>Patient ID</span>
              <span style={styles.summaryMetaValue}>{patient.patientId}</span>
            </div>
            <div style={styles.summaryMetaField}>
              <span style={styles.summaryMetaLabel}>Sex</span>
              <span style={styles.summaryMetaValue}>{patient.gender}</span>
            </div>
            <div style={styles.summaryMetaField}>
              <span style={styles.summaryMetaLabel}>Age</span>
              <span style={styles.summaryMetaValue}>{patient.age ?? '—'}</span>
            </div>
            <div style={styles.summaryMetaField}>
              <span style={styles.summaryMetaLabel}>Admitted</span>
              <span style={styles.summaryMetaValue}>{patient.admissionDate}</span>
            </div>
            <div style={styles.summaryMetaField}>
              <span style={styles.summaryMetaLabel}>Days in care</span>
              <span style={styles.summaryMetaValue}>
                {patient.daysInCare} {patient.daysInCare === 1 ? 'day' : 'days'}
              </span>
            </div>
            <div style={styles.summaryMetaField}>
              <span style={styles.summaryMetaLabel}>Status</span>
              <StatusBadge status={patient.status} showDot />
            </div>
          </div>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryPanel}>
          <div style={styles.summaryPanelHeader}>
            <span style={styles.summaryPanelTitle}>Course in the Ward</span>
            <span style={styles.summaryPanelMeta}>
              {request ? `${request.date} · ${request.time}` : 'No persisted summary'}
            </span>
          </div>
          <div style={styles.summaryPanelBody}>
            {request?.summaryText ||
              'No Course in the Ward summary text is available for this patient yet.'}
          </div>
        </div>

        <div style={styles.summaryPanel}>
          <div style={styles.summaryPanelHeader}>
            <div style={styles.summaryPanelTabs}>
              <button
                type="button"
                aria-pressed={previewMode === 'json'}
                style={
                  previewMode === 'json'
                    ? { ...styles.summaryTab, ...styles.summaryTabActive }
                    : styles.summaryTab
                }
                onClick={() => setPreviewMode('json')}
              >
                JSON
              </button>
              <button
                type="button"
                aria-pressed={previewMode === 'pdf'}
                style={
                  previewMode === 'pdf'
                    ? { ...styles.summaryTab, ...styles.summaryTabActive }
                    : styles.summaryTab
                }
                onClick={() => setPreviewMode('pdf')}
              >
                PDF Preview
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {previewMode === 'json' && (
                <Button size="sm" variant="ghost" onClick={() => void handleCopy()}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleDownload} disabled={!pdf}>
                Download PDF
              </Button>
            </div>
          </div>

          {previewMode === 'json' ? (
            <pre style={styles.jsonPreview}>{json}</pre>
          ) : pdfUrl ? (
            /* An <iframe> swallows clicks, so a transparent button sits over it
               to open the enlarged viewer. */
            <div style={styles.pdfPreviewShell}>
              <iframe
                title={`CF4 preview for ${patient.name}`}
                src={pdfUrl}
                style={styles.pdfPreviewFrame}
              />
              <button
                type="button"
                style={styles.pdfPreviewHitArea}
                aria-label={`Open the full-size CF4 preview for ${patient.name}`}
                onClick={() => setViewerOpen(true)}
              >
                <span style={styles.pdfPreviewHint}>Click to enlarge</span>
              </button>
            </div>
          ) : (
            <div style={styles.pdfPreviewEmpty}>
              {renderError ? 'PDF preview unavailable. See the error above.' : 'Preparing preview…'}
            </div>
          )}
          {previewMode === 'pdf' && pdf?.note && (
            <p role="status" style={styles.summaryPanelMeta}>{pdf.note}</p>
          )}
        </div>
      </div>

      <Modal
        open={viewerOpen && Boolean(pdfUrl)}
        onClose={() => setViewerOpen(false)}
        size="xl"
        className="ui-modal--pdf"
        title="Course in the Ward — CF4 supporting document"
        description="Scroll to view every page. Click outside the document to close."
      >
        {pdfUrl ? (
          <iframe
            title={`Full-size CF4 preview for ${patient.name}`}
            src={pdfUrl}
            className="ui-modal__pdf-frame"
          />
        ) : null}
      </Modal>

      {error ? <p style={styles.exportErrorBanner}>{error}</p> : null}

      <div style={styles.summaryFooterRow}>
        <button style={styles.cancelBtn} onClick={onBack}>
          Back
        </button>
        <Button variant="primary" loading={confirming} onClick={onConfirm}>
          {total > 1 ? `Confirm & Generate ${total} CF4s` : 'Confirm & Generate CF4'}
        </Button>
      </div>
    </div>
  );
}
