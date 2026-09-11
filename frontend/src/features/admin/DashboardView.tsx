/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, KeyRound, Clock3, ClipboardList, TrendingUp } from 'lucide-react';
import { adminApi } from '../../services/domainApi';
import { DataTableToolbar } from '../../components/ui';
import { formatDateShort, formatTimeLocale } from '../../lib/format';
import { styles } from './styles';

import type { ActivityRow } from './types';

export function DashboardView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [sortField, setSortField] = useState<'id' | 'name' | 'date'>('id');
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending');
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const { data: logs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => adminApi.auditLogs({ take: 50 }).then((r) => r.data),
  });
  const { data: summary } = useQuery({
    queryKey: ['admin-analytics-summary'],
    queryFn: () => adminApi.analyticsSummary().then((r) => r.data),
  });
  const { data: ordersAnalytics } = useQuery({
    queryKey: ['admin-orders-analytics'],
    queryFn: () => adminApi.ordersAnalytics('day').then((r) => r.data),
  });

  const activityRows: ActivityRow[] = (logs ?? []).map((log: any, index: number) => {
        const date = new Date(log.timeStamp);
        return {
          id: String(index + 1).padStart(5, '0'),
          name: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System User',
          profession: log.user?.role || 'Doctor',
          date: formatDateShort(date),
          time: formatTimeLocale(date),
        };
      });
  const filteredActivity = activityRows
    .filter((row) =>
      `${row.id} ${row.name} ${row.profession}`.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (professionFilter === 'all' || row.profession.toLowerCase() === professionFilter.toLowerCase())
    )
    .sort((a, b) => {
      const comparison = a[sortField].localeCompare(b[sortField]);
      return sortDirection === 'ascending' ? comparison : -comparison;
    });
  const pageCount = Math.max(1, Math.ceil(filteredActivity.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * pageSize;
  const visibleActivity = filteredActivity.slice(pageStart, pageStart + pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* METRIC CARDS ROW */}
      <div style={styles.metricsGrid}>
        <MetricCard
          title="Total Users"
          value={String(summary?.totalUsers ?? 0)}
          trend={`${summary?.activeUsers ?? 0} active accounts`}
          icon={<Users size={24} strokeWidth={2} />}
        />
        <MetricCard
          title="Pending Resets"
          value={String(summary?.pendingResets ?? 0)}
          trend="Awaiting admin review"
          icon={<KeyRound size={24} strokeWidth={2} />}
        />
        <MetricCard
          title="Summaries Pending"
          value={String(summary?.pendingSummaries ?? 0)}
          trend={`${summary?.approvedSummaries ?? 0} approved`}
          icon={<Clock3 size={24} strokeWidth={2} />}
        />
        <MetricCard
          title="Orders Today"
          value={String(ordersAnalytics?.[0]?.count ?? 0)}
          trend="Latest daily bucket"
          icon={<ClipboardList size={24} strokeWidth={2} />}
        />
      </div>

      {/* ACTIVITY LOGS SECTION */}
      <div style={styles.cardContainer}>
        {/* Table Filters Bar */}
        <div style={{ ...styles.activityHeader, flexDirection: 'column', alignItems: 'stretch' }}>
          <h3 style={styles.tableTitle}>Activity Logs</h3>
          <DataTableToolbar
            className="admin-activity-toolbar"
            searchProps={{
              value: searchTerm,
              onChange: (value) => { setSearchTerm(value); setPage(1); },
              placeholder: 'Search activity logs...',
              ariaLabel: 'Search activity logs',
            }}
            filterProps={{
              title: 'Profession',
              options: [
                { value: 'all', label: 'All professions' },
                { value: 'PHYSICIAN', label: 'Physician' },
                { value: 'NURSE', label: 'Nurse' },
                { value: 'CLAIMS_PROCESSOR', label: 'Claims processor' },
                { value: 'ADMIN', label: 'Admin' },
              ],
              value: professionFilter,
              onChange: (value) => { setProfessionFilter(value); setPage(1); },
            }}
            sortProps={{
              title: 'Sort activity logs by',
              options: [
                { value: 'id', label: 'ID' },
                { value: 'name', label: 'Name' },
                { value: 'date', label: 'Date' },
              ],
              value: sortField,
              onChange: (value) => { setSortField(value as typeof sortField); setPage(1); },
              direction: sortDirection,
              onDirectionChange: (direction) => { setSortDirection(direction); setPage(1); },
            }}
          />
        </div>

        {/* Activity Table */}
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>NAME</th>
              <th style={styles.th}>PROFESSION</th>
              <th style={styles.th}>DATE</th>
              <th style={styles.th}>TIME</th>
            </tr>
          </thead>
          <tbody>
            {visibleActivity.map((row) => (
              <MockLogRow key={row.id} {...row} />
            ))}
            {!visibleActivity.length && <tr><td style={styles.td} colSpan={5}>No activity logs found.</td></tr>}
          </tbody>
        </table>
        <div style={styles.activityPagination}>
          <span style={styles.paginationInfo}>Showing {filteredActivity.length ? pageStart + 1 : 0} to {Math.min(pageStart + pageSize, filteredActivity.length)} of {filteredActivity.length} logs</span>
          <div style={styles.paginationControls}>
            <button type="button" style={styles.pageNumberButton} disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button type="button" key={pageNumber} style={{ ...styles.pageNumberButton, ...(safePage === pageNumber ? styles.pageNumberActive : {}) }} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
            ))}
            <button type="button" style={styles.pageNumberButton} disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
function MockLogRow({ id, name, profession, date, time }: any) {
  return (
    <tr style={styles.tr}>
      <td style={styles.td}>{id}</td>
      <td style={styles.td}>{name}</td>
      <td style={styles.td}>{profession}</td>
      <td style={styles.td}>{date}</td>
      <td style={styles.td}>{time}</td>
    </tr>
  );
}
function MetricCard({ title, value, trend, icon }: { title: string; value: string; trend: string; icon: ReactNode }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricHeader}>
        <div style={styles.metricIcon}>{icon}</div>
        <div style={styles.metricCopy}>
          <div style={styles.metricTitle}>{title}</div>
          <div style={styles.metricValue}>{value}</div>
        </div>
      </div>
      <div style={styles.metricTrend}>
        <TrendingUp size={14} aria-hidden="true" /> {trend}
      </div>
    </div>
  );
}

/* ==========================================================================
   USERS MANAGEMENT PANEL
   ========================================================================== */
