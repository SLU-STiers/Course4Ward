/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { claimsApi } from '../../services/domainApi';
import { ORDER_POLL_MS, usePolling } from '../../hooks/usePolling';
import type { PhysicianRequest } from '../../types';
import { Button, DataTableToolbar, Pagination, StatusBadge } from '../../components/ui';
import { patientTableStyles } from '../../components/patientList/PatientTable';
import { useTableState } from '../../hooks/useTableState';
import { requests } from './styles';

import { REQUESTS_TABLE_STATE } from './listState';
import { ReviewSummaryModal } from './ReviewSummaryModal';
import { fullName } from '../../lib/patient';

/** Claims has asked the attending to validate — only these can be approved. */
const isAwaitingPhysician = (request: PhysicianRequest) =>
  request.status === "PHYSICIAN_VALIDATION_REQUESTED";

/** Every claim of one patient's stay, shown as a single request row. */
type StayRequest = {
  key: string;
  /** The claim the review opens on: the earliest day still pending, else the earliest day. */
  primary: PhysicianRequest;
  requests: PhysicianRequest[];
  pendingCount: number;
  /** Latest time any day of the stay was requested. */
  requestedAt: string;
};

/** Claims are filed per Course in the Ward day; the physician reviews the stay. */
function groupByStay(items: PhysicianRequest[]): StayRequest[] {
  const groups = new Map<string, PhysicianRequest[]>();
  for (const request of items) {
    const admissionId = request.summary.orders[0]?.admissionId;
    const key = `${request.summary.patient.id}:${admissionId ?? request.id}`;
    groups.set(key, [...(groups.get(key) ?? []), request]);
  }
  return [...groups].map(([key, requests]) => {
    const byDay = [...requests].sort((a, b) =>
      a.summary.summaryDate.localeCompare(b.summary.summaryDate),
    );
    const pending = byDay.filter(isAwaitingPhysician);
    return {
      key,
      primary: pending[0] ?? byDay[0],
      requests: byDay,
      pendingCount: pending.length,
      requestedAt: requests
        .map((request) => request.requestedAt)
        .sort()
        .at(-1)!,
    };
  });
}

