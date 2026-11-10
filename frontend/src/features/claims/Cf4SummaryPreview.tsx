/** Part of the claims dashboard — see index.tsx for the screen shell. */

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Copy, Download, Maximize2, Minus, Plus, X } from 'lucide-react';

import { Button, Modal, StatusBadge } from '../../components/ui';
import { ORDER_TEXT_STYLE } from '../../components/orders/SubmittedOrdersTimeline';
import { OrderStatusSummary } from '../../components/orders/OrderStatusSummary';
import { formatDateMedium, formatTimeMedium } from '../../lib/format';
import { buildCf4Document, cf4FileName, saveFile } from './cf4Document';
import { courseEntries } from './mappers';
import type { Cf4SummaryDraft } from './types';
import { styles } from './styles';

type Cf4SummaryPreviewProps = {
  /** Every patient queued for CF4 generation, in the order the table showed it. */
  drafts: Cf4SummaryDraft[];
  /** Index of the patient currently on screen. */
  index: number;
  onIndexChange: (index: number) => void;
  /** Attending physician recorded on the document. */
  evaluator: string;
  /** Validation/confirmation message shown above the footer. */
  error?: string;
  /** Success message after part of the batch was generated. */
  notice?: string;
  onBack: () => void;
  /** Takes a patient out of this batch. */
  onRemove: (patientId: string) => void;
  /** Generates the CF4 for the chosen patients (`CF4Patient.id`). */
  onConfirm: (patientIds: string[]) => void;
  confirming?: boolean;
};

/** Width share (percent) the Course in the Ward panel may take. */
const SPLIT_MIN = 25;
const SPLIT_MAX = 75;
const COURSE_FONT_MIN = 11;
const COURSE_FONT_MAX = 18;
/** Below this width the panels stack instead of sitting side by side. */
const STACK_QUERY = '(max-width: 900px)';

function clampSplit(value: number): number {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));
}

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
 * every queued patient and shows the Course in the Ward for the whole stay
 * alongside the document before anything is persisted.
 */
