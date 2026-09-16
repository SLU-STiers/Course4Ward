/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useCallback, useEffect, useState } from 'react';
import { Button, DataTableToolbar, PageHeader, Pagination, StatusBadge } from '../../components/ui';
import { useTableState } from '../../hooks/useTableState';
import { ui } from './styles';

import { AddPatientModal } from './AddPatientModal';
import { PatientDetailModal } from './PatientDetailModal';
import type { AdmissionRecord, AdmissionStatus } from './types';
import { patientsApi } from '../../services/domainApi';
import type { Patient } from '../../types';

function deriveStatus(patient: Patient): AdmissionStatus {
  const admission = patient.admissions?.[0];
  if (admission?.dischargeDate) return 'Discharged';
  if (admission?.isOutpatient) return 'ER / Outpatient';
  return 'Admitted';
}

function toRecord(patient: Patient): AdmissionRecord {
  const admission = patient.admissions?.[0];
  return {
    id: admission?.id ?? patient.id,
    name: `${patient.firstName} ${patient.lastName}`,
    admittedOn: admission ? new Date(admission.admissionDate).toLocaleDateString('en-GB') : '—',
    dischargedOn: admission?.dischargeDate
      ? new Date(admission.dischargeDate).toLocaleDateString('en-GB')
      : null,
    status: deriveStatus(patient),
    isOutpatient: Boolean(admission?.isOutpatient),
  };
}

function parseTriageNotes(raw?: string | null) {
  const text = raw?.trim() || '';
  const empty = {
    time: '—',
    heartRate: '—',
    respRate: '—',
    spo2: '—',
    bp: '—',
    temp: '—',
    pain: '—',
    notes: text || 'No triage assessment recorded.',
  };
  if (!text.startsWith('Triage —')) return empty;

  const [vitalsLine, ...rest] = text.split('\n');
  const pick = (label: string) => {
    const match = vitalsLine.match(new RegExp(`${label}:\\s*([^,]+)`));
    return match?.[1]?.trim() || '—';
  };

  return {
    time: pick('Time'),
    heartRate: pick('HR'),
    respRate: pick('RR'),
    spo2: pick('SpO2'),
    bp: pick('BP'),
    temp: pick('Temp'),
    pain: pick('Pain'),
    notes: rest.join('\n').trim() || '—',
  };
}

function statusTone(status: AdmissionStatus): 'admitted' | 'discharged' | 'pending' {
  if (status === 'Admitted') return 'admitted';
  if (status === 'Discharged') return 'discharged';
  return 'pending';
}

export function PatientView() {
  const [records, setRecords] = useState<AdmissionRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [viewingName, setViewingName] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const reload = useCallback(() => {
    patientsApi
      .list()
      .then(({ data }) => {
        setPatients(data);
        setRecords(data.map(toRecord));
      })
      .catch(() => {
        setPatients([]);
        setRecords([]);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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

  const viewingPatient = viewingName
    ? patients.find((patient) => `${patient.firstName} ${patient.lastName}` === viewingName)
    : null;
  const viewingAdmission = viewingPatient?.admissions?.[0];
  const viewing = viewingPatient
    ? {
        name: viewingName ?? '',
        age: viewingPatient.dateOfBirth
          ? Math.max(0, new Date().getFullYear() - new Date(viewingPatient.dateOfBirth).getFullYear())
          : 0,
        gender: viewingPatient.gender ?? '—',
        admissionDate: viewingAdmission
          ? new Date(viewingAdmission.admissionDate).toLocaleDateString('en-GB')
          : '—',
        recordId: viewingAdmission?.id ?? viewingPatient.id,
        assignedDoctors: viewingAdmission?.physician
          ? [`Dr. ${viewingAdmission.physician.firstName} ${viewingAdmission.physician.lastName}`]
          : [],
        triage: parseTriageNotes(viewingAdmission?.initialAssessment),
        admissionKind: viewingAdmission?.isOutpatient ? ('ER / Outpatient' as const) : ('Ward' as const),
      }
    : null;
  const viewingRecord = viewingName ? records.find((r) => r.name === viewingName) ?? null : null;

  const discharge = (id: string) => {
    patientsApi.discharge(id).then(() => {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: 'Discharged', dischargedOn: new Date().toLocaleDateString('en-GB') }
            : r,
        ),
      );
      setViewingName(null);
      reload();
    });
  };

  return (
    <section style={ui.card}>
      <PageHeader
        title="Patient Management"
        description="Manage admissions and discharges."
        actions={
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            Add Patient
          </Button>
        }
      />

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
            { value: 'ER / Outpatient', label: 'ER / Outpatient' },
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
                  <StatusBadge showDot status={statusTone(r.status)} label={r.status} />
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
            viewingRecord && viewingRecord.status !== 'Discharged'
              ? () => discharge(viewingRecord.id)
              : undefined
          }
        />
      )}

      {showAddModal && (
        <AddPatientModal onClose={() => setShowAddModal(false)} onCreated={reload} />
      )}
    </section>
  );
}
