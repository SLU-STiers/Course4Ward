/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, KeyRound, Clock3, ClipboardList, CalendarX } from 'lucide-react';
import { adminApi } from '../../services/domainApi';
import { styles } from './styles';

import { ActivityLogTable } from './ActivityLogTable';
import { ReportingSection, type ReportTab } from './ReportingSection';

export function DashboardView() {
  // One request backs the four headline cards; the reporting section keeps its
  // own period selector, so it fetches its own window.
  const { data: report } = useQuery({
    queryKey: ['admin-report-summary', {}],
    queryFn: () => adminApi.reportSummary().then((response) => response.data),
  });
  // Same query key as the AI tab's card, so the tile and the list share one fetch.
  const { data: missed } = useQuery({
    queryKey: ['admin-missed-summaries'],
    queryFn: () => adminApi.missedSummaries().then((response) => response.data),
  });
  const missedDays = new Set(missed?.map((row) => row.day)).size;
  const [reportTab, setReportTab] = useState<ReportTab>('overview');
  const [focusMissed, setFocusMissed] = useState(false);

  return (
    <div style={styles.dashboardStack}>
      {/* METRIC CARDS ROW */}
      <div style={styles.metricsGrid}>
        <MetricCard
          title="Total Users"
          value={String(report?.users.total ?? 0)}
          caption={`${report?.users.active ?? 0} active accounts`}
          icon={<Users size={18} strokeWidth={2} />}
        />
        <MetricCard
          title="Pending Resets"
          value={String(report?.passwordResets.byStatus.PENDING ?? 0)}
          caption="Awaiting admin review"
          icon={<KeyRound size={18} strokeWidth={2} />}
        />
        <MetricCard
          title="Summaries Pending"
          value={String(report?.summaries.byStatus.DRAFT_AI ?? 0)}
          caption={`${report?.summaries.byStatus.APPROVED ?? 0} approved`}
          icon={<Clock3 size={18} strokeWidth={2} />}
        />
        <MetricCard
          title="Orders Today"
          value={String(report?.orders.today ?? 0)}
          caption="Written since midnight"
          icon={<ClipboardList size={18} strokeWidth={2} />}
        />
        <MetricCard
          title="Missed Batches"
          value={String(missedDays)}
          caption={missedDays ? `Days never summarized · ${missed?.length} patient-days` : 'Nightly runs on track'}
          icon={<CalendarX size={18} strokeWidth={2} />}
          onClick={() => {
            setReportTab('ai');
            setFocusMissed(true);
          }}
        />
      </div>

      {/* Activity log on the left, reporting on the right — see
          `.admin-dashboard-columns` in `src/index.css`. */}
      <div className="admin-dashboard-columns">
        <ActivityLogTable />
        <ReportingSection
          tab={reportTab}
          onTabChange={(tab) => {
            setReportTab(tab);
            setFocusMissed(false);
          }}
          focusMissed={focusMissed}
        />
      </div>
    </div>
  );
}
/**
 * A headline number for the current period.
 *
 * `caption` is deliberately a descriptive line rather than a percentage delta:
 * the API reports point-in-time counts, so a "+12%" chip would be invented.
 */
function MetricCard({
  title,
  value,
  caption,
  icon,
  onClick,
}: {
  title: string;
  value: string;
  caption: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div style={styles.metricHeader}>
        <span style={styles.metricIcon} aria-hidden="true">
          {icon}
        </span>
        <span style={styles.metricTitle}>{title}</span>
      </div>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.metricTrend}>{caption}</div>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      style={{ ...styles.metricCard, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
    >
      {body}
    </button>
  ) : (
    <article style={styles.metricCard}>{body}</article>
  );
}