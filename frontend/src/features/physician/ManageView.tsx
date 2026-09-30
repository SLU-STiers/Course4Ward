/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useEffect, useMemo, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { courseInWardApi, ordersApi, patientsApi } from '../../services/domainApi';
import type { CourseInWard, OrderType, PhysicianOrder } from '../../types';
import { Button, DataTableToolbar, StatusBadge, TriageBadge } from '../../components/ui';
import { PatientTablePagination, patientTableStyles } from '../../components/patientList/PatientTable';
import { AiActionButton, AiSummaryCard } from '../../components/ai/AiSummaryCard';
import { SubmittedOrdersTimeline } from '../../components/orders/SubmittedOrdersTimeline';
import { OrderStatusSummary } from '../../components/orders/OrderStatusSummary';
import { ORDER_TYPE_OPTIONS, orderTypeLabel } from '../../components/orders/orderType';
import { useTableState } from '../../hooks/useTableState';
import {
  formatDateLongFromKey,
  toDateKey,
} from '../../lib/format';
import { manage } from './styles';

import { ADMISSION_FILTER_PRESETS, AGE_BANDS, DAYS_IN_CARE_BANDS, MANAGE_FILTER_KEYS, admissionMatches, customRangeValue, orderDayValue, parseCustomRange } from './filters';
import { mapPatient } from './patient';
import { TriageSummaryBar } from './TriageSummaryBar';
import { triageQueueKey } from '../../lib/triage';
import { mergeSummaries, summariesPerDay } from './summaries';
import type { DashboardPatient } from './types';