export function RequestsView({
  focusRequestId,
  onFocusHandled,
}: {
  /** Claim the bell just opened. The review modal opens once that row is loaded. */
  focusRequestId?: string | null;
  onFocusHandled?: () => void;
}) {
  const [items, setItems] = useState<PhysicianRequest[]>([]);
  const [selected, setSelected] = useState<PhysicianRequest | null>(null);

  const loadRequests = useCallback(() => {
    claimsApi
      .physicianRequests()
      .then(({ data }) => setItems(data))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);
  usePolling(loadRequests, ORDER_POLL_MS);

  const stays = useMemo(() => groupByStay(items), [items]);
  const selectedStay = useMemo(
    () =>
      selected
        ? (stays.find((stay) => stay.requests.some((request) => request.id === selected.id)) ?? {
            key: selected.id,
            primary: selected,
            requests: [selected],
            pendingCount: isAwaitingPhysician(selected) ? 1 : 0,
            requestedAt: selected.requestedAt,
          })
        : null,
    [selected, stays],
  );

  // A notification points at one day's claim; the review opens on that stay.
  useEffect(() => {
    if (!focusRequestId) return;
    const match = items.find((request) => request.id === focusRequestId);
    if (!match) return;
    setSelected(match);
    onFocusHandled?.();
  }, [focusRequestId, items, onFocusHandled]);

  // Shared search / filter / sort / pagination state, remembered so leaving
  // the tab and coming back keeps the list where it was.
  const table = useTableState<StayRequest>({
    items: stays,
    pageSize: 5,
    stateKey: REQUESTS_TABLE_STATE,
    searchFields: (stay) => [
      fullName(stay.primary.summary.patient),
      ...stay.requests.map((request) => `${request.processor.firstName} ${request.processor.lastName}`),
    ],
    filterPredicates: {
      status: (stay, value) =>
        value === "all" ||
        (value === "pending" ? stay.pendingCount > 0 : stay.pendingCount === 0),
    },
    initialFilters: { status: "all" },
    sorters: {
      patient: (stay) => fullName(stay.primary.summary.patient),
      requestedAt: (stay) => stay.requestedAt,
    },
    initialSort: { field: "requestedAt", direction: "descending" },
  });

  return (
    <section style={requests.card}>
      {/* Same card-title scale as the Claims Processor "Patient Overview" card. */}
      <h2 style={patientTableStyles.cardTitle}>Requests</h2>

      <DataTableToolbar
        searchProps={{
          value: table.query,
          onChange: table.setQuery,
          placeholder: "Search requests...",
          ariaLabel: "Search physician requests",
        }}
        filterProps={{
          title: "Request status",
          options: [
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "reviewed", label: "Reviewed" },
          ],
          value: table.filters.status ?? "all",
          onChange: (value) => table.setFilter("status", value),
        }}
        sortProps={{
          title: "Sort requests by",
          options: [
            { value: "requestedAt", label: "Requested on" },
            { value: "patient", label: "Patient name" },
          ],
          value: table.sort.field,
          onChange: table.setSortField,
          direction: table.sort.direction,
          onDirectionChange: (direction) =>
            table.setSort({ field: table.sort.field, direction }),
        }}
      />

      <table style={requests.table}>
        <thead>
          <tr>
            <th style={requests.th}>Patient</th>
            <th style={requests.th}>Requested by</th>
            <th style={requests.th}>Requested on</th>
            <th style={requests.th}>Status</th>
            <th style={{ ...requests.th, textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((stay) => {
            const r = stay.primary;
            const dayCount = stay.requests.length;
            return (
              <tr key={stay.key}>
                <td style={requests.td}>
                  <div style={requests.primary}>
                    {fullName(r.summary.patient)}
                  </div>
                  <div style={requests.secondary}>
                    {dayCount} {dayCount === 1 ? "day" : "days"} in this stay
                  </div>
                </td>
                <td style={requests.td}>
                  <div style={requests.primary}>
                    {r.processor.firstName} {r.processor.lastName}
                  </div>
                  <div style={requests.secondary}>Claims Processor</div>
                </td>
                <td style={requests.td}>
                  <div style={requests.primary}>
                    {new Date(stay.requestedAt).toLocaleDateString("en-GB")}
                  </div>
                  <div style={requests.secondary}>
                    {new Date(stay.requestedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </td>
                <td style={requests.td}>
                  <StatusBadge
                    showDot
                    status={stay.pendingCount ? "pending" : "approved"}
                    label={
                      !stay.pendingCount
                        ? "Reviewed"
                        : stay.pendingCount === dayCount
                          ? "Pending Review"
                          : `${stay.pendingCount} of ${dayCount} pending`
                    }
                  />
                </td>
                <td style={{ ...requests.td, textAlign: "right" }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setSelected(r)}
                  >
                    Review
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="ui-table-footer">
        <span className="ui-table-footer__info">
          Showing {table.rangeStart} to {table.rangeEnd} of {table.total}{" "}
          requests
        </span>
        <Pagination
          page={table.page}
          pageCount={table.pageCount}
          onPageChange={table.setPage}
        />
      </div>

      {selected && selectedStay && (
        <ReviewSummaryModal
          key={selected.id}
          request={selected}
          stayRequests={selectedStay.requests}
          onClose={() => setSelected(null)}
          onDayApproved={loadRequests}
          onApprove={async () => {
            // One sign-off for the whole stay: every day still awaiting the
            // physician is validated, so the stay shows as Reviewed.
            await Promise.all(
              selectedStay.requests
                .filter(isAwaitingPhysician)
                .map((request) => claimsApi.approvePhysicianRequest(request.id)),
            );
            // The stay is signed off: close the review so it cannot be approved twice.
            setSelected(null);
            loadRequests();
          }}
        />
      )}
    </section>
  );
}
