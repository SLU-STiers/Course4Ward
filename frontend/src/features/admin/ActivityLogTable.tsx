/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/domainApi';
import { DataTableToolbar, LoadingState, StatusBadge } from '../../components/ui';
import { daysAgoValue, formatDateShort, formatTimeLocale, todayValue } from '../../lib/format';
import { ACTION_FILTER_OPTIONS, actionMeta, roleLabel } from './activityLabels';
import { styles } from './styles';
import { ActivityLogGraph } from './ActivityLogGraph';
import type {
  ActionFilter,
  ActivityLogFilters,
  ActivityLogView,
  ActivityRangePreset as RangePreset,
  RoleFilter,
} from './types';
import type { AuditLogQuery } from '../../types';

const PAGE_SIZE = 10;

const ACTIVITY_VIEWS: Array<{ value: ActivityLogView; label: string }> = [
  { value: 'table', label: 'Table' },
  { value: 'graph', label: 'Graph' },
];

/**
 * Activity Logs.
 *
 * The old table showed only a row number, a name and a timestamp — the stored
 * action was fetched and then dropped, so the screen could not answer "what did
 * this user actually do?". This table shows the action (with its meaning), the
 * actor's login id and the real log id, and it filters/pages on the server so
 * it covers every log in the database instead of the newest 50 rows.
 *
 * Sorting is intentionally absent: the log is inherently a chronological
 * record, and re-sorting a single page client-side would be misleading.
 */
