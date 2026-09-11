/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useEffect, useState } from 'react';
import { claimsApi } from '../../services/domainApi';
import type { PhysicianRequest } from '../../types';
import { Button, DataTableToolbar, PageHeader, Pagination, StatusBadge } from '../../components/ui';
import { useTableState } from '../../hooks/useTableState';
import { requests } from './styles';

import { ReviewSummaryModal } from './ReviewSummaryModal';

export function RequestsView() {
  const [items, setItems] = useState<PhysicianRequest[]>([]);
  const [selected, setSelected] = useState<PhysicianRequest | null>(null);

  const loadRequests = () => {
    claimsApi
      .physicianRequests()
      .then(({ data }) => setItems(data))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const isPending = (request: PhysicianRequest) =>
    request.status === "PENDING" ||
    request.status === "PHYSICIAN_VALIDATION_REQUESTED";

  // Shared search / filter / sort / pagination state.
  const table = useTableState<PhysicianRequest>({
    items,
    pageSize: 5,
    searchFields: (request) => [
      request.id,
      `${request.summary.patient.firstName} ${request.summary.patient.lastName}`,
      `${request.processor.firstName} ${request.processor.lastName}`,
    ],
    filterPredicates: {
      status: (request, value) =>
        value === "all" ||
        (value === "pending" ? isPending(request) : !isPending(request)),
    },
    initialFilters: { status: "all" },
    sorters: {
      id: (request) => request.id,
      patient: (request) =>
        `${request.summary.patient.firstName} ${request.summary.patient.lastName}`,
      requestedAt: (request) => request.requestedAt,
    },
    initialSort: { field: "requestedAt", direction: "descending" },
  });

  return (
    <section style={requests.card}>
      <PageHeader
        title="Requests"
        description="Review AI summaries submitted by Claims Processors."
      />

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
            { value: "requestedAt", label: "Submitted date" },
            { value: "patient", label: "Patient name" },
            { value: "id", label: "Request ID" },
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
            <th style={requests.th}>Request ID</th>
            <th style={requests.th}>Patient</th>
            <th style={requests.th}>Submitted By</th>
            <th style={requests.th}>Submitted On</th>
            <th style={requests.th}>Status</th>
            <th style={{ ...requests.th, textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.id}>
              <td style={requests.td}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(r)}
                >
                  {r.id}
                </Button>
              </td>
              <td style={requests.td}>
                <div style={requests.primary}>
                  {r.summary.patient.firstName} {r.summary.patient.lastName}
                </div>
                <div style={requests.secondary}>ID: {r.summary.patient.id}</div>
              </td>
              <td style={requests.td}>
                <div style={requests.primary}>
                  {r.processor.firstName} {r.processor.lastName}
                </div>
                <div style={requests.secondary}>Claims Processor</div>
              </td>
              <td style={requests.td}>
                <div style={requests.primary}>
                  {new Date(r.requestedAt).toLocaleDateString("en-GB")}
                </div>
                <div style={requests.secondary}>
                  {new Date(r.requestedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </td>
              <td style={requests.td}>
                <StatusBadge
                  showDot
                  status={isPending(r) ? "pending" : "approved"}
                  label={isPending(r) ? "Pending Review" : "Reviewed"}
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
          ))}
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

      {selected && (
        <ReviewSummaryModal
          request={selected}
          onClose={() => setSelected(null)}
          onApprove={async () => {
            await claimsApi.approvePhysicianRequest(selected.id);
            await loadRequests();
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}
