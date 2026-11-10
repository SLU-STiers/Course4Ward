/** Part of the claims dashboard — see index.tsx for the screen shell. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, StatusBadge, type StatusValue } from '../../components/ui';
import { formatDateMedium } from '../../lib/format';
import { ORDER_POLL_MS, usePolling } from '../../hooks/usePolling';
import { claimsApi } from '../../services/domainApi';
import { apiErrorMessage } from '../../lib/apiError';
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
 * Intake list: discharged stays whose Course in the Ward days still have no claim.
 * Requesting a claim sends every day of that stay to the attending physician,
 * or straight to CF4 when the summary is already approved.
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
  usePolling(load, ORDER_POLL_MS);

  const patients = useMemo(() => {
    const grouped = new Map<string, EligibleSummary[]>();
    for (const summary of summaries ?? []) {
      const rows = grouped.get(summary.patient.id) ?? [];
      rows.push(summary);
      grouped.set(summary.patient.id, rows);
    }
    return [...grouped.values()];
  }, [summaries]);

  const openClaim = async (rows: EligibleSummary[]) => {
    const patientId = rows[0]?.patient.id;
    if (!patientId) return;
    setCreatingId(patientId);
    setError(null);
    try {
      await claimsApi.createForStay(rows.map((summary) => summary.id));
      const claimed = new Set(rows.map((summary) => summary.id));
      setSummaries((previous) => previous?.filter((summary) => !claimed.has(summary.id)) ?? null);
      onClaimCreated();
    } catch (cause) {
      setError(apiErrorMessage(cause, 'Could not request a claim for that patient. Please try again.'));
      load();
      onClaimCreated();
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <section style={{ ...styles.tableCard, marginBottom: 24 }}>
      <div style={{ padding: '16px 16px 8px' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
          Discharged patients
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
          Request a claim for a discharged stay. Each Course in the Ward day is sent to the
          attending physician for approval.
        </p>
        {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#dc2626' }}>{error}</p>}
      </div>
      <table style={styles.table}>
        <thead>
          <tr style={styles.thRow}>
            <th style={styles.th}>Patient</th>
            <th style={styles.th}>Discharged</th>
            <th style={styles.th}>Physician</th>
            <th style={styles.th}>Course in the Ward</th>
            <th style={{ ...styles.th, textAlign: 'right' }} />
          </tr>
        </thead>
        <tbody>
          {patients.map((rows) => {
            const summary = rows[0];
            const physician =
              summary.orders[0]?.admission?.physician ??
              summary.approvedBy ??
              summary.orders[0]?.orderedBy;
            const dischargedOn = rows
              .map((row) => row.orders[0]?.admission?.dischargeDate)
              .filter((value): value is string => Boolean(value))
              .sort()
              .at(-1);
            const badge = SUMMARY_BADGE[summary.status];
            const dayLabel = `${rows.length} ${rows.length === 1 ? 'day' : 'days'}`;
            return (
              <tr key={summary.patient.id} style={styles.tr}>
                <td style={styles.td}>
                  {summary.patient.firstName} {summary.patient.lastName}
                </td>
                <td style={styles.td}>{dischargedOn ? formatDateMedium(dischargedOn) : '—'}</td>
                <td style={styles.td}>
                  {physician ? `Dr. ${physician.firstName} ${physician.lastName}` : '—'}
                </td>
                <td style={styles.td}>
                  <span style={{ marginRight: 8 }}>{dayLabel}</span>
                  <StatusBadge status={badge.status} label={badge.label} />
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={creatingId === summary.patient.id}
                    disabled={creatingId !== null}
                    onClick={() => void openClaim(rows)}
                  >
                    Request claim
                  </Button>
                </td>
              </tr>
            );
          })}
          {summaries !== null && patients.length === 0 && (
            <tr>
              <td style={{ ...styles.td, fontSize: 13, color: '#64748b' }} colSpan={5}>
                No discharged patient is waiting for a claim.
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