export function ActivityLogTable() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<number | undefined>(undefined);
  const [action, setAction] = useState<ActionFilter>('all');
  const [role, setRole] = useState<RoleFilter>('all');
  const [rangePreset, setRangePreset] = useState<RangePreset>('any');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ActivityLogView>('table');

  const range = useMemo(
    () => resolveRange(rangePreset, customFrom, customTo),
    [rangePreset, customFrom, customTo],
  );

  /**
   * The filters both views share. Built once so the graph counts exactly the
   * rows the table lists — switching views can never change the data set.
   */
  const filters = useMemo<ActivityLogFilters>(
    () => ({
      ...(action === 'all' ? {} : { action }),
      ...(role === 'all' ? {} : { role }),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...range,
    }),
    [action, role, search, range],
  );

  const query = useMemo<AuditLogQuery>(
    () => ({ skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, ...filters }),
    [page, filters],
  );

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-activity-logs', query],
    queryFn: () => adminApi.auditLogs(query).then((response) => response.data),
    placeholderData: keepPreviousData,
    // The graph owns the panel in graph view; no point paging rows nobody sees.
    enabled: view === 'table',
  });

  // Debounced in the handler rather than in an effect, and every filter change
  // resets the page offset at the same time — so no state-sync effect is needed.
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  };

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, total);
  const hasFilters =
    action !== 'all' || role !== 'all' || Boolean(search.trim()) || rangePreset !== 'any';

  const clearFilters = () => {
    window.clearTimeout(searchTimer.current);
    setSearchInput('');
    setSearch('');
    setAction('all');
    setRole('all');
    setRangePreset('any');
    setCustomFrom('');
    setCustomTo('');
    setPage(1);
  };

  return (
    <div style={styles.cardContainer}>
      <div style={styles.activityHeader}>
        <div style={styles.activityTitleRow}>
          <div>
            <h3 style={styles.tableTitle}>Activity Logs</h3>
          </div>
          <div style={styles.rangeGroup} role="group" aria-label="Activity view">
            {ACTIVITY_VIEWS.map((option) => (
              <button
                type="button"
                key={option.value}
                aria-pressed={view === option.value}
                style={{
                  ...styles.rangeButton,
                  ...(view === option.value ? styles.rangeButtonActive : {}),
                }}
                onClick={() => setView(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <DataTableToolbar
          className="admin-activity-toolbar"
          searchProps={{
            value: searchInput,
            onChange: handleSearchChange,
            placeholder: 'Search by name, login id or action...',
            ariaLabel: 'Search activity logs',
          }}
          filters={[
            {
              label: 'Action',
              title: 'What was done',
              options: [{ value: 'all', label: 'All actions' }, ...ACTION_FILTER_OPTIONS],
              value: action,
              onChange: (value) => {
                setAction(value as ActionFilter);
                setPage(1);
              },
            },
            {
              label: 'Role',
              title: 'Actor role',
              options: [
                { value: 'all', label: 'All roles' },
                { value: 'PHYSICIAN', label: 'Physician' },
                { value: 'NURSE', label: 'Nurse' },
                { value: 'CLAIMS_PROCESSOR', label: 'Claims processor' },
                { value: 'ADMIN', label: 'Admin' },
              ],
              value: role,
              onChange: (value) => {
                setRole(value as RoleFilter);
                setPage(1);
              },
            },
            {
              label: 'Date range',
              title: 'Logged between',
              options: [
                { value: 'any', label: 'Any time' },
                { value: '7', label: 'Last 7 days' },
                { value: '30', label: 'Last 30 days' },
                { value: '90', label: 'Last 90 days' },
              ],
              value: rangePreset,
              onChange: (value) => {
                setRangePreset(value as RangePreset);
                setPage(1);
              },
              extra: (
                <div style={styles.filterExtra}>
                  <span style={styles.filterExtraLabel}>Custom</span>
                  <input
                    type="date"
                    aria-label="From date"
                    style={styles.dateInput}
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(event) => {
                      setCustomFrom(event.target.value);
                      setRangePreset('custom');
                      setPage(1);
                    }}
                  />
                  <span style={styles.filterExtraLabel}>to</span>
                  <input
                    type="date"
                    aria-label="To date"
                    style={styles.dateInput}
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(event) => {
                      setCustomTo(event.target.value);
                      setRangePreset('custom');
                      setPage(1);
                    }}
                  />
                </div>
              ),
            },
          ]}
          activeFilterCount={
            (action === 'all' ? 0 : 1) + (role === 'all' ? 0 : 1) + (rangePreset === 'any' ? 0 : 1)
          }
        >
          {hasFilters ? (
            <button type="button" style={styles.clearFiltersButton} onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </DataTableToolbar>
      </div>

      {view === 'graph' ? (
        <ActivityLogGraph filters={filters} />
      ) : isPending ? (
        <LoadingState label="Loading activity logs..." />
      ) : isError ? (
        <div role="alert" style={styles.reportEmpty}>
          Could not load activity logs
          {error instanceof Error ? `: ${error.message}` : '.'}{' '}
          <button type="button" style={styles.clearFiltersButton} onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Styling for the rows (edge alignment + hover) lives in
              `src/index.css` under `.admin-log-table`; inline styles cannot
              express `:hover`. */}
          <div style={{ ...styles.tableScroll, opacity: isFetching ? 0.6 : 1 }}>
            <table className="admin-log-table" aria-label="Activity log entries">
              <thead>
                <tr>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Log ID</th>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => {
                  const timestamp = new Date(entry.timeStamp);
                  const meta = actionMeta(entry.action);
                  return (
                    <tr key={entry.id}>
                      <td>
                        <span style={styles.cellStack}>
                          <span style={styles.userNameCell}>{formatDateShort(timestamp)}</span>
                          <span style={styles.userLoginCell}>{formatTimeLocale(timestamp)}</span>
                        </span>
                      </td>
                      <td>
                        <span style={styles.logIdChip} title={entry.id}>
                          {entry.id.slice(0, 8)}
                        </span>
                      </td>
                      <td>
                        <span style={styles.logActorCell}>
                          <span style={styles.logAvatar} aria-hidden="true">
                            {initials(entry.user.firstName, entry.user.lastName)}
                          </span>
                          <span style={styles.cellStack}>
                            <span style={styles.userNameCell}>
                              {entry.user.firstName} {entry.user.lastName}
                            </span>
                            <span style={styles.userLoginCell}>{entry.user.userId}</span>
                          </span>
                        </span>
                      </td>
                      <td>{roleLabel(entry.user.role)}</td>
                      <td title={meta.description}>
                        <StatusBadge status={meta.badge} label={meta.label} />
                      </td>
                    </tr>
                  );
                })}
                {!items.length && (
                  <tr>
                    <td colSpan={5} style={styles.emptyCell}>
                      {hasFilters
                        ? 'No activity matches these filters.'
                        : 'No activity recorded yet — actions appear here as soon as users sign in or write orders.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={styles.activityPagination}>
            <span style={styles.paginationInfo}>
              Showing {rangeStart}–{rangeEnd} of {total} logs
            </span>
            <div style={styles.paginationControls} role="group" aria-label="Activity log pages">
              <button
                type="button"
                style={styles.pageNumberButton}
                disabled={safePage === 1}
                aria-label="Previous page"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                ‹
              </button>
              {pageNumbers(safePage, pageCount).map((pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  style={{
                    ...styles.pageNumberButton,
                    ...(safePage === pageNumber ? styles.pageNumberActive : {}),
                  }}
                  aria-current={safePage === pageNumber ? 'page' : undefined}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                style={styles.pageNumberButton}
                disabled={safePage === pageCount}
                aria-label="Next page"
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              >
                ›
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Date bounds for the current preset, as `YYYY-MM-DD` (the API reads them as UTC days). */
function resolveRange(preset: RangePreset, customFrom: string, customTo: string) {
  if (preset === 'custom') {
    return {
      ...(customFrom ? { from: customFrom } : {}),
      ...(customTo ? { to: customTo } : {}),
    };
  }
  if (preset === 'any') return {};
  const days = Number(preset);
  return { from: daysAgoValue(days - 1), to: todayValue() };
}

/** Up to five page buttons around the current page. */
function pageNumbers(page: number, pageCount: number): number[] {
  const windowSize = Math.min(5, pageCount);
  const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), pageCount - windowSize + 1));
  return Array.from({ length: windowSize }, (_, index) => start + index);
}

/** Initials for the actor avatar — one per name, at most two. */
function initials(firstName: string, lastName: string): string {
  const first = firstName.trim()[0] ?? '';
  const last = lastName.trim()[0] ?? '';
  return `${first}${last}`.toUpperCase() || '—';
}
