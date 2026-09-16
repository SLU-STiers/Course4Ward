/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Award,
  BedDouble,
  ChartColumn,
  ClipboardList,
  FileText,
  LockKeyhole,
  Receipt,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';
import { adminApi } from '../../services/domainApi';
import { EmptyState, LoadingState, StatusBadge } from '../../components/ui';
import { actionMeta, roleLabel } from './activityLabels';
import { BarList, DonutChart, FunnelChart, StatRows, TrendChart } from './charts';
import { segmentColor } from './chartTheme';
import { styles } from './styles';
import type { ReportRangePreset as RangePreset } from './types';
import type { TrendBucket } from '../../types';

const RANGE_PRESETS: Array<{ value: RangePreset; label: string; hint: string }> = [
  { value: '7', label: '7 days', hint: 'last 7 days' },
  { value: '30', label: '30 days', hint: 'last 30 days' },
  { value: '90', label: '90 days', hint: 'last 90 days' },
  { value: 'all', label: 'All time', hint: 'all recorded activity' },
];

/**
 * Report groups. The panel sits in the dashboard's narrow right column, so the
 * cards are split into tabs rather than stacked into one long scroll — each tab
 * is a screenful, and the tab strip makes the rest one click away.
 */
type ReportTab = 'overview' | 'clinical' | 'orders' | 'census' | 'access' | 'accounts';

const TABS: Array<{ value: ReportTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'orders', label: 'Orders' },
  { value: 'census', label: 'Census' },
  { value: 'access', label: 'Access' },
  { value: 'accounts', label: 'Accounts' },
];

/** The trend granularity that keeps each preset readable. */
const PRESET_BUCKET: Record<RangePreset, TrendBucket> = {
  '7': 'day',
  '30': 'day',
  '90': 'week',
  all: 'month',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  TO_ACCOMPLISH: 'To accomplish',
  ONGOING: 'Ongoing',
  FINISHED: 'Finished',
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  ADMISSION: 'Admission order',
  DISCHARGE: 'Discharge order',
  DEFAULT: 'Standard order',
};

const SUMMARY_STATUS_LABELS: Record<string, string> = {
  DRAFT_AI: 'AI draft',
  DRAFT_EDITED: 'Edited draft',
  APPROVED: 'Approved',
};

const CF4_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const RESET_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Awaiting review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

const CLAIM_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Awaiting validation request',
  PHYSICIAN_VALIDATION_REQUESTED: 'Physician validation requested',
  VALIDATED: 'Validated',
  CF4_GENERATED: 'CF4 generated',
};

/**
 * Admin reporting panel.
 *
 * Two kinds of number appear here, and the copy is explicit about which is
 * which: *flow* counts cover the selected range ("orders written in the last 30
 * days"), while *state* distributions describe the database right now
 * ("pending claims"). Mixing them would make a 7-day filter look like the
 * hospital had no outstanding work.
 */
