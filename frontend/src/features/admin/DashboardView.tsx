/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, KeyRound, Clock3, ClipboardList } from 'lucide-react';
import { adminApi } from '../../services/domainApi';
import { styles } from './styles';

import { ActivityLogTable } from './ActivityLogTable';
import { ReportingSection } from './ReportingSection';

export function DashboardView() {
  // One request backs the four headline cards; the reporting section keeps its
  // own period selector, so it fetches its own window.
  const { data: report } = useQuery({
    queryKey: ['admin-report-summary', {}],
    queryFn: () => adminApi.reportSummary().then((response) => response.data),
  });

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
      </div>

      {/* Activity log on the left, reporting on the right — see
          `.admin-dashboard-columns` in `src/index.css`. */}
      <div className="admin-dashboard-columns">
        <ActivityLogTable />
        <ReportingSection />
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
}: {
  title: string;
  value: string;
  caption: string;
  icon: ReactNode;
}) {
  return (
    <article style={styles.metricCard}>
      <div style={styles.metricHeader}>
        <span style={styles.metricIcon} aria-hidden="true">
          {icon}
        </span>
        <span style={styles.metricTitle}>{title}</span>
      </div>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.metricTrend}>{caption}</div>
    </article>
  );
}