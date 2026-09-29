/** Part of the claims dashboard — see index.tsx for the screen shell. */

import { useMemo, useState } from 'react';

import { Button, StatusBadge } from '../../components/ui';
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
  error,
  onBack,
  onConfirm,
  confirming = false,
}: Cf4SummaryPreviewProps) {
  const [copied, setCopied] = useState(false);

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

  const handleDownload = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `course-in-the-ward-${patient.patientId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
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
            ? `Review each selected patient below — one CF4 is generated per patient. The JSON on the right is what gets written for the Course in the Ward.`
            : 'Review the summary below. The JSON on the right is what gets written for the Course in the Ward; confirming generates the CF4 document.'}
        </span>
      </div>

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
            <span style={styles.summaryPanelTitle}>JSON File Preview</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="sm" variant="ghost" onClick={() => void handleCopy()}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDownload}>
                Download
              </Button>
            </div>
          </div>
          <pre style={styles.jsonPreview}>{json}</pre>
        </div>
      </div>

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
