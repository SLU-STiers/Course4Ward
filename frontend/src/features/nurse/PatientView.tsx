/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useEffect, useState } from 'react';
import { Button, DataTableToolbar, PageHeader, Pagination, StatusBadge } from '../../components/ui';
import { useTableState } from '../../hooks/useTableState';
import { ui } from './styles';

import { PatientDetailModal } from './PatientDetailModal';
import type { AdmissionRecord } from './types';
import { patientsApi } from '../../services/domainApi';
import type { Patient } from '../../types';

function toRecord(patient: Patient): AdmissionRecord {
  const admission = patient.admissions?.[0];
  return {
    id: admission?.id ?? patient.id,
    name: `${patient.firstName} ${patient.lastName}`,
    admittedOn: admission ? new Date(admission.admissionDate).toLocaleDateString('en-GB') : '—',
    dischargedOn: admission?.dischargeDate ? new Date(admission.dischargeDate).toLocaleDateString('en-GB') : null,
    status: admission?.dischargeDate ? 'Discharged' : 'Admitted',
  };
}

export function PatientView({
}: {
}) {
  const [records, setRecords] = useState<AdmissionRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [viewingName, setViewingName] = useState<string | null>(null);

  useEffect(() => {
    patientsApi.list().then(({ data }) => {
      setPatients(data);
      setRecords(data.map(toRecord));
    }).catch(() => {
      setPatients([]);
      setRecords([]);
    });
  }, []);

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

  const viewingPatient = viewingName ? patients.find((patient) => `${patient.firstName} ${patient.lastName}` === viewingName) : null;
  const viewingAdmission = viewingPatient?.admissions?.[0];
  const viewing = viewingPatient ? {
    name: viewingName ?? '',
    age: viewingPatient.dateOfBirth ? Math.max(0, new Date().getFullYear() - new Date(viewingPatient.dateOfBirth).getFullYear()) : 0,
    gender: viewingPatient.gender ?? '—',
    admissionDate: viewingAdmission ? new Date(viewingAdmission.admissionDate).toLocaleDateString('en-GB') : '—',
    recordId: viewingAdmission?.id ?? viewingPatient.id,
    assignedDoctors: viewingAdmission?.physician
      ? [`Dr. ${viewingAdmission.physician.firstName} ${viewingAdmission.physician.lastName}`]
      : [],
    triage: { time: '—', heartRate: '—', respRate: '—', spo2: '—', bp: '—', temp: '—', pain: '—', notes: viewingAdmission?.initialAssessment ?? 'No triage assessment recorded.' },
  } : null;
  const viewingRecord = viewingName ? records.find((r) => r.name === viewingName) ?? null : null;

  const discharge = (id: string) => {
    patientsApi.discharge(id).then(() => {
      setRecords((prev) => prev.map((r) => r.id === id
        ? { ...r, status: 'Discharged', dischargedOn: new Date().toLocaleDateString('en-GB') }
        : r));
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
          onClose={() => setViewingName(null)}
          status={viewingRecord?.status}
          onDischarge={
            viewingRecord ? () => discharge(viewingRecord.id) : undefined
          }
        />
      )}
    </section>
  );
}
