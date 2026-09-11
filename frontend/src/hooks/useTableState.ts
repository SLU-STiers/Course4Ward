import { useCallback, useEffect, useMemo, useState } from 'react';

export type SortDirection = 'ascending' | 'descending';

export interface SortState {
  field: string;
  direction: SortDirection;
}

export interface TableStateConfig<T> {
  items: T[];
  pageSize?: number;
  /** Initial free-text query. */
  initialQuery?: string;
  /** Extracts the strings that participate in free-text search. */
  searchFields?: (item: T) => Array<string | number | null | undefined>;
  /** Predicate per named filter. Keys map to `filterProps` values. */
  filterPredicates?: Record<string, (item: T, value: string) => boolean>;
  initialFilters?: Record<string, string>;
  /** Comparand extractors per sortable field. */
  sorters?: Record<string, (item: T) => string | number>;
  initialSort?: SortState;
}

export interface TableState<T> {
  query: string;
  setQuery: (query: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  sort: SortState;
  setSort: (sort: SortState) => void;
  setSortField: (field: string) => void;
  toggleSortDirection: () => void;
  page: number;
  setPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  pageSize: number;
  pageCount: number;
  /** Rows for the current page. */
  rows: T[];
  /** Rows after search + filters + sort, before pagination. */
  filtered: T[];
  total: number;
  /** 1-based inclusive bounds of the visible page (0 when empty). */
  rangeStart: number;
  rangeEnd: number;
}

const DEFAULT_SORT: SortState = { field: '', direction: 'ascending' };

/**
 * Shared search / filter / sort / pagination state for every data table.
 *
 * Usage:
 * ```tsx
 * const table = useTableState({
 *   items: requests,
 *   pageSize: 8,
 *   searchFields: (r) => [r.id, r.patient.name],
 *   filterPredicates: { status: (r, v) => v === 'all' || r.status === v },
 *   initialFilters: { status: 'all' },
 *   sorters: { id: (r) => r.id, date: (r) => r.date },
 *   initialSort: { field: 'date', direction: 'descending' },
 * });
 * ```
 * `table.rows` is ready to render; the handlers wire straight into
 * `<DataTableToolbar />` and `<Pagination />`.
 */
export function useTableState<T>(config: TableStateConfig<T>): TableState<T> {
  const {
    items,
    pageSize: configuredPageSize = 8,
    initialQuery = '',
    searchFields,
    filterPredicates,
    initialFilters = {},
    sorters = {},
    initialSort = DEFAULT_SORT,
  } = config;
  const pageSize = Math.max(1, configuredPageSize);

  const [query, setQueryState] = useState(initialQuery);
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  const [sort, setSortState] = useState<SortState>(initialSort);
  const [page, setPageState] = useState(1);

  const setQuery = useCallback((next: string) => {
    setQueryState(next);
    setPageState(1);
  }, []);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPageState(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setQueryState('');
    setPageState(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSort = useCallback((next: SortState) => {
    setSortState(next);
    setPageState(1);
  }, []);

  const setSortField = useCallback((field: string) => {
    setSortState((previous) => ({
      field,
      direction: previous.field === field ? previous.direction : 'ascending',
    }));
    setPageState(1);
  }, []);

  const toggleSortDirection = useCallback(() => {
    setSortState((previous) => ({
      ...previous,
      direction: previous.direction === 'ascending' ? 'descending' : 'ascending',
    }));
    setPageState(1);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let result = items;

    if (needle) {
      result = result.filter((item) => {
        const values = searchFields
          ? searchFields(item)
          : [Object.values(item as Record<string, unknown>).join(' ')];
        return values.some((value) => String(value ?? '').toLowerCase().includes(needle));
      });
    }

    if (filterPredicates) {
      for (const [key, predicate] of Object.entries(filterPredicates)) {
        const value = filters[key];
        if (value === undefined || value === '') continue;
        result = result.filter((item) => predicate(item, value));
      }
    }

    return result;
  }, [items, query, searchFields, filterPredicates, filters]);

  const sorted = useMemo(() => {
    const extractor = sort.field ? sorters[sort.field] : undefined;
    if (!extractor) return filtered;
    const factor = sort.direction === 'ascending' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = extractor(a);
      const right = extractor(b);
      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * factor;
      }
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * factor;
    });
  }, [filtered, sort, sorters]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));

  // Keep the page within bounds when the dataset shrinks.
  useEffect(() => {
    if (page > pageCount) setPageState(pageCount);
  }, [page, pageCount]);

  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const rows = useMemo(() => sorted.slice(start, start + pageSize), [sorted, start, pageSize]);

  const setPage = useCallback(
    (next: number) => {
      setPageState(Math.min(Math.max(1, next), pageCount));
    },
    [pageCount],
  );

  const nextPage = useCallback(() => setPage(safePage + 1), [safePage, setPage]);
  const previousPage = useCallback(() => setPage(safePage - 1), [safePage, setPage]);

  return {
    query,
    setQuery,
    filters,
    setFilter,
    resetFilters,
    sort,
    setSort,
    setSortField,
    toggleSortDirection,
    page: safePage,
    setPage,
    nextPage,
    previousPage,
    pageSize,
    pageCount,
    rows,
    filtered: sorted,
    total: sorted.length,
    rangeStart: sorted.length ? start + 1 : 0,
    rangeEnd: Math.min(start + pageSize, sorted.length),
  };
}
