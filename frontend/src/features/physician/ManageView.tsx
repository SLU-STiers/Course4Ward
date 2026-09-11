/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useAuthStore } from '../../store/authStore';
import { courseInWardApi, ordersApi, patientsApi } from '../../services/domainApi';
import type { PhysicianOrder } from '../../types';
import { Button, DataTableToolbar, Pagination, StatusBadge } from '../../components/ui';
import { useTableState } from '../../hooks/useTableState';
import documentImg from '../../Img/document.png';
import llamaIcon from '../../Img/llama.png';
import {
  formatDateLongFromKey,
  formatTimeClock,
  toDateInputValue,
  todayValue,
} from '../../lib/format';
import { overview, manage } from './styles';

import { CalendarModal } from './CalendarModal';
import { ADMISSION_FILTER_PRESETS, AGE_BANDS, DAYS_IN_CARE_BANDS, MANAGE_FILTER_KEYS, admissionMatches, customRangeValue, orderDayValue, parseCustomRange } from './filters';
import { mapPatient } from './patient';
import type { DashboardPatient } from './types';

/** Epoch millis of an order timestamp; an unparseable timestamp sorts first. */
function orderMillis(order: PhysicianOrder) {
  const time = new Date(order.dateCreated).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/** `Today` / `Yesterday` — a fast anchor once the list spans several dates. */
function relativeDayLabel(day: string): string {
  if (day === todayValue()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return day === toDateInputValue(yesterday) ? "Yesterday" : "";
}

export function ManageView() {
  const user = useAuthStore((s) => s.user);
  const [patients, setPatients] = useState<DashboardPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingOrders, setEditingOrders] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const orderScrollRef = useRef<HTMLDivElement>(null);
  /** Raised when an order is added, so the list follows it to the bottom. */
  const followNewOrder = useRef(false);
  const [ordersByPatient, setOrdersByPatient] = useState<
    Record<string, PhysicianOrder[]>
  >({});
  const [draft, setDraft] = useState("");
  const [summaryByPatient, setSummaryByPatient] = useState<
    Record<string, string>
  >({});
  const [summaryIds, setSummaryIds] = useState<Record<string, string>>({});
  const [editingSummary, setEditingSummary] = useState(false);
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);
  /** Order-date filter (`YYYY-MM-DD`); `null` means unfiltered — every order. */
  const [orderDateFilter, setOrderDateFilter] = useState<string | null>(null);
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
        const latest = summariesResponse.data[0];
        if (latest) {
          setSummaryByPatient((previous) => ({
            ...previous,
            [selected.id]: latest.summaryContent,
          }));
          setSummaryIds((previous) => ({
            ...previous,
            [selected.id]: latest.id,
          }));
        }
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
  // No filter (the default) lists every day, oldest first — the whole list reads
  // chronologically, day by day, then time within each day.
  const dayGroups = useMemo(
    () =>
      (activeOrderDate ? [activeOrderDate] : orderDays).map((day) => ({
        day,
        orders: ordersByDay.get(day) ?? [],
      })),
    [activeOrderDate, orderDays, ordersByDay],
  );
  const visibleOrderCount = dayGroups.reduce(
    (total, group) => total + group.orders.length,
    0,
  );

  // The list reads chronologically, so a freshly added order sits at the very
  // end — follow it there instead of leaving it below the fold.
  useEffect(() => {
    if (!followNewOrder.current) return;
    followNewOrder.current = false;
    const node = orderScrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [allOrders]);
  const summary =
    (selected && summaryByPatient[selected.id]) ??
    "No AI summary yet. Submit orders to generate a draft.";

  const admissionFilter = table.filters.admitted ?? "all";
  const customRange = parseCustomRange(admissionFilter);
  const admissionPreset = admissionFilter.startsWith("custom:")
    ? "custom"
    : admissionFilter;
  const activeFilterCount = MANAGE_FILTER_KEYS.filter((key) => {
    const value = table.filters[key];
    return value !== undefined && value !== "" && value !== "all";
  }).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openPatient = (id: string, edit = false) => {
    setSelectedId(id);
    setEditingSummary(false);
    setDraft("");
    setSubmitted(false);
    setEditingOrders(edit);
    setCalendarOpen(false);
    setMenuOpenId(null);
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
        // While filtering, follow the new order to its day; either way the list
        // scrolls down to it so it is visible right away.
        followNewOrder.current = true;
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
  // Order dates are the only navigable stops — order-less days are skipped, and
  // the arrows only make sense once a single day is in focus.
  const hasPrevOrderDay =
    !!activeOrderDate && orderDays.some((day) => day < activeOrderDate);
  const hasNextOrderDay =
    !!activeOrderDate && orderDays.some((day) => day > activeOrderDate);
  const goToAdjacentOrderDay = (direction: -1 | 1) => {
    if (!activeOrderDate) return;
    const candidates = orderDays.filter((day) =>
      direction < 0 ? day < activeOrderDate : day > activeOrderDate,
    );
    if (!candidates.length) return;
    setOrderDateFilter(
      direction < 0 ? candidates[candidates.length - 1] : candidates[0],
    );
  };

  return (
    <Group
      orientation="horizontal"
      id="physician-manage"
      style={manage.layout}
    >
      {/* Both columns are user-resizable — drag the handle (or focus it and use
          the arrow keys) to give the patient list or the chart more room. */}
      <Panel
        id="patients"
        defaultSize="58"
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
            <table style={overview.table}>
              <thead>
                <tr>
                  <th style={{ ...overview.th, width: 22 }} />
                  <th style={overview.th}>Patient</th>
                  <th style={overview.th}>Sex</th>
                  <th style={overview.th}>Age</th>
                  <th style={overview.th}>Admitted</th>
                  <th style={overview.th}>Days in care</th>
                  <th style={overview.th}>Status</th>
                  <th style={{ ...overview.th, width: 44 }} />
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
                        backgroundColor: active ? "#eef6f8" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <td style={{ ...overview.td, width: 22 }}>
                        <span
                          style={{ ...overview.dot, backgroundColor: p.color }}
                        />
                      </td>
                      <td
                        style={{
                          ...overview.td,
                          fontWeight: 600,
                          color: "#334155",
                        }}
                      >
                        {p.name}
                      </td>
                      <td style={{ ...overview.td, color: "#64748b" }}>
                        {p.gender}
                      </td>
                      <td style={{ ...overview.td, color: "#64748b" }}>
                        {p.age ?? "—"}
                      </td>
                      <td style={{ ...overview.td, color: "#64748b" }}>
                        {p.admissionDate}
                      </td>
                      <td style={{ ...overview.td, color: "#64748b" }}>
                        {p.daysInCare} {p.daysInCare === 1 ? "day" : "days"}
                      </td>
                      <td style={overview.td}>
                        <StatusBadge status={p.status} showDot />
                      </td>
                      <td
                        style={{
                          ...overview.td,
                          textAlign: "right",
                          position: "relative",
                        }}
                      >
                        <div
                          ref={menuOpenId === p.id ? menuRef : undefined}
                          style={{
                            position: "relative",
                            display: "inline-block",
                          }}
                        >
                          <button
                            type="button"
                            style={manage.dotsBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId((id) =>
                                id === p.id ? null : p.id,
                              );
                            }}
                          >
                            ⋯
                          </button>
                          {menuOpenId === p.id && (
                            <div
                              style={manage.rowMenu}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                style={manage.rowMenuItem}
                                onClick={() => openPatient(p.id, false)}
                              >
                                View doctor’s order
                              </button>
                              <button
                                type="button"
                                style={manage.rowMenuItem}
                                onClick={() => openPatient(p.id, true)}
                              >
                                Edit doctor’s order
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!table.rows.length && (
                  <tr>
                    <td
                      style={{ ...overview.td, color: "#94a3b8" }}
                      colSpan={9}
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

          <div className="ui-table-footer">
            <span className="ui-table-footer__info">
              Showing {table.rangeStart} to {table.rangeEnd} of {table.total}{" "}
              patients
            </span>
            <Pagination
              page={table.page}
              pageCount={table.pageCount}
              onPageChange={table.setPage}
            />
          </div>
        </section>
      </Panel>

      <Separator className="ui-split-separator ui-split-separator--column" />

      <Panel id="chart" minSize="340px" style={manage.panelFill}>
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
              <section style={manage.orderCard}>
                <div style={manage.orderHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img
                      src={documentImg}
                      alt="Doctor's order"
                      style={{ width: 18, height: 18 }}
                    />
                    <h2 style={manage.panelTitle}>Doctor’s Order</h2>
                  </div>
                  <div style={manage.dateNavigator}>
                    <button
                      type="button"
                      style={
                        hasPrevOrderDay
                          ? manage.dateNavBtn
                          : manage.dateNavBtnDisabled
                      }
                      disabled={!hasPrevOrderDay}
                      title="Previous day with orders"
                      aria-label="Previous date with orders"
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
                      title="Next day with orders"
                      aria-label="Next date with orders"
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
                </div>

                <div style={manage.orderBox}>
                  <div ref={orderScrollRef} style={manage.orderScroll}>
                    {dayGroups.map(({ day, orders }) => {
                      const relative = relativeDayLabel(day);
                      return (
                        <section key={day} style={manage.orderDayGroup}>
                          {/* Each day keeps its own labelled, tinted header so
                              orders read day by day, then by time within the
                              day. */}
                          <div style={manage.orderDayHeader}>
                            <span style={manage.orderDayLabel}>
                              <span>{formatDateLongFromKey(day)}</span>
                              {relative ? (
                                <span style={manage.orderDayRelative}>
                                  {relative}
                                </span>
                              ) : null}
                            </span>
                            <span style={manage.orderDayCount}>
                              {orders.length}{" "}
                              {orders.length === 1 ? "order" : "orders"}
                            </span>
                          </div>
                          <div style={manage.orderDayBody}>
                            {orders.map((order, index) => (
                              <div
                                key={order.id}
                                style={{
                                  ...(editingOrders
                                    ? manage.orderEditRow
                                    : manage.orderRow),
                                  // Only between rows of the same day — the card
                                  // edge already separates one day from the next.
                                  ...(index > 0 ? manage.orderRowDivided : {}),
                                }}
                              >
                                <span style={manage.orderTime}>
                                  {formatTimeClock(order.dateCreated)}
                                </span>
                                {editingOrders ? (
                                  <>
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
                                  </>
                                ) : (
                                  <span style={manage.orderText}>
                                    {order.orderContent}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                    {!visibleOrderCount && (
                      <div style={{ ...manage.orderLine, color: "#94a3b8" }}>
                        {selectedOrders === undefined
                          ? "Loading doctor’s orders…"
                          : activeOrderDate
                            ? `No orders on ${selectedDateLabel}.`
                            : "No doctor’s orders recorded for this patient yet."}
                      </div>
                    )}
                  </div>
                </div>

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
                    {submitted && (
                      <span style={{ fontSize: 12, color: "#166534" }}>
                        Orders saved
                      </span>
                    )}
                    {editingOrders && (
                      <button
                        type="button"
                        style={manage.cancelBtn}
                        onClick={() => setEditingOrders(false)}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      style={manage.submitBtn}
                      onClick={() => {
                        setSubmitted(true);
                        setEditingOrders(false);
                      }}
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </section>
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
                  <span style={manage.aiBadge}>AI Draft ready</span>
                </div>

                <div style={manage.aiBody}>
                  {editingSummary ? (
                    <textarea
                      value={summary}
                      onChange={(e) =>
                        setSummaryByPatient((prev) => ({
                          ...prev,
                          [selected?.id ?? ""]: e.target.value,
                        }))
                      }
                      rows={6}
                      style={manage.aiEditor}
                    />
                  ) : (
                    <p style={manage.aiText}>{summary}</p>
                  )}

                  <div style={manage.aiActions}>
                    <button
                      type="button"
                      style={manage.aiLink}
                      onClick={() => {
                        if (!editingSummary) {
                          setEditingSummary(true);
                          return;
                        }
                        const id = summaryIds[selected.id];
                        if (!id) return;
                        courseInWardApi.edit(id, summary).then(({ data }) => {
                          setSummaryByPatient((prev) => ({
                            ...prev,
                            [selected.id]: data.summaryContent,
                          }));
                          setEditingSummary(false);
                        });
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
                        const id = summaryIds[selected.id];
                        if (!id || regeneratingSummary) return;
                        setRegeneratingSummary(true);
                        void courseInWardApi
                          .regenerate(id)
                          .then(({ data }) => {
                            setSummaryByPatient((prev) => ({
                              ...prev,
                              [selected.id]: data.summaryContent,
                            }));
                            setEditingSummary(false);
                          })
                          .catch(() => undefined)
                          .finally(() => setRegeneratingSummary(false));
                      }}
                    >
                      {regeneratingSummary ? (
                        <span className="ui-btn__spinner" aria-hidden="true" />
                      ) : null}
                      {regeneratingSummary ? "Regenerating..." : "↻ Regenerate"}
                    </button>
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
          />
        )}
      </Panel>
    </Group>
  );
}