/** Epoch millis of an order timestamp; an unparseable timestamp sorts first. */
function orderMillis(order: PhysicianOrder) {
  const time = new Date(order.dateCreated).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/** Header badge per summary status. */
const SUMMARY_BADGE: Record<CourseInWard["status"], string> = {
  DRAFT_AI: "AI Draft ready",
  DRAFT_EDITED: "Edited draft",
  APPROVED: "Approved",
};

export function ManageView() {
  const [patients, setPatients] = useState<DashboardPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [ordersByPatient, setOrdersByPatient] = useState<
    Record<string, PhysicianOrder[]>
  >({});
  const [draft, setDraft] = useState("");
  /** Kind of order the composer files; back to General after each submit. */
  const [orderType, setOrderType] = useState<OrderType>("DEFAULT");
  const [savingOrders, setSavingOrders] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [approvingSummary, setApprovingSummary] = useState(false);
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
      triage: (p) => triageQueueKey(p.triageLevel, p.admittedAt),
      days: (p) => p.daysInCare,
      age: (p) => p.age ?? -1,
    },
    // Most urgent first, longest waiting first within a level.
    initialSort: { field: "triage", direction: "descending" },
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
        setOrderError(null);
        // Drop a date filter this patient has no orders on, so the filter state
        // never disagrees with what the list is showing.
        const loadedDays = new Set(
          ordersResponse.data.map((order) => orderDayValue(order.dateCreated)),
        );
        setOrderDateFilter((previous) =>
          previous && !loadedDays.has(previous) && previous !== toDateKey(new Date())
            ? null
            : previous,
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

  // Today stays pickable while the admission is open, even before its first
  // order, so the physician can open the day and write into it. Past order-less
  // days are still skipped: a new order is always stamped with the current time.
  const todayKey = toDateKey(new Date());
  const hasOpenAdmission = Boolean(
    selected?.admissions?.some((admission) => !admission.dischargeDate),
  );

  // Observation, admission and discharge orders happen once per admission; the
  // nurse then carries them out (observe / admit / discharge). Mirrors the
  // server's rules per patient class so an unavailable kind can't be picked;
  // the server has the final say.
  const openAdmission = selected?.admissions?.find((admission) => !admission.dischargeDate);
  const patientClass = openAdmission?.patientClass ?? "INPATIENT";
  const openAdmissionOrders = allOrders.filter(
    (order) => order.admissionId === openAdmission?.id && order.active !== false,
  );
  const hasOrder = (type: OrderType) => openAdmissionOrders.some((order) => order.type === type);
  // A decision already ordered but not yet carried out by the nurse.
  const pendingDecision = hasOrder("DISCHARGE")
    ? "Patient already has a discharge order"
    : hasOrder("ADMISSION")
      ? "Admission already ordered; waiting for the nurse to admit"
      : hasOrder("OBSERVATION") && patientClass !== "OBSERVATION"
        ? "Observation already ordered; waiting for the nurse"
        : undefined;
  const orderTypeBlockedReason: Partial<Record<OrderType, string>> = {
    OBSERVATION:
      patientClass === "OBSERVATION"
        ? "Patient is already under observation"
        : patientClass === "INPATIENT"
          ? "An admitted patient cannot be placed under observation"
          : pendingDecision,
    ADMISSION: patientClass === "INPATIENT" ? "Patient is already admitted" : pendingDecision,
    DISCHARGE: hasOrder("DISCHARGE") ? "Patient already has a discharge order" : undefined,
  };
  const effectiveOrderType: OrderType = orderTypeBlockedReason[orderType]
    ? "DEFAULT"
    : orderType;

  const selectableOrderDays = useMemo(
    () =>
      hasOpenAdmission && !ordersByDay.has(todayKey)
        ? [...orderDays, todayKey].sort()
        : orderDays,
    [hasOpenAdmission, ordersByDay, orderDays, todayKey],
  );

  // A filter only sticks to a selectable date, so the list never disagrees
  // with the calendar.
  const activeOrderDate =
    orderDateFilter && selectableOrderDays.includes(orderDateFilter)
      ? orderDateFilter
      : null;
  const displayedOrders = activeOrderDate
    ? allOrders.filter((order) => orderDayValue(order.dateCreated) === activeOrderDate)
    : allOrders;
  // --- AI summary, filed per order day -------------------------------------
  // A patient accumulates one Course in the Ward per order day.
  const summariesByDay = useMemo(
    () => summariesPerDay((selected && summariesByPatient[selected.id]) || []),
    [selected?.id, summariesByPatient],
  );

  // Which day's summary is on screen. Its own cursor, so "all order dates" can be
  // read day by day without the list ever leaving that view; picking a day for
  // the orders (calendar or order arrows) brings the summary along. Falls back to
  // the most recent day carrying a summary, then the newest day with orders.
  const daysWithSummary = orderDays.filter((day) => summariesByDay.has(day));
  const summaryDay =
    (summaryDayFilter && orderDays.includes(summaryDayFilter)
      ? summaryDayFilter
      : null) ??
    (activeOrderDate && ordersByDay.has(activeOrderDate) ? activeOrderDate : null) ??
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

  const openPatient = (id: string) => {
    setSelectedId(id);
    setEditingSummary(false);
    setDraft("");
    setSubmitted(false);
    setOrderError(null);
  };

  /** Replace the patient's order list with the server's copy. */
  const reloadOrders = async (patientId: string) => {
    const { data } = await ordersApi.forPatient(patientId);
    setOrdersByPatient((previous) => ({ ...previous, [patientId]: data }));
  };

  /** Refresh the per-patient summary list with a row the API just returned. */
  const replaceSummary = (patientId: string, updated: CourseInWard) => {
    setSummariesByPatient((previous) => ({
      ...previous,
      [patientId]: mergeSummaries(previous[patientId], [updated]),
    }));
  };

  // Generate (or refresh) ONE order day's Course in the Ward from every order of
  // that day. Only the AI panel's Generate button calls this -- submitting an
  // order never summarizes on its own.
  const generateSummaryForDay = (day: string, onDone?: () => void) => {
    if (!selected || generatingSummary) return;
    setGeneratingSummary(true);
    setOrderError(null);
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
      .catch(() =>
        setOrderError("The AI summary could not be generated. Try Generate again or write it manually."),
      )
      .finally(() => setGeneratingSummary(false));
  };

  // Submit = file the order in the composer. Orders are never edited or deleted
  // once written, and saving one does NOT summarize: the physician generates or
  // regenerates the day's Course in the Ward from the AI panel when ready.
  const submitOrders = async () => {
    if (!selected || savingOrders) return;
    const patientId = selected.id;
    const content = draft.trim();
    if (!content) return;

    const admissionId = openAdmission?.id;
    if (!admissionId) {
      setOrderError("This patient has no open admission to add orders to.");
      return;
    }

    setSavingOrders(true);
    setOrderError(null);
    setSubmitted(false);
    try {
      // The backend attributes the order to the signed-in physician.
      const { data } = await ordersApi.create({
        admissionId,
        orderContent: content,
        type: effectiveOrderType,
      });
      setDraft("");
      setOrderType("DEFAULT");
      await reloadOrders(patientId);
      const createdDay = orderDayValue(data.dateCreated);
      // Keep the new order visible when the list is filtered to another day.
      if (createdDay && activeOrderDate && activeOrderDate !== createdDay) {
        setOrderDateFilter(createdDay);
      }
      // Point the AI panel at the order's day, ready for Generate / Regenerate.
      setSummaryDayFilter(createdDay);
      setSubmitted(true);
    } catch (err: any) {
      // The composer keeps its text so nothing typed is lost.
      const message = err?.response?.data?.message;
      setOrderError(
        Array.isArray(message)
          ? message.join(", ")
          : message || "The order could not be saved. Please try again.",
      );
    } finally {
      setSavingOrders(false);
    }
  };

  const approveSummary = (summaryId: string) => {
    if (!selected || approvingSummary) return;
    setApprovingSummary(true);
    setOrderError(null);
    void courseInWardApi
      .approve(summaryId)
      .then(({ data }) => replaceSummary(selected.id, data))
      .catch(() => setOrderError("The summary could not be approved. Please try again."))
      .finally(() => setApprovingSummary(false));
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
  // Order dates (plus today, see `selectableOrderDays`) are the only navigable
  // stops — order-less past days are skipped. With "all dates" showing, the
  // first step focuses the day at that end of the timeline (‹ the most recent,
  // › the earliest), so day-by-day reading never needs a trip to the calendar.
  const hasPrevOrderDay =
    selectableOrderDays.length > 0 &&
    (!activeOrderDate || selectableOrderDays.some((day) => day < activeOrderDate));
  const hasNextOrderDay =
    selectableOrderDays.length > 0 &&
    (!activeOrderDate || selectableOrderDays.some((day) => day > activeOrderDate));
  const goToAdjacentOrderDay = (direction: -1 | 1) => {
    if (!selectableOrderDays.length) return;
    if (!activeOrderDate) {
      setOrderDateFilter(
        direction < 0
          ? selectableOrderDays[selectableOrderDays.length - 1]
          : selectableOrderDays[0],
      );
      return;
    }
    const candidates = selectableOrderDays.filter((day) =>
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
            <h2 style={manage.listTitle}>Patients List</h2>
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
                  <div className="ui-menu__range">
                    <label className="ui-menu__range-field">
                      <span className="ui-menu__range-label">From</span>
                      <input
                        type="date"
                        value={customRange.from}
                        onChange={(event) =>
                          table.setFilter(
                            "admitted",
                            customRangeValue(event.target.value, customRange.to),
                          )
                        }
                      />
                    </label>
                    <label className="ui-menu__range-field">
                      <span className="ui-menu__range-label">To</span>
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
                      />
                    </label>
                  </div>
                ),
              },
            ]}
            activeFilterCount={activeFilterCount}
            onClearFilters={table.resetFilters}
            sortProps={{
              title: "Sort patients by",
              options: [
                { value: "admitted", label: "Admission date" },
                { value: "triage", label: "Triage priority" },
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
                  <th style={patientTableStyles.th}>Triage</th>
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
                      onClick={() => openPatient(p.id)}
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
                      <td style={patientTableStyles.td}>
                        <TriageBadge level={p.triageLevel} compact />
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
                      colSpan={7}
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
          <div style={manage.chartColumn}>
            <TriageSummaryBar
              patientName={selected.name}
              admission={openAdmission ?? selected.admissions?.[0]}
            />
            <Group
              orientation="vertical"
              id="physician-manage-chart"
              style={{ ...manage.panelGroup, flex: "1 1 auto", height: "auto" }}
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
                  dateValue={activeOrderDate ?? ""}
                  onDateChange={setOrderDateFilter}
                  onPrev={() => goToAdjacentOrderDay(-1)}
                  onNext={() => goToAdjacentOrderDay(1)}
                  prevDisabled={!hasPrevOrderDay}
                  nextDisabled={!hasNextOrderDay}
                  prevLabel={prevDayLabel}
                  nextLabel={nextDayLabel}
                  availableDays={selectableOrderDays}
                  onClear={() => setOrderDateFilter(null)}
                  clearLabel="Show all"
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
                      : activeOrderDate === todayKey
                        ? "No orders yet today. Add one below."
                        : activeOrderDate
                          ? `No orders on ${selectedDateLabel}.`
                        : "No doctor’s orders recorded for this patient yet."
                  }
                  renderContent={(entry) => {
                    const order = allOrders.find((item) => item.id === entry.id);
                    // Read-only: the nurse's execution status and note on this order.
                    return (
                      <>
                        <div style={manage.timelineOrderText}>{entry.content}</div>
                        {order && <OrderStatusSummary order={order} />}
                      </>
                    );
                  }}
                  footer={
                    <>
                      <textarea
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          setOrderError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            void submitOrders();
                          }
                        }}
                        placeholder="Add a new order"
                        rows={2}
                        maxLength={2000}
                        disabled={savingOrders}
                        style={manage.noteArea}
                      />

                      <div style={manage.orderActions}>
                        <div
                          role="radiogroup"
                          aria-label="Order type"
                          style={manage.orderTypeGroup}
                        >
                          {ORDER_TYPE_OPTIONS.map((option) => {
                            const blocked = orderTypeBlockedReason[option.value];
                            const active = effectiveOrderType === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={savingOrders || Boolean(blocked)}
                                title={blocked ?? `${option.label} order`}
                                style={{
                                  ...manage.orderTypeOption,
                                  ...(active ? manage.orderTypeOptionActive : {}),
                                  ...(blocked ? manage.orderTypeOptionDisabled : {}),
                                }}
                                onClick={() => {
                                  setOrderType(option.value);
                                  setOrderError(null);
                                }}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                        {orderError && (
                          <span role="alert" style={manage.orderError}>{orderError}</span>
                        )}
                        {submitted && !orderError && (
                          <span style={{ fontSize: 12, color: "#166534" }}>
                            Order saved
                          </span>
                        )}
                        <button
                          type="button"
                          style={manage.submitBtn}
                          disabled={savingOrders || !draft.trim()}
                          aria-busy={savingOrders}
                          onClick={() => void submitOrders()}
                        >
                          {savingOrders
                            ? "Saving..."
                            : effectiveOrderType === "DEFAULT"
                              ? "Submit"
                              : `Submit ${orderTypeLabel(effectiveOrderType)} Order`}
                        </button>
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
                <AiSummaryCard
                  fill
                  badgeLabel={
                    summary ? SUMMARY_BADGE[summary.status] : "No summary yet"
                  }
                  badgeMuted={!summary}
                  dayLabel={
                    summaryDay
                      ? formatDateLongFromKey(summaryDay)
                      : "No order dates"
                  }
                  dayPosition={
                    summaryDay && orderDays.length > 1
                      ? `${orderDays.indexOf(summaryDay) + 1} of ${orderDays.length}`
                      : undefined
                  }
                  onPrevDay={() => goToAdjacentSummaryDay(-1)}
                  onNextDay={() => goToAdjacentSummaryDay(1)}
                  prevDayDisabled={!hasPrevSummaryDay}
                  nextDayDisabled={!hasNextSummaryDay}
                  text={summaryText}
                  emptyMessage={
                    summaryDay
                      ? `No Course in the Ward for ${formatDateLongFromKey(
                          summaryDay,
                        )} yet.`
                      : "No doctor’s orders recorded for this patient yet."
                  }
                  actions={
                    !summary ? (
                      <AiActionButton
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
                      </AiActionButton>
                    ) : (
                      <>
                        {summary.status !== "APPROVED" && !editingSummary && (
                          <AiActionButton
                            disabled={approvingSummary}
                            aria-busy={approvingSummary}
                            onClick={() => approveSummary(summary.id)}
                          >
                            {approvingSummary ? "Approving..." : "✓ Approve"}
                          </AiActionButton>
                        )}
                        <AiActionButton
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
                        </AiActionButton>
                        <AiActionButton
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
                        </AiActionButton>
                      </>
                    )
                  }
                >
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
                  ) : null}
                </AiSummaryCard>
              </Panel>
            </Group>
          </div>
        )}
      </Panel>
    </Group>
  );
}
