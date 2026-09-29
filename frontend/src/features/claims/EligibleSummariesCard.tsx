/** Part of the claims dashboard — see index.tsx for the screen shell. */

import { useCallback, useEffect, useState } from 'react';
import { Button, StatusBadge, type StatusValue } from '../../components/ui';
import { formatDateMedium } from '../../lib/format';
import { claimsApi } from '../../services/domainApi';
import type { EligibleSummary, SummaryStatus } from '../../types';
import { styles } from './styles';

const SUMMARY_BADGE: Record<SummaryStatus, { status: StatusValue; label: string }> = {
  DRAFT_AI: { status: 'draft', label: 'AI draft' },
  DRAFT_EDITED: { status: 'in-progress', label: 'Edited draft' },
  APPROVED: { status: 'approved', label: 'Approved' },
};

type EligibleSummariesCardProps = {
  /** Called after a claim is opened so the requests list can refresh. */
  onClaimCreated: () => void;
};

/**
 * Intake list: Course in the Ward summaries no claim has been opened for.
 * Opening a claim on an approved summary makes it ready for CF4 straight away;
 * on a draft it becomes a pending request addressed to the attending physician.
 */
export function EligibleSummariesCard({ onClaimCreated }: EligibleSummariesCardProps) {
  const [summaries, setSummaries] = useState<EligibleSummary[] | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    claimsApi
      .eligibleSummaries()
      .then(({ data }) => setSummaries(data))
      .catch(() => setSummaries([]));
  }, []);

  useEffect(load, [load]);

  const openClaim = async (summaryId: string) => {
    setCreatingId(summaryId);
    setError(null);
    try {
      await claimsApi.create(summaryId);
      setSummaries((previous) => previous?.filter((summary) => summary.id !== summaryId) ?? null);
      onClaimCreated();
    } catch {
      setError('Could not open a claim for that summary. Please try again.');
      load();
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <section style={{ ...styles.tableCard, marginBottom: 24 }}>
      <div style={{ padding: '16px 16px 8px' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
          Summaries without a claim
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
          Open a claim to review a Course in the Ward. Drafts are sent to the attending physician
          for approval.
        </p>
        {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#dc2626' }}>{error}</p>}
      </div>
      <table style={styles.table}>
        <thead>
          <tr style={styles.thRow}>
            <th style={styles.th}>Patient</th>
            <th style={styles.th}>Summary day</th>
            <th style={styles.th}>Physician</th>
            <th style={styles.th}>Status</th>
            <th style={{ ...styles.th, textAlign: 'right' }} />
          </tr>
        </thead>
        <tbody>
          {(summaries ?? []).map((summary) => {
            const badge = SUMMARY_BADGE[summary.status];
            const physician = summary.approvedBy ?? summary.orders[0]?.orderedBy;
            return (
              <tr key={summary.id} style={styles.tr}>
                <td style={styles.td}>
                  {summary.patient.firstName} {summary.patient.lastName}
                </td>
                <td style={styles.td}>{formatDateMedium(summary.summaryDate)}</td>
                <td style={styles.td}>
                  {physician ? `Dr. ${physician.firstName} ${physician.lastName}` : '—'}
                </td>
                <td style={styles.td}>
                  <StatusBadge status={badge.status} label={badge.label} />
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={creatingId === summary.id}
                    disabled={creatingId !== null}
                    onClick={() => void openClaim(summary.id)}
                  >
                    Open claim
                  </Button>
                </td>
              </tr>
            );
          })}
          {summaries !== null && summaries.length === 0 && (
            <tr>
              <td style={{ ...styles.td, fontSize: 13, color: '#64748b' }} colSpan={5}>
                Every summary already has a claim.
              </td>
            </tr>
          )}
          {summaries === null && (
            <tr>
              <td style={{ ...styles.td, fontSize: 13, color: '#64748b' }} colSpan={5}>
                Loading summaries…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