export function ReportingSection() {
  const [preset, setPreset] = useState<RangePreset>('30');
  const [tab, setTab] = useState<ReportTab>('overview');

  const range = useMemo(
    () => (preset === 'all' ? { from: '2000-01-01' } : { from: startOfPreset(preset) }),
    [preset],
  );
  const bucket = PRESET_BUCKET[preset];
  const rangeHint = RANGE_PRESETS.find((option) => option.value === preset)?.hint ?? '';

  const {
    data: summary,
    isPending: summaryPending,
    isError: summaryError,
  } = useQuery({
    queryKey: ['admin-report-summary', range],
    queryFn: () => adminApi.reportSummary(range).then((response) => response.data),
  });

  const { data: trend, isPending: trendPending } = useQuery({
    queryKey: ['admin-report-trend', range, bucket],
    queryFn: () => adminApi.activityTrend({ ...range, bucket }).then((response) => response.data),
  });

  if (summaryPending) return <LoadingState label="Building report..." />;
  if (summaryError || !summary) {
    return <EmptyState icon="⚠️" title="Report unavailable" hint="Could not load the statistics." />;
  }

  const logins = summary.activity.byAction.find((row) => row.key === 'LOGIN')?.count ?? 0;
  const totalCf4 = Object.values(summary.philhealthCf4.byStatus).reduce((a, b) => a + b, 0);
  const totalSummaries = Object.values(summary.summaries.byStatus).reduce((a, b) => a + b, 0);
  const totalClaims = summary.claims.byStatus.reduce((sum, row) => sum + row.count, 0);

  return (
    <section style={styles.reportSection} aria-label="Reporting">
      <div style={styles.reportHeader}>
        <div>
          <h3 style={styles.reportTitle}>Reporting</h3>
          {/* Per-card hints say whether a number is range-scoped ("in period")
              or a live snapshot ("current records"), so the header stays short. */}
          <p style={styles.reportSubtitle}>{rangeHint}</p>
        </div>
        <div style={styles.rangeGroup} role="group" aria-label="Reporting period">
          {RANGE_PRESETS.map((option) => (
            <button
              type="button"
              key={option.value}
              aria-pressed={preset === option.value}
              style={{
                ...styles.rangeButton,
                ...(preset === option.value ? styles.rangeButtonActive : {}),
              }}
              onClick={() => setPreset(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Headline numbers for the selected period */}
      <div className="admin-kpi-grid" style={styles.kpiGrid}>
        <Kpi label="Orders" value={summary.orders.inRange} hint={`${summary.orders.today} today`} />
        <Kpi
          label="Summaries"
          value={summary.summaries.inRange}
          hint={`${summary.summaries.byStatus.APPROVED} approved`}
        />
        <Kpi label="Claims" value={summary.claims.inRange} hint={`${totalClaims} in system`} />
        <Kpi
          label="CF4"
          value={summary.philhealthCf4.byStatus.APPROVED}
          hint={`${summary.philhealthCf4.byStatus.PENDING} pending`}
        />
        <Kpi
          label="Actions"
          value={summary.activity.total}
          hint={`${summary.activity.distinctActors} accounts`}
        />
        <Kpi
          label="Admitted"
          value={summary.census.activeAdmissions}
          hint={`${summary.census.admittedInRange} in period`}
        />
      </div>

      <div style={styles.tabBar} role="tablist" aria-label="Report sections">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={`report-tab-${option.value}`}
            aria-selected={tab === option.value}
            aria-controls="report-panel"
            style={{
              ...styles.tabButton,
              ...(tab === option.value ? styles.tabButtonActive : {}),
            }}
            onClick={() => setTab(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div
        id="report-panel"
        role="tabpanel"
        aria-labelledby={`report-tab-${tab}`}
        style={styles.reportGrid}
      >
        {tab === 'overview' ? (
          <>
            <ReportCard
              icon={<Activity size={14} aria-hidden="true" />}
              title="Activity volume"
              hint={`${bucketLabel(bucket)} buckets`}
            >
              {trendPending ? (
                <LoadingState label="Loading trend..." />
              ) : trend?.points.length ? (
                <TrendChart points={trend.points} />
              ) : (
                <p style={styles.reportEmpty}>No activity recorded in this period.</p>
              )}
            </ReportCard>

            <ReportCard
              icon={<ChartColumn size={14} aria-hidden="true" />}
              title="What users did"
              hint="logged actions in period"
            >
              <BarList
                rows={summary.activity.byAction}
                labelOf={(key) => actionMeta(key).label}
                limit={6}
                emptyLabel="No actions recorded yet."
              />
            </ReportCard>
          </>
        ) : null}

        {tab === 'clinical' ? (
          <>
            <ReportCard
              icon={<Workflow size={14} aria-hidden="true" />}
              title="Clinical workflow"
              hint="orders → summaries → claims"
            >
              <FunnelChart stages={summary.pipeline} />
            </ReportCard>

            <ReportCard
              icon={<FileText size={14} aria-hidden="true" />}
              title="Course in the Ward"
              hint="current records"
            >
              <DonutChart
                segments={orderRows(summary.summaries.byStatus, SUMMARY_STATUS_LABELS)}
                centerValue={String(totalSummaries)}
                centerLabel="summaries"
              />
            </ReportCard>
          </>
        ) : null}

        {tab === 'orders' ? (
          <>
            <ReportCard
              icon={<ClipboardList size={14} aria-hidden="true" />}
              title="Physician orders"
              hint="current records"
            >
              <StatRows
                rows={orderRows(summary.orders.byStatus, ORDER_STATUS_LABELS).map((segment) => ({
                  key: segment.key,
                  label: segment.label,
                  value: segment.value,
                  style: { color: segment.color },
                }))}
              />
              <StatRows
                rows={orderRows(summary.orders.byType, ORDER_TYPE_LABELS).map((segment) => ({
                  key: segment.key,
                  label: segment.label,
                  value: segment.value,
                }))}
              />
            </ReportCard>

            <ReportCard
              icon={<Receipt size={14} aria-hidden="true" />}
              title="Claims"
              hint="current records"
            >
              <StatRows
                rows={summary.claims.byStatus.map((row) => ({
                  key: row.key,
                  label: CLAIM_STATUS_LABELS[row.key] ?? row.key,
                  value: row.count,
                }))}
                emptyLabel="No claims filed yet."
              />
            </ReportCard>
          </>
        ) : null}

        {tab === 'census' ? (
          <>
            <ReportCard
              icon={<BedDouble size={14} aria-hidden="true" />}
              title="Patients & admissions"
              hint="current records"
            >
              <StatRows
                rows={[
                  { key: 'patients', label: 'Registered patients', value: summary.census.patients },
                  {
                    key: 'admissions',
                    label: 'Admissions on record',
                    value: summary.census.admissions,
                  },
                  {
                    key: 'active',
                    label: 'Currently admitted',
                    value: summary.census.activeAdmissions,
                    style: { color: 'var(--c4w-color-success, #15803d)' },
                  },
                  {
                    key: 'discharged',
                    label: 'Discharged',
                    value: summary.census.dischargedAdmissions,
                  },
                  {
                    key: 'staff',
                    label: 'Staff accounts (active)',
                    value: `${summary.users.active} / ${summary.users.total}`,
                  },
                ]}
              />
            </ReportCard>

            <ReportCard
              icon={<ShieldCheck size={14} aria-hidden="true" />}
              title="PhilHealth CF4"
              hint="current records"
            >
              <DonutChart
                segments={orderRows(summary.philhealthCf4.byStatus, CF4_STATUS_LABELS)}
                centerValue={String(totalCf4)}
                centerLabel="decisions"
              />
            </ReportCard>
          </>
        ) : null}

        {tab === 'access' ? (
          <>
            <ReportCard
              icon={<Users size={14} aria-hidden="true" />}
              title="Activity by role"
              hint="logged actions in period"
            >
              <DonutChart
                segments={summary.activity.byRole.map((row, index) => ({
                  key: row.key,
                  label: roleLabel(row.key),
                  value: row.count,
                  color: segmentColor(index),
                }))}
                centerValue={String(summary.activity.total)}
                centerLabel="actions"
              />
            </ReportCard>

            <ReportCard
              icon={<LockKeyhole size={14} aria-hidden="true" />}
              title="Access & security"
              hint="in period"
            >
              <StatRows
                rows={[
                  { key: 'logins', label: 'Sign-ins', value: logins },
                  {
                    key: 'actors',
                    label: 'Distinct accounts',
                    value: summary.activity.distinctActors,
                  },
                ]}
              />
              <StatRows
                rows={orderRows(summary.passwordResets.byStatus, RESET_STATUS_LABELS).map(
                  (segment) => ({
                    key: `reset-${segment.key}`,
                    label: `Reset · ${segment.label}`,
                    value: segment.value,
                  }),
                )}
                emptyLabel="No password reset requests."
              />
            </ReportCard>
          </>
        ) : null}

        {tab === 'accounts' ? (
          <ReportCard
            icon={<Award size={14} aria-hidden="true" />}
            title="Most active accounts"
            hint="in period"
          >
            {summary.topActors.length ? (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>User</th>
                    <th style={styles.th}>Role</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topActors.slice(0, 6).map((actor) => (
                    <tr key={actor.userId} style={styles.tr}>
                      <td style={{ ...styles.td, ...styles.cellStack }}>
                        <span style={styles.userNameCell}>{actor.name}</span>
                        <span style={styles.userLoginCell}>{actor.userId}</span>
                      </td>
                      <td style={styles.td}>
                        {actor.role ? (
                          <StatusBadge status="info" label={roleLabel(actor.role)} />
                        ) : (
                          roleLabel('unknown')
                        )}
                      </td>
                      <td style={styles.td}>{actor.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={styles.reportEmpty}>No activity in this period yet.</p>
            )}
          </ReportCard>
        ) : null}
      </div>
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div style={styles.kpiTile}>
      <span style={styles.kpiLabel} title={label}>
        {label}
      </span>
      <span style={styles.kpiValue}>{value}</span>
      <span style={styles.kpiHint}>{hint}</span>
    </div>
  );
}

function ReportCard({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <article style={styles.reportCard}>
      <div style={styles.reportCardHeader}>
        <span style={styles.reportCardIcon} aria-hidden="true">
          {icon}
        </span>
        <span style={styles.reportCardHeading}>
          <h4 style={styles.reportCardTitle}>{title}</h4>
          {hint ? <span style={styles.reportCardHint}>{hint}</span> : null}
        </span>
      </div>
      {children}
    </article>
  );
}

/** `{ STATUS: count }` -> ordered donut segments with friendly labels. */
function orderRows(map: Record<string, number>, labels: Record<string, string>) {
  return Object.keys(map).map((key, index) => ({
    key,
    label: labels[key] ?? key,
    value: map[key],
    color: segmentColor(index),
  }));
}

/** Trend bucket as it reads in the card subtitle. */
function bucketLabel(bucket: TrendBucket): string {
  return bucket === 'day' ? 'daily' : bucket === 'week' ? 'weekly' : 'monthly';
}

/** First day of the preset window, as `YYYY-MM-DD`. */
function startOfPreset(preset: RangePreset): string {
  const date = new Date();
  date.setDate(date.getDate() - (Number(preset) - 1));
  return toDateKey(date);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
