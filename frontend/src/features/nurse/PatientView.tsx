/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import React, { useState } from 'react';
import { Button, DataTableToolbar, PageHeader, Pagination, StatusBadge } from '../../components/ui';
import { useTableState } from '../../hooks/useTableState';
import { ui } from './styles';

import { INITIAL_ADMISSIONS, resolveChart } from './data';
import { PatientDetailModal } from './PatientDetailModal';
import type { AdmissionRecord, PatientChart } from './types';

export function PatientView({
  charts,
  setCharts,
}: {
  charts: Record<string, PatientChart>;
  setCharts: React.Dispatch<React.SetStateAction<Record<string, PatientChart>>>;
}) {
  const [records, setRecords] = useState(INITIAL_ADMISSIONS);
  const [viewingName, setViewingName] = useState<string | null>(null);

  // Shared search / filter / sort / pagination state.
  const table = useTableState<AdmissionRecord>({
    items: records,
    pageSize: 8,
    searchFields: (record) => [record.id, record.name],
    filterPredicates: {
      status: (record, value) => value === 'all' || record.status === value,
    },
    initialFilters: { status: 'all' },
    sorters: {
      id: (record) => record.id,
      name: (record) => record.name,
      admittedOn: (record) => record.admittedOn,
    },
    initialSort: { field: 'admittedOn', direction: 'descending' },
  });

  const viewing = viewingName ? resolveChart(viewingName, charts) : null;
  const viewingRecord = viewingName ? records.find((r) => r.name === viewingName) ?? null : null;

  const discharge = (id: string) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: 'Discharged', dischargedOn: '01 Sep 2026' } : r
      )
    );
  };

  const addDoctor = (doctor: string) => {
    if (!viewingName) return;
    setCharts((prev) => {
      const current = resolveChart(viewingName, prev);
      if (current.assignedDoctors.includes(doctor)) return prev;
      return {
        ...prev,
        [viewingName]: { ...current, assignedDoctors: [...current.assignedDoctors, doctor] },
      };
    });
  };

  return (
    <section style={ui.card}>
      <PageHeader title="Patient Management" description="Manage admissions and discharges." />

      <DataTableToolbar
        searchProps={{
          value: table.query,
          onChange: table.setQuery,
          placeholder: 'Search patient, admission ID...',
          ariaLabel: 'Search patients and admissions',
        }}
        filterProps={{
          title: 'Admission status',
          options: [
            { value: 'all', label: 'All statuses' },
            { value: 'Admitted', label: 'Admitted' },
            { value: 'Discharged', label: 'Discharged' },
          ],
          value: table.filters.status ?? 'all',
          onChange: (value) => table.setFilter('status', value),
        }}
        sortProps={{
          title: 'Sort patients by',
          options: [
            { value: 'admittedOn', label: 'Admission date' },
            { value: 'name', label: 'Patient name' },
            { value: 'id', label: 'Admission ID' },
          ],
          value: table.sort.field,
          onChange: table.setSortField,
          direction: table.sort.direction,
          onDirectionChange: (direction) => table.setSort({ field: table.sort.field, direction }),
        }}
      />

      <div style={ui.tableWrap}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.thBlue}>Admission ID</th>
              <th style={ui.thBlue}>Full Name</th>
              <th style={ui.thBlue}>Admission Date</th>
              <th style={ui.thBlue}>Discharge Date</th>
              <th style={ui.thBlue}>Status</th>
              <th style={{ ...ui.thBlue, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.id}>
                <td style={ui.td}>
                  <button type="button" style={ui.idLink} onClick={() => setViewingName(r.name)}>
                    {r.id}
                  </button>
                </td>
                <td style={ui.td}>
                  <button type="button" style={ui.nameBtn} onClick={() => setViewingName(r.name)}>
                    {r.name}
                  </button>
                </td>
                <td style={{ ...ui.td, color: '#334155' }}>{r.admittedOn}</td>
                <td style={{ ...ui.td, color: '#64748b' }}>{r.dischargedOn ?? '—'}</td>
                <td style={ui.td}>
                  <StatusBadge
                    showDot
                    status={r.status === 'Admitted' ? 'admitted' : 'discharged'}
                  />
                </td>
                <td style={{ ...ui.td, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Button variant="secondary" size="sm" onClick={() => setViewingName(r.name)}>
                      View Record
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ui-table-footer">
        <span className="ui-table-footer__info">
          Showing {table.rangeStart} to {table.rangeEnd} of {table.total} patients
        </span>
        <Pagination page={table.page} pageCount={table.pageCount} onPageChange={table.setPage} />
      </div>

      {viewing && (
        <PatientDetailModal
          chart={viewing}
          canAddDoctor
          onClose={() => setViewingName(null)}
          onAddDoctor={addDoctor}
          status={viewingRecord?.status}
          onDischarge={
            viewingRecord ? () => discharge(viewingRecord.id) : undefined
          }
        />
      )}
    </section>
  );
}
