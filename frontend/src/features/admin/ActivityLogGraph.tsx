/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/domainApi';
import { LoadingState } from '../../components/ui';
import { actionMeta } from './activityLabels';
import { BarList, ColumnChart } from './charts';
import { styles } from './styles';
import type { ActivityLogFilters } from './types';
import type { AuditLogGroupBy } from '../../types';

const DIMENSIONS: Array<{ value: AuditLogGroupBy; label: string; hint: string }> = [
  { value: 'day', label: 'By day', hint: 'actions per UTC day' },
  { value: 'action', label: 'By action', hint: 'what was done' },
  { value: 'actor', label: 'By user', hint: 'who did it' },
];

/**
 * The Activity Logs graph view.
 *
 * It reuses the table's filters verbatim and counts the whole matching set on
 * the server, so a bar here can never disagree with the "of N logs" the table
 * reports. When the bucket list is capped the chart says so rather than passing
 * a partial series off as the whole picture.
 */
export function ActivityLogGraph({ filters }: { filters: ActivityLogFilters }) {
  const [by, setBy] = useState<AuditLogGroupBy>('day');

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin-activity-aggregate', by, filters],
    queryFn: () => adminApi.auditLogAggregate({ ...filters, by }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const dimension = DIMENSIONS.find((option) => option.value === by) ?? DIMENSIONS[0];
  const buckets = data?.buckets ?? [];
  const total = data?.total ?? 0;

  return (
    <div style={styles.graphWrap}>
      <div style={styles.graphHeader}>
        <div style={styles.rangeGroup} role="group" aria-label="Group activity by">
          {DIMENSIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              aria-pressed={by === option.value}
              style={{
                ...styles.rangeButton,
                ...(by === option.value ? styles.rangeButtonActive : {}),
              }}
              onClick={() => setBy(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span style={styles.graphSummary}>
          <strong>{total}</strong> {total === 1 ? 'action' : 'actions'} · {dimension.hint}
        </span>
      </div>

      {isPending ? (
        <LoadingState label="Counting activity..." />
      ) : isError ? (
        <div role="alert" style={styles.reportEmpty}>
          Could not build the graph
          {error instanceof Error ? `: ${error.message}` : '.'}{' '}
          <button type="button" style={styles.clearFiltersButton} onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : by === 'day' ? (
        <ColumnChart points={buckets} emptyLabel="No activity matches these filters." />
      ) : (
        <BarList
          rows={buckets}
          labelOf={by === 'action' ? (key) => actionMeta(key).label : undefined}
          emptyLabel="No activity matches these filters."
        />
      )}

      {data?.truncated ? (
        <p style={styles.graphNote}>
          Showing the {by === 'day' ? 'most recent' : 'largest'} {buckets.length} groups of {total}.
        </p>
      ) : null}
    </div>
  );
}