export function Cf4SummaryPreview({
  drafts,
  index,
  onIndexChange,
  evaluator,
  error,
  notice,
  onBack,
  onRemove,
  onConfirm,
  confirming = false,
}: Cf4SummaryPreviewProps) {
  /** Days whose physician orders are shown under the summary. */
  const [openOrders, setOpenOrders] = useState<string[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rendered, setRendered] = useState<{
    draft: Cf4SummaryDraft;
    url: string;
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Patients ticked in the confirm dialog. */
  const [chosenIds, setChosenIds] = useState<string[]>([]);
  const chosen = drafts
    .map((draft) => draft.patient.id)
    .filter((id) => drafts.length === 1 || chosenIds.includes(id));
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  const [copied, setCopied] = useState(false);
  const [stacked, setStacked] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(STACK_QUERY).matches,
  );
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia(STACK_QUERY);
    const update = () => setStacked(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !splitRef.current) return;
    const box = splitRef.current.getBoundingClientRect();
    setSplit(clampSplit(((event.clientX - box.left) / box.width) * 100));
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const total = drafts.length;
  const activeIndex = total ? Math.min(Math.max(index, 0), total - 1) : 0;
  const active = drafts[activeIndex];
  const patient = active?.patient;
  const chart = active?.chart;

  /* Build one document per draft. The preview and download both use this same
     Blob, which is also exactly what confirming generates. */
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        const { blob } = await buildCf4Document(active, evaluator);
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
  }, [active, evaluator, retryCount]);

  useEffect(() => {
    if (!rendered) return;
    return () => URL.revokeObjectURL(rendered.url);
  }, [rendered]);

  /* Ignore stale output while another patient is being prepared. */
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

  const courseDays = courseEntries(active);

  const toggleOrders = (requestId: string) =>
    setOpenOrders((ids) =>
      ids.includes(requestId) ? ids.filter((id) => id !== requestId) : [...ids, requestId],
    );

  const handleCopy = () => {
    const text = courseDays.map((day) => `${day.dateLabel}\n${day.text}`).join('\n\n');
    void navigator.clipboard?.writeText(text).then(() => setCopied(true));
  };

  /** Saves the exact document shown in the preview. */
  const handleDownload = () => {
    if (!pdfUrl) return;
    try {
      saveFile(pdfUrl, cf4FileName(active));
    } catch (cause) {
      setDownloadFailure({
        draft: active,
        message: cause instanceof Error
          ? `Could not download the PDF: ${cause.message}`
          : 'Could not download the PDF. Please try again.',
      });
    }
  };

  return (
    <div style={styles.exportContainerCard}>
      <div style={styles.newCf4HeaderRow}>
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
          leadingIcon={<ArrowLeft size={15} aria-hidden="true" />}
          style={{ justifySelf: 'start' }}
        >
          Back
        </Button>
        <h3 style={styles.newCf4Title}>Course in the Ward Summary</h3>
        <span />
      </div>

      <div style={styles.summarySourceRow}>
        <span style={styles.summarySourceTag}>New CF4</span>
        <span style={styles.summarySourceHint}>
          {total > 1
            ? 'Review each selected patient below. One Course in the Ward PDF is generated per patient and covers that patient’s whole stay.'
            : 'Review the Course in the Ward for this patient’s whole stay. Confirming generates one PDF.'}
          {' '}Open a day’s orders to compare them with its summary.
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
              <span
                key={draft.patient.id}
                style={
                  draftIndex === activeIndex
                    ? { ...styles.summaryChip, ...styles.summaryChipActive, ...styles.summaryChipRemovable }
                    : { ...styles.summaryChip, ...styles.summaryChipRemovable }
                }
              >
                <button
                  type="button"
                  aria-current={draftIndex === activeIndex}
                  style={styles.summaryChipLabel}
                  disabled={confirming}
                  onClick={() => onIndexChange(draftIndex)}
                >
                  {draft.patient.name}
                </button>
                <button
                  type="button"
                  style={styles.summaryChipClose}
                  aria-label={`Remove ${draft.patient.name} from this CF4 batch`}
                  title="Remove from this batch"
                  disabled={confirming}
                  onClick={() => onRemove(draft.patient.id)}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
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
              <span style={styles.summaryMetaLabel}>Discharged</span>
              <span style={styles.summaryMetaValue}>
                {patient.dischargeDateRaw
                  ? formatDateMedium(new Date(`${patient.dischargeDateRaw}T12:00:00`))
                  : 'Still admitted'}
              </span>
            </div>
            <div style={styles.summaryMetaField}>
              <span style={styles.summaryMetaLabel}>Days in care</span>
              <span style={styles.summaryMetaValue}>
                {patient.daysInCare} {patient.daysInCare === 1 ? 'day' : 'days'}
              </span>
            </div>
            <div style={styles.summaryMetaField}>
              <span style={styles.summaryMetaLabel}>Attending</span>
              <span style={styles.summaryMetaValue}>{chart?.attending ?? '—'}</span>
            </div>
            <div style={styles.summaryMetaField}>
              <span style={styles.summaryMetaLabel}>Ward / room</span>
              <span style={styles.summaryMetaValue}>{chart?.location ?? '—'}</span>
            </div>
            <div style={styles.summaryMetaField}>
              <span style={styles.summaryMetaLabel}>Insurance</span>
              <span style={styles.summaryMetaValue}>{chart?.insurance ?? '—'}</span>
            </div>
            <div style={styles.summaryMetaField}>
              <span style={styles.summaryMetaLabel}>Status</span>
              <StatusBadge status={patient.status} showDot />
            </div>
          </div>
          {chart && (
            <>
              <Button
                size="sm"
                variant="ghost"
                style={styles.summaryDetailsToggle}
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((open) => !open)}
                leadingIcon={
                  detailsOpen
                    ? <ChevronUp size={14} aria-hidden="true" />
                    : <ChevronDown size={14} aria-hidden="true" />
                }
              >
                {detailsOpen ? 'Hide patient details' : 'More patient details'}
              </Button>
              {detailsOpen && (
                <div style={styles.summaryDetailsGrid}>
                  {([
                    ['Date of birth', chart.dateOfBirth],
                    ['Contact number', chart.contactNumber],
                    ['Address', chart.address],
                    ['Religion', chart.religion],
                    ['Emergency contact', chart.emergencyContact],
                    ['Patient class', chart.patientClass],
                    ['Triage', chart.triage],
                    ['Initial assessment', chart.assessment],
                  ] as const).map(([label, value]) => (
                    <div key={label} style={styles.summaryMetaField}>
                      <span style={styles.summaryMetaLabel}>{label}</span>
                      <span style={styles.summaryDetailsValue}>{value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div
        ref={splitRef}
        style={{
          ...styles.summarySplit,
          flexDirection: stacked ? 'column' : 'row',
          ...(stacked ? { height: 'auto', resize: 'none' } : null),
        }}
      >
        <div
          style={{
            ...styles.summaryPanel,
            ...(stacked ? styles.summaryPanelStacked : { flexBasis: `${split}%` }),
          }}
        >
          <div style={styles.summaryPanelHeader}>
            <span style={styles.summaryPanelTitle}>Course in the Ward</span>
            <div style={styles.summaryPanelActions}>
              <span style={styles.summaryPanelMeta}>{patient.coveragePeriod}</span>
              <button
                type="button"
                className="ui-icon-btn"
                aria-label="Smaller text"
                disabled={fontSize <= COURSE_FONT_MIN}
                onClick={() => setFontSize((size) => size - 1)}
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ui-icon-btn"
                aria-label="Larger text"
                disabled={fontSize >= COURSE_FONT_MAX}
                onClick={() => setFontSize((size) => size + 1)}
              >
                <Plus size={14} aria-hidden="true" />
              </button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopy}
                disabled={!active.courseText}
                leadingIcon={
                  copied
                    ? <Check size={14} aria-hidden="true" />
                    : <Copy size={14} aria-hidden="true" />
                }
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          <div
            className="ui-scroll"
            style={{ ...styles.summaryPanelBody, fontSize: `${fontSize}px` }}
          >
            {courseDays.map((day, dayIndex) => {
              const requestId = day.requestId;
              const ordersOpen = Boolean(requestId && openOrders.includes(requestId));
              return (
                <section key={requestId ?? `${day.dateLabel}-${dayIndex}`} style={styles.courseDay}>
                  <h4 style={styles.courseDayHeader}>
                    {courseDays.length > 1 && <span style={styles.courseDayNumber}>Day {dayIndex + 1}</span>}
                    {day.dateLabel}
                    {requestId && day.orders.length > 0 && (
                      <span style={styles.courseDayActions}>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-expanded={ordersOpen}
                          onClick={() => toggleOrders(requestId)}
                          leadingIcon={
                            ordersOpen
                              ? <ChevronUp size={14} aria-hidden="true" />
                              : <ChevronDown size={14} aria-hidden="true" />
                          }
                        >
                          {ordersOpen ? 'Hide orders' : `Orders (${day.orders.length})`}
                        </Button>
                      </span>
                    )}
                  </h4>
                  <p style={styles.courseDayText}>{day.text || 'No approved summaries for this stay.'}</p>
                  {ordersOpen && (
                    <ul style={styles.courseOrders}>
                      {day.orders.map((order) => (
                        <li key={order.id}>
                          <div style={styles.courseOrderMeta}>
                            {formatTimeMedium(order.dateCreated)} · {order.doctor}
                          </div>
                          <div style={ORDER_TEXT_STYLE}>{order.content}</div>
                          <OrderStatusSummary order={order} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        {!stacked && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panels"
            aria-valuemin={SPLIT_MIN}
            aria-valuemax={SPLIT_MAX}
            aria-valuenow={Math.round(split)}
            tabIndex={0}
            style={{
              ...styles.summarySplitDivider,
              ...(dragging ? styles.summarySplitDividerActive : null),
            }}
            onPointerDown={startDrag}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => setSplit(50)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') setSplit((value) => clampSplit(value - 5));
              if (event.key === 'ArrowRight') setSplit((value) => clampSplit(value + 5));
            }}
          >
            <span style={styles.summarySplitGrip} aria-hidden="true" />
          </div>
        )}

        <div
          style={{
            ...styles.summaryPanel,
            ...(stacked ? styles.summaryPanelStacked : { flexBasis: `${100 - split}%` }),
          }}
        >
          <div style={styles.summaryPanelHeader}>
            <span style={styles.summaryPanelTitle}>CF4 Preview</span>
            <div style={styles.summaryPanelActions}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setViewerOpen(true)}
                disabled={!pdf}
                leadingIcon={<Maximize2 size={14} aria-hidden="true" />}
              >
                View full PDF
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDownload}
                disabled={!pdf}
                leadingIcon={<Download size={14} aria-hidden="true" />}
              >
                Download
              </Button>
            </div>
          </div>

          {pdfUrl ? (
            <div style={styles.pdfPreviewShell}>
              <iframe
                title={`CF4 preview for ${patient.name}`}
                src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                style={{
                  ...styles.pdfPreviewFrame,
                  pointerEvents: dragging ? 'none' : 'auto',
                }}
              />
              <button
                type="button"
                className="claims-pdf-hit"
                style={styles.pdfPreviewHint}
                aria-label={`View the whole CF4 PDF for ${patient.name}`}
                onClick={() => setViewerOpen(true)}
              >
                <Maximize2 size={12} aria-hidden="true" />
                View whole PDF
              </button>
            </div>
          ) : (
            <div style={styles.pdfPreviewEmpty}>
              {renderError ? 'PDF preview unavailable. See the error above.' : 'Preparing preview…'}
            </div>
          )}
        </div>
      </div>
      {!stacked && (
        <p style={styles.summarySplitHint}>
          Drag the divider to resize the panels, or the bottom-right corner to change their height.
        </p>
      )}

      <Modal
        open={viewerOpen && Boolean(pdfUrl)}
        onClose={() => setViewerOpen(false)}
        size="xl"
        className="ui-modal--pdf"
        title={`Course in the Ward — ${patient.name}`}
        description="Scroll, zoom, or print from the viewer toolbar. Click outside the document to close."
        footer={
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownload}
            leadingIcon={<Download size={14} aria-hidden="true" />}
          >
            Download PDF
          </Button>
        }
      >
        {pdfUrl ? (
          <iframe
            title={`Full-size CF4 preview for ${patient.name}`}
            src={pdfUrl}
            className="ui-modal__pdf-frame"
          />
        ) : null}
      </Modal>

      {notice ? <p style={{ ...styles.exportSuccessBanner, margin: '16px 0 0' }} role="status">{notice}</p> : null}
      {error ? <p style={styles.exportErrorBanner}>{error}</p> : null}

      <div style={styles.summaryFooterRow}>
        <button style={styles.cancelBtn} onClick={onBack} disabled={confirming}>
          Back
        </button>
        <Button
          variant="primary"
          loading={confirming}
          disabled={confirming || !pdf}
          onClick={() => {
            setChosenIds(drafts.map((draft) => draft.patient.id));
            setConfirmOpen(true);
          }}
        >
          {total > 1 ? `Confirm & Generate ${total} CF4s` : 'Confirm & Generate CF4'}
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => { if (!confirming) setConfirmOpen(false); }}
        size={total > 1 ? 'md' : 'sm'}
        closeOnBackdrop={!confirming}
        title={total > 1 ? 'Choose whose CF4 to generate' : 'Generate CF4?'}
        description={
          total > 1
            ? 'Checked patients are marked as CF4 generated and their PDFs download. Unchecked patients stay in this batch.'
            : 'The claims are marked as CF4 generated and the Course in the Ward PDF downloads automatically.'
        }
        footer={
          <>
            {total > 1 && (
              <span style={styles.confirmFooterNote}>
                {chosen.length
                  ? `${chosen.length} PDF${chosen.length === 1 ? '' : 's'} will download`
                  : 'Select at least one patient'}
              </span>
            )}
            <Button variant="secondary" disabled={confirming} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={confirming}
              disabled={!chosen.length}
              leadingIcon={<Download size={14} aria-hidden="true" />}
              onClick={() => {
                setConfirmOpen(false);
                onConfirm(chosen);
              }}
            >
              {total > 1 ? `Generate & Download (${chosen.length})` : 'Generate & Download'}
            </Button>
          </>
        }
      >
        {total > 1 ? (
          <div style={styles.confirmChooser}>
            <label style={styles.confirmSelectAll}>
              <span style={styles.confirmSelectAllLeft}>
                <input
                  type="checkbox"
                  style={styles.confirmCheckbox}
                  checked={chosen.length === total}
                  ref={(input) => {
                    if (input) input.indeterminate = chosen.length > 0 && chosen.length < total;
                  }}
                  onChange={(event) =>
                    setChosenIds(event.target.checked ? drafts.map((draft) => draft.patient.id) : [])
                  }
                />
                Select all
              </span>
              <span style={styles.confirmCount}>{chosen.length} of {total} selected</span>
            </label>
            <ul style={styles.confirmList} className="ui-scroll">
              {drafts.map((draft) => {
                const checked = chosen.includes(draft.patient.id);
                const days = draft.patient.claimIds.length;
                return (
                  <li key={draft.patient.id}>
                    <label
                      style={checked ? { ...styles.confirmOption, ...styles.confirmOptionChecked } : styles.confirmOption}
                    >
                      <input
                        type="checkbox"
                        style={styles.confirmCheckbox}
                        checked={checked}
                        onChange={() =>
                          setChosenIds((ids) =>
                            ids.includes(draft.patient.id)
                              ? ids.filter((id) => id !== draft.patient.id)
                              : [...ids, draft.patient.id],
                          )
                        }
                      />
                      <span style={styles.confirmAvatar}>{initialsOf(draft.patient.name)}</span>
                      <span style={styles.confirmOptionText}>
                        <span style={styles.confirmOptionName}>{draft.patient.name}</span>
                        <span style={styles.confirmOptionMeta}>{draft.patient.coveragePeriod}</span>
                      </span>
                      <span style={styles.confirmOptionDays}>
                        {days} {days === 1 ? 'day' : 'days'}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div style={{ ...styles.confirmOption, ...styles.confirmOptionChecked, cursor: 'default' }}>
            <span style={styles.confirmAvatar}>{initialsOf(patient.name)}</span>
            <span style={styles.confirmOptionText}>
              <span style={styles.confirmOptionName}>{patient.name}</span>
              <span style={styles.confirmOptionMeta}>{patient.coveragePeriod}</span>
            </span>
            <span style={styles.confirmOptionDays}>
              {patient.claimIds.length} {patient.claimIds.length === 1 ? 'day' : 'days'}
            </span>
          </div>
        )}
      </Modal>
    </div>
  );
}
