/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useEffect, useMemo, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useAuthStore } from '../../store/authStore';
import { courseInWardApi, ordersApi, patientsApi } from '../../services/domainApi';
import type { CourseInWard, PhysicianOrder } from '../../types';
import { Button, DataTableToolbar, StatusBadge } from '../../components/ui';
import { PatientTablePagination, patientTableStyles } from '../../components/patientList/PatientTable';
import { SubmittedOrdersTimeline } from '../../components/orders/SubmittedOrdersTimeline';
import { useTableState } from '../../hooks/useTableState';
import llamaIcon from '../../Img/llama.png';
import {
  formatDateLongFromKey,
  toDateInputValue,
  toDateKey,
  todayValue,
} from '../../lib/format';
import { manage } from './styles';

import { CalendarModal } from './CalendarModal';
import { ADMISSION_FILTER_PRESETS, AGE_BANDS, DAYS_IN_CARE_BANDS, MANAGE_FILTER_KEYS, admissionMatches, customRangeValue, orderDayValue, parseCustomRange } from './filters';
import { mapPatient } from './patient';
import type { DashboardPatient } from './types';

/** Epoch millis of an order timestamp; an unparseable timestamp sorts first. */
function orderMillis(order: PhysicianOrder) {
  const time = new Date(order.dateCreated).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * The order day a Course in the Ward belongs to: the day of the orders it was
 * built from, falling back to its `summaryDate` when nothing is linked yet.
 */
function summaryDayKey(summary: CourseInWard): string {
  const days = (summary.orders ?? [])
    .map((order) => toDateKey(order.dateCreated))
    .filter(Boolean)
    .sort();
  return days[0] ?? toDateKey(summary.summaryDate);
}

/** Merge fresh summary rows into one newest-day-first list, replacing by id. */
function mergeSummaries(existing: CourseInWard[] | undefined, incoming: CourseInWard[]) {
  const byId = new Map((existing ?? []).map((summary) => [summary.id, summary]));
  for (const summary of incoming) byId.set(summary.id, summary);
  return [...byId.values()].sort(
    (a, b) => new Date(b.summaryDate).getTime() - new Date(a.summaryDate).getTime(),
  );
}

/** Header badge per summary status. */
const SUMMARY_BADGE: Record<CourseInWard["status"], string> = {
  DRAFT_AI: "AI Draft ready",
  DRAFT_EDITED: "Edited draft",
  APPROVED: "Approved",
};

export function ManageView() {
  const user = useAuthStore((s) => s.user);
  const [patients, setPatients] = useState<DashboardPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [editingOrders, setEditingOrders] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ordersByPatient, setOrdersByPatient] = useState<
    Record<string, PhysicianOrder[]>
  >({});
  const [draft, setDraft] = useState("");
  /** Every Course in the Ward loaded for a patient — one summary per order day. */
  const [summariesByPatient, setSummariesByPatient] = useState<
    Record<string, CourseInWard[]>
  >({});
  const [editingSummary, setEditingSummary] = useState(false);
  /**
   * Working copy of the day's summary while it is being edited. Keyed by day so
   * an unfinished edit can never surface under another day's heading.
   */
  const [summaryDraft, setSummaryDraft] = useState<
    { day: string; text: string } | null
  >(null);
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);
  /** A day with no Course in the Ward yet is generating its first one. */
  const [generatingSummary, setGeneratingSummary] = useState(false);
  /** Order-date filter (`YYYY-MM-DD`); `null` means unfiltered — every order. */
  const [orderDateFilter, setOrderDateFilter] = useState<string | null>(null);
  /**
   * Order day the AI panel is showing (`YYYY-MM-DD`). Kept separate from the
   * order list's filter so the summaries can be read day by day while the list
   * stays on "all order dates".
   */
  const [summaryDayFilter, setSummaryDayFilter] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // This tab only manages patients who are currently in the ward.
  const admittedPatients = useMemo(
    () => patients.filter((p) => p.status === "admitted"),
    [patients],
  );

  useEffect(() => {
    patientsApi
      .assignedToMe()
      .then(({ data }) => {
        const mapped = data.map(mapPatient);
        setPatients(mapped);
        const firstAdmitted = mapped.find((p) => p.status === "admitted");
        if (firstAdmitted) setSelectedId(firstAdmitted.id);
      })
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  // Shared search / filter / sort / pagination state for the patient list.
  const table = useTableState<DashboardPatient>({
    items: admittedPatients,
    pageSize: 8,
    searchFields: (p) => [p.name, p.gender],
    filterPredicates: {
      gender: (p, value) => value === "all" || p.gender.toLowerCase() === value,
      age: (p, value) =>
        value === "all" ||
        (p.age !== null &&
          (AGE_BANDS.find((band) => band.value === value)?.test(p.age) ?? true)),
      days: (p, value) =>
        value === "all" ||
        (DAYS_IN_CARE_BANDS.find((band) => band.value === value)?.test(
          p.daysInCare,
        ) ?? true),
      admitted: (p, value) => admissionMatches(p, value),
    },
    initialFilters: { gender: "all", age: "all", days: "all", admitted: "all" },
    sorters: {
      name: (p) => p.name,
      admitted: (p) => p.admissionDateRaw,
      days: (p) => p.daysInCare,
      age: (p) => p.age ?? -1,
    },
    initialSort: { field: "admitted", direction: "descending" },
  });

  // Keep the selection on a patient that still matches the active filters.
  const selected =
    table.filtered.find((p) => p.id === selectedId) ??
    table.rows[0] ??
    table.filtered[0];

  useEffect(() => {
    if (!selected) return;
    Promise.all([
      ordersApi.forPatient(selected.id),
      courseInWardApi.forPatient(selected.id),
    ])
      .then(([ordersResponse, summariesResponse]) => {
        setOrdersByPatient((previous) => ({
          ...previous,
          [selected.id]: ordersResponse.data,
        }));
        // Drop a date filter this patient has no orders on, so the filter state
        // never disagrees with what the list is showing.
        const loadedDays = new Set(
          ordersResponse.data.map((order) => orderDayValue(order.dateCreated)),
        );
        setOrderDateFilter((previous) =>
          previous && !loadedDays.has(previous) ? null : previous,
        );
        // One Course in the Ward per order day; the panel picks the day to show.
        setSummariesByPatient((previous) => ({
          ...previous,
          [selected.id]: summariesResponse.data,
        }));
      })
      .catch(() => undefined);
  }, [selected?.id]);

  const selectedOrders = selected ? ordersByPatient[selected.id] : undefined;
  const allOrders = useMemo(() => selectedOrders ?? [], [selectedOrders]);
  // Orders bucketed per calendar day — the unit a doctor's order is filed under.
  // Each bucket is oldest-first so one day reads like an order sheet.
  const ordersByDay = useMemo(() => {
    const map = new Map<string, PhysicianOrder[]>();
    for (const order of allOrders) {
      const day = orderDayValue(order.dateCreated);
      if (!day) continue;
      const bucket = map.get(day);
      if (bucket) bucket.push(order);
      else map.set(day, [order]);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => orderMillis(a) - orderMillis(b));
    }
    return map;
  }, [allOrders]);
  // Only dates that actually hold orders are browsable in the calendar.
  const orderDays = useMemo(
    () => Array.from(ordersByDay.keys()).sort(),
    [ordersByDay],
  );

  // A filter only sticks to a date this patient actually has orders on, so the
  // list always has something to show.
  const activeOrderDate =
    orderDateFilter && ordersByDay.has(orderDateFilter) ? orderDateFilter : null;
  const displayedOrders = activeOrderDate
    ? allOrders.filter((order) => orderDayValue(order.dateCreated) === activeOrderDate)
    : allOrders;
  // --- AI summary, filed per order day -------------------------------------
  // A patient accumulates one Course in the Ward per order day. For a day that
  // has several, the live draft wins over the approved record, so editing
  // continues where the physician left off.
  const summariesByDay = useMemo(() => {
    const map = new Map<string, CourseInWard>();
    for (const entry of (selected && summariesByPatient[selected.id]) || []) {
      const day = summaryDayKey(entry);
      if (!day) continue;
      const current = map.get(day);
      if (!current) map.set(day, entry);
      else if (current.status === "APPROVED" && entry.status !== "APPROVED") {
        map.set(day, entry);
      }
    }
    return map;
  }, [selected?.id, summariesByPatient]);

  // Which day's summary is on screen. Its own cursor, so "all order dates" can be
  // read day by day without the list ever leaving that view; picking a day for
  // the orders (calendar or order arrows) brings the summary along. Falls back to
  // the most recent day carrying a summary, then the newest day with orders.
  const daysWithSummary = orderDays.filter((day) => summariesByDay.has(day));
  const summaryDay =
    (summaryDayFilter && orderDays.includes(summaryDayFilter)
      ? summaryDayFilter
      : null) ??
    activeOrderDate ??
    daysWithSummary[daysWithSummary.length - 1] ??
    orderDays[orderDays.length - 1] ??
    null;
  const summary = summaryDay ? summariesByDay.get(summaryDay) : undefined;
  const summaryText =
    summaryDraft && summaryDay && summaryDraft.day === summaryDay
      ? summaryDraft.text
      : (summary?.summaryContent ?? "");

  // An unfinished edit belongs to the day it was started on; leaving that day
  // (or the patient) drops it and returns to a plain read.
  useEffect(() => {
    setEditingSummary(false);
    setSummaryDraft(null);
  }, [selected?.id, summaryDay]);

  // Choosing a day for the orders focuses the summary on it too — the calendar
  // picker and the order arrows both land here.
  useEffect(() => {
    if (activeOrderDate) setSummaryDayFilter(activeOrderDate);
  }, [activeOrderDate]);

  const admissionFilter = table.filters.admitted ?? "all";
  const customRange = parseCustomRange(admissionFilter);
  const admissionPreset = admissionFilter.startsWith("custom:")
    ? "custom"
    : admissionFilter;
  const activeFilterCount = MANAGE_FILTER_KEYS.filter((key) => {
    const value = table.filters[key];
    return value !== undefined && value !== "" && value !== "all";
  }).length;

  const openPatient = (id: string, edit = false) => {
    setSelectedId(id);
    setEditingSummary(false);
    setDraft("");
    setSubmitted(false);
    setEditingOrders(edit);
    setCalendarOpen(false);
  };

  const addOrder = () => {
    const text = draft.trim();
    if (!text) return;
    if (!selected || !selected.admissions?.[0] || !user) return;
    ordersApi
      .create({
        admissionId: selected.admissions[0].id,
        orderedById: user.id,
        orderContent: text,
      })
      .then(({ data }) => {
        setOrdersByPatient((prev) => ({
          ...prev,
          [selected.id]: [...(prev[selected.id] ?? []), data],
        }));
        setDraft("");
        setSubmitted(false);
        if (activeOrderDate) {
          setOrderDateFilter(orderDayValue(data.dateCreated) || todayValue());
        }
      })
      .catch(() => undefined);
  };

  const updateOrder = (orderId: string, text: string) => {
    if (!selected) return;
    setOrdersByPatient((prev) => ({
      ...prev,
      [selected.id]: (prev[selected.id] ?? []).map((order) =>
        order.id === orderId ? { ...order, orderContent: text } : order,
      ),
    }));
    setSubmitted(false);
  };

  const removeOrder = (orderId: string) => {
    if (!selected) return;
    setOrdersByPatient((prev) => ({
      ...prev,
      [selected.id]: (prev[selected.id] ?? []).filter(
        (order) => order.id !== orderId,
      ),
    }));
    setSubmitted(false);
  };

  /** Refresh the per-patient summary list with a row the API just returned. */
  const replaceSummary = (patientId: string, updated: CourseInWard) => {
    setSummariesByPatient((previous) => ({
      ...previous,
      [patientId]: mergeSummaries(previous[patientId], [updated]),
    }));
  };

  // Generate (or refresh) ONE order day's Course in the Ward. The AI summarizes
  // per admission-day, so the AI panel's Generate button and Submit are the same
  // call from two entry points: Generate acts on the day on screen, Submit on the
  // day in focus ("all dates": the most recent day written).
  const generateSummaryForDay = (day: string, onDone?: () => void) => {
    if (!selected || generatingSummary) return;
    setGeneratingSummary(true);
    void courseInWardApi
      .generate(selected.id, day)
      .then(({ data }) => {
        setSummariesByPatient((previous) => ({
          ...previous,
          [selected.id]: mergeSummaries(previous[selected.id], data),
        }));
        setEditingSummary(false);
        setSummaryDraft(null);
        onDone?.();
      })
      .catch(() => undefined)
      .finally(() => setGeneratingSummary(false));
  };

  const submitOrders = () => {
    if (!selected || !orderDays.length) return;
    const targetDay =
      activeOrderDate ?? summaryDay ?? orderDays[orderDays.length - 1];
    setSubmitted(false);
    generateSummaryForDay(targetDay, () => {
      // Show the summary that was just filed, without pulling the order list out
      // of "all dates".
      setSummaryDayFilter(targetDay);
      setEditingOrders(false);
      setSubmitted(true);
    });
  };

  if (loading)
    return (
      <div style={{ color: "#64748b", padding: 24 }}>
        Loading assigned patients...
      </div>
    );

  const selectedDateLabel = activeOrderDate
    ? new Date(`${activeOrderDate}T00:00:00`).toLocaleDateString("en-GB")
    : "All dates";
  // Open the calendar on whatever the physician is looking at, defaulting to the
  // most recent day that has orders.
  const calendarFocusDate = new Date(
    `${activeOrderDate ?? orderDays[orderDays.length - 1] ?? todayValue()}T00:00:00`,
  );
  // Order dates are the only navigable stops — order-less days are skipped. With
  // "all dates" showing, the first step focuses the day at that end of the
  // timeline (‹ the most recent, › the earliest), so day-by-day reading never
  // needs a trip to the calendar.
  const hasPrevOrderDay =
    orderDays.length > 0 &&
    (!activeOrderDate || orderDays.some((day) => day < activeOrderDate));
  const hasNextOrderDay =
    orderDays.length > 0 &&
    (!activeOrderDate || orderDays.some((day) => day > activeOrderDate));
  const goToAdjacentOrderDay = (direction: -1 | 1) => {
    if (!orderDays.length) return;
    if (!activeOrderDate) {
      setOrderDateFilter(
        direction < 0 ? orderDays[orderDays.length - 1] : orderDays[0],
      );
      return;
    }
    const candidates = orderDays.filter((day) =>
      direction < 0 ? day < activeOrderDate : day > activeOrderDate,
    );
    if (!candidates.length) return;
    setOrderDateFilter(
      direction < 0 ? candidates[candidates.length - 1] : candidates[0],
    );
  };
  const prevDayLabel = activeOrderDate
    ? "Previous day with orders"
    : "Focus the most recent day";
  const nextDayLabel = activeOrderDate
    ? "Next day with orders"
    : "Focus the earliest day";

  // The AI panel keeps its OWN day cursor, so every day's summary can be read
  // while the order list stays on "all dates".
  const hasPrevSummaryDay =
    !!summaryDay && orderDays.some((day) => day < summaryDay);
  const hasNextSummaryDay =
    !!summaryDay && orderDays.some((day) => day > summaryDay);
  const goToAdjacentSummaryDay = (direction: -1 | 1) => {
    if (!summaryDay) return;
    const candidates = orderDays.filter((day) =>
      direction < 0 ? day < summaryDay : day > summaryDay,
    );
    if (!candidates.length) return;
    setSummaryDayFilter(
      direction < 0 ? candidates[candidates.length - 1] : candidates[0],
    );
  };

  return (
    <Group
      orientation="horizontal"
      id="physician-manage"
      style={manage.layout}
    >
      {/* Both columns start the same size and stay user-resizable — drag the
          handle (or focus it and use the arrow keys) to trade width between the
          patient list and the chart. */}
      <Panel
        id="patients"
        defaultSize="50"
        minSize="360px"
        style={manage.panelFill}
      >
        <section style={manage.listCard}>
          <div style={manage.listHeader}>
            <div>
              <h2 style={manage.listTitle}>Patients List</h2>
              <p style={manage.listHint}>
                Showing active patients currently admitted only.
              </p>
            </div>
          </div>

          <DataTableToolbar
            searchProps={{
              value: table.query,
              onChange: table.setQuery,
              placeholder: "Search patient...",
              ariaLabel: "Search patients",
            }}
            filters={[
              {
                label: "Sex",
                title: "Sex",
                options: [
                  { value: "all", label: "All" },
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ],
                value: table.filters.gender ?? "all",
                onChange: (value) => table.setFilter("gender", value),
              },
              {
                label: "Age",
                title: "Age",
                options: AGE_BANDS.map((band) => ({
                  value: band.value,
                  label: band.label,
                })),
                value: table.filters.age ?? "all",
                onChange: (value) => table.setFilter("age", value),
              },
              {
                label: "Days in care",
                title: "Days in care",
                options: DAYS_IN_CARE_BANDS.map((band) => ({
                  value: band.value,
                  label: band.label,
                })),
                value: table.filters.days ?? "all",
                onChange: (value) => table.setFilter("days", value),
              },
              {
                label: "Admission date",
                title: "Admission date",
                options: ADMISSION_FILTER_PRESETS,
                value: admissionPreset,
                onChange: (value) =>
                  table.setFilter(
                    "admitted",
                    value === "custom"
                      ? admissionFilter.startsWith("custom:")
                        ? admissionFilter
                        : customRangeValue("", "")
                      : value,
                  ),
                extra: (
                  <div style={manage.filterRange}>
                    <label style={manage.filterRangeField}>
                      <span style={manage.filterRangeLabel}>From</span>
                      <input
                        type="date"
                        value={customRange.from}
                        onChange={(event) =>
                          table.setFilter(
                            "admitted",
                            customRangeValue(event.target.value, customRange.to),
                          )
                        }
                        style={manage.filterRangeInput}
                      />
                    </label>
                    <label style={manage.filterRangeField}>
                      <span style={manage.filterRangeLabel}>To</span>
                      <input
                        type="date"
                        value={customRange.to}
                        onChange={(event) =>
                          table.setFilter(
                            "admitted",
                            customRangeValue(
                              customRange.from,
                              event.target.value,
                            ),
                          )
                        }
                        style={manage.filterRangeInput}
                      />
                    </label>
                  </div>
                ),
              },
            ]}
            activeFilterCount={activeFilterCount}
            sortProps={{
              title: "Sort patients by",
              options: [
                { value: "admitted", label: "Admission date" },
                { value: "days", label: "Days in care" },
                { value: "age", label: "Age" },
                { value: "name", label: "Patient name" },
              ],
              value: table.sort.field,
              onChange: table.setSortField,
              direction: table.sort.direction,
              onDirectionChange: (direction) =>
                table.setSort({ field: table.sort.field, direction }),
            }}
          >
            {activeFilterCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={table.resetFilters}>
                Clear filters ({activeFilterCount})
              </Button>
            ) : null}
          </DataTableToolbar>
          <div style={manage.tableScroll}>
            <table style={{ ...patientTableStyles.table, tableLayout: "auto" }}>
              <thead>
                <tr style={patientTableStyles.thRow}>
                  <th style={patientTableStyles.th}>Patient</th>
                  <th style={patientTableStyles.th}>Sex</th>
                  <th style={patientTableStyles.th}>Age</th>
                  <th style={patientTableStyles.th}>Admitted</th>
                  <th style={patientTableStyles.th}>Days in care</th>
                  <th style={patientTableStyles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((p) => {
                  const active = p.id === selected?.id;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => openPatient(p.id, false)}
                      style={{
                        ...patientTableStyles.tr,
                        backgroundColor: active ? "#f1f5f9" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <td style={patientTableStyles.td}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <span
                            style={{
                              ...patientTableStyles.dot,
                              backgroundColor:
                                p.status === "discharged"
                                  ? "#ef4444"
                                  : "#22c55e",
                            }}
                          />
                          <span style={patientTableStyles.name}>{p.name}</span>
                        </div>
                      </td>
                      <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>
                        {p.gender}
                      </td>
                      <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>
                        {p.age ?? "—"}
                      </td>
                      <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>
                        {p.admissionDate}
                      </td>
                      <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>
                        {p.daysInCare} {p.daysInCare === 1 ? "day" : "days"}
                      </td>
                      <td style={patientTableStyles.td}>
                        <StatusBadge status={p.status} showDot />
                      </td>
                    </tr>
                  );
                })}
                {!table.rows.length && (
                  <tr>
                    <td
                      style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}
                      colSpan={6}
                    >
                      {admittedPatients.length === 0
                        ? "You have no admitted patients assigned to you."
                        : "No admitted patients match the current filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PatientTablePagination
            info={`Showing ${table.rangeStart} to ${table.rangeEnd} of ${table.total} patients`}
            page={table.page}
            pageCount={table.pageCount}
            onPageChange={table.setPage}
          />
        </section>
      </Panel>

      <Separator className="ui-split-separator ui-split-separator--column" />

      <Panel id="chart" defaultSize="50" minSize="340px" style={manage.panelFill}>
        {!selected ? (
          <section style={manage.orderCard}>
            <p style={manage.listHint}>
              Select a patient from the list to view their doctor’s orders and
              AI summary.
            </p>
          </section>
        ) : (
          <Group
            orientation="vertical"
            id="physician-manage-chart"
            style={manage.panelGroup}
          >
            {/* Orders on top, AI summary below — drag the handle between them
                to trade height between the two. */}
            <Panel
              id="orders"
              defaultSize="62"
              minSize="260px"
              style={manage.panelFill}
            >
              <SubmittedOrdersTimeline
                title="Submitted Physician Orders"
                fill
                controls={
                  <div style={manage.dateNavigator}>
                    <button
                      type="button"
                      style={
                        hasPrevOrderDay
                          ? manage.dateNavBtn
                          : manage.dateNavBtnDisabled
                      }
                      disabled={!hasPrevOrderDay}
                      title={prevDayLabel}
                      aria-label={prevDayLabel}
                      onClick={() => goToAdjacentOrderDay(-1)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      style={manage.dateInput}
                      onClick={() => setCalendarOpen(true)}
                      aria-haspopup="dialog"
                      aria-expanded={calendarOpen}
                      aria-label={
                        activeOrderDate
                          ? `Filtered to orders on ${selectedDateLabel}. Open calendar`
                          : "Showing orders from every date. Open calendar to filter by date"
                      }
                    >
                      {selectedDateLabel}
                    </button>
                    <button
                      type="button"
                      style={
                        hasNextOrderDay
                          ? manage.dateNavBtn
                          : manage.dateNavBtnDisabled
                      }
                      disabled={!hasNextOrderDay}
                      title={nextDayLabel}
                      aria-label={nextDayLabel}
                      onClick={() => goToAdjacentOrderDay(1)}
                    >
                      ›
                    </button>
                    {activeOrderDate && (
                      <button
                        type="button"
                        style={manage.dateClearBtn}
                        title="Show orders from every date"
                        onClick={() => setOrderDateFilter(null)}
                      >
                        Show all
                      </button>
                    )}
                  </div>
                }
                orders={displayedOrders.map((order) => ({
                  id: order.id,
                  dateCreated: order.dateCreated,
                  doctor: order.orderedBy
                    ? `Dr. ${order.orderedBy.firstName} ${order.orderedBy.lastName}`
                    : "Physician",
                  content: order.orderContent,
                }))}
                emptyMessage={
                  selectedOrders === undefined
                    ? "Loading doctor’s orders…"
                    : activeOrderDate
                      ? `No orders on ${selectedDateLabel}.`
                      : "No doctor’s orders recorded for this patient yet."
                }
                renderContent={
                  editingOrders
                    ? (entry) => {
                        const order = allOrders.find(
                          (item) => item.id === entry.id,
                        );
                        if (!order) return entry.content;
                        return (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <input
                              value={order.orderContent}
                              onChange={(e) =>
                                updateOrder(order.id, e.target.value)
                              }
                              style={manage.orderEditInput}
                            />
                            <button
                              type="button"
                              style={manage.removeOrderBtn}
                              onClick={() => removeOrder(order.id)}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      }
                    : undefined
                }
                footer={
                  <>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Add a new order"
                      rows={2}
                      style={manage.noteArea}
                    />

                    <div style={manage.orderActions}>
                      <button
                        type="button"
                        style={manage.addBtn}
                        onClick={addOrder}
                      >
                        Add
                      </button>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 10 }}
                      >
                        {submitted && !generatingSummary && (
                          <span style={{ fontSize: 12, color: "#166534" }}>
                            {summary ? "Summary saved" : "Orders saved"}
                          </span>
                        )}
                        {/* The row action column is a single View button, so the
                            order-edit toggle lives here beside Submit. */}
                        {editingOrders ? (
                          <button
                            type="button"
                            style={manage.cancelBtn}
                            onClick={() => setEditingOrders(false)}
                          >
                            Cancel
                          </button>
                        ) : (
                          allOrders.length > 0 && (
                            <button
                              type="button"
                              style={manage.cancelBtn}
                              onClick={() => setEditingOrders(true)}
                            >
                              Edit
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          style={manage.submitBtn}
                          disabled={generatingSummary}
                          aria-busy={generatingSummary}
                          onClick={submitOrders}
                        >
                          {generatingSummary ? "Generating..." : "Submit"}
                        </button>
                      </div>
                    </div>
                  </>
                }
              />
            </Panel>

            <Separator className="ui-split-separator ui-split-separator--row" />


            <Panel
              id="summary"
              defaultSize="38"
              minSize="160px"
              style={manage.panelFill}
            >
              <section style={manage.aiCard}>
                <div style={manage.aiHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img
                      src={llamaIcon}
                      alt=""
                      style={{
                        width: 16,
                        height: 16,
                        display: "block",
                        objectFit: "contain",
                      }}
                    />
                    <h3 style={manage.aiTitle}>AI Summarized</h3>
                  </div>
                  <span style={summary ? manage.aiBadge : manage.aiBadgeEmpty}>
                    {summary ? SUMMARY_BADGE[summary.status] : "No summary yet"}
                  </span>
                </div>

                {/* One Course in the Ward per order day, so the panel shows the
                    day it belongs to and steps through the days itself — the
                    order list can stay on "all dates" while every summary is
                    read one day at a time. */}
                <div style={manage.aiDayBar}>
                  <button
                    type="button"
                    style={
                      hasPrevSummaryDay
                        ? manage.dateNavBtn
                        : manage.dateNavBtnDisabled
                    }
                    disabled={!hasPrevSummaryDay}
                    title="Previous day's summary"
                    aria-label="Previous day's summary"
                    onClick={() => goToAdjacentSummaryDay(-1)}
                  >
                    ‹
                  </button>
                  <span style={manage.aiDay}>
                    {summaryDay
                      ? formatDateLongFromKey(summaryDay)
                      : "No order dates"}
                    {summaryDay && orderDays.length > 1 ? (
                      <span style={manage.orderDayCount}>
                        {orderDays.indexOf(summaryDay) + 1} of {orderDays.length}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    style={
                      hasNextSummaryDay
                        ? manage.dateNavBtn
                        : manage.dateNavBtnDisabled
                    }
                    disabled={!hasNextSummaryDay}
                    title="Next day's summary"
                    aria-label="Next day's summary"
                    onClick={() => goToAdjacentSummaryDay(1)}
                  >
                    ›
                  </button>
                </div>

                <div style={manage.aiBody}>
                  {editingSummary && summary ? (
                    <textarea
                      value={summaryText}
                      onChange={(e) =>
                        setSummaryDraft(
                          summaryDay
                            ? { day: summaryDay, text: e.target.value }
                            : null,
                        )
                      }
                      rows={6}
                      style={manage.aiEditor}
                    />
                  ) : summary ? (
                    <p style={manage.aiText}>{summaryText}</p>
                  ) : (
                    <p style={manage.aiEmpty}>
                      {summaryDay
                        ? `No Course in the Ward for ${formatDateLongFromKey(
                            summaryDay,
                          )} yet.`
                        : "No doctor’s orders recorded for this patient yet."}
                    </p>
                  )}

                  {/* A day without a summary still offers the AI action — there
                      it reads "Generate" instead of Edit / Regenerate. */}
                  <div style={manage.aiActions}>
                    {!summary ? (
                      <button
                        type="button"
                        style={
                          !summaryDay || generatingSummary
                            ? { ...manage.aiLink, opacity: 0.6, cursor: "default" }
                            : manage.aiLink
                        }
                        disabled={!summaryDay || generatingSummary}
                        aria-busy={generatingSummary}
                        onClick={() =>
                          summaryDay && generateSummaryForDay(summaryDay)
                        }
                      >
                        {generatingSummary ? (
                          <span className="ui-btn__spinner" aria-hidden="true" />
                        ) : null}
                        {generatingSummary ? "Generating..." : "Generate"}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          style={manage.aiLink}
                          onClick={() => {
                            if (!editingSummary) {
                              setSummaryDraft(
                                summaryDay
                                  ? { day: summaryDay, text: summary.summaryContent }
                                  : null,
                              );
                              setEditingSummary(true);
                              return;
                            }
                            void courseInWardApi
                              .edit(summary.id, summaryText)
                              .then(({ data }) => {
                                replaceSummary(selected.id, data);
                                setEditingSummary(false);
                                setSummaryDraft(null);
                              })
                              .catch(() => undefined);
                          }}
                        >
                          {editingSummary ? "Save Summary" : "Edit Summary"}
                        </button>
                        <button
                          type="button"
                          style={manage.aiLink}
                          disabled={regeneratingSummary}
                          aria-busy={regeneratingSummary}
                          onClick={() => {
                            if (regeneratingSummary) return;
                            setRegeneratingSummary(true);
                            void courseInWardApi
                              .regenerate(summary.id)
                              .then(({ data }) => {
                                replaceSummary(selected.id, data);
                                setEditingSummary(false);
                                setSummaryDraft(null);
                              })
                              .catch(() => undefined)
                              .finally(() => setRegeneratingSummary(false));
                          }}
                        >
                          {regeneratingSummary ? (
                            <span className="ui-btn__spinner" aria-hidden="true" />
                          ) : null}
                          {regeneratingSummary
                            ? "Regenerating..."
                            : "↻ Regenerate"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </section>
            </Panel>
          </Group>
        )}

        {calendarOpen && (
          <CalendarModal
            onClose={() => setCalendarOpen(false)}
            focusDate={calendarFocusDate}
            orderDays={orderDays}
            onSelect={(date) => {
              setOrderDateFilter(toDateInputValue(date));
              setCalendarOpen(false);
            }}
            onClear={() => {
              setOrderDateFilter(null);
              setCalendarOpen(false);
            }}
          />
        )}
      </Panel>
    </Group>
  );
}
