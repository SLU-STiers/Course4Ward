/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useCallback, useEffect, useState } from 'react';
import { Button, DataTableToolbar, StatusBadge } from '../../components/ui';
import { PatientTablePagination, patientTableStyles } from '../../components/patientList/PatientTable';
import { useTableState } from '../../hooks/useTableState';
import { sexLabel, statusColor } from '../../lib/patient';

import { AddPatientModal } from './AddPatientModal';
import { PatientDetailModal } from './PatientDetailModal';
import { contactDetailsOf } from './PatientModalParts';
import { triageForDisplay } from '../../lib/triage';
import type { AdmissionRecord } from './types';
import { ADMISSION_STATUSES, STATUS_TONE, admissionStatusOf } from './patientClass';
import { ordersApi, patientsApi } from '../../services/domainApi';
import type { Patient, PhysicianOrder } from '../../types';

function toRecord(patient: Patient): AdmissionRecord {
  const admission = patient.admissions?.[0];
  return {
    id: admission?.id ?? patient.id,
    name: `${patient.firstName} ${patient.lastName}`,
    admittedOn: admission ? new Date(admission.admissionDate).toLocaleDateString('en-GB') : '—',
    dischargedOn: admission?.dischargeDate
      ? new Date(admission.dischargeDate).toLocaleDateString('en-GB')
      : null,
    status: admissionStatusOf(admission),
  };
}

export function PatientView() {
  const [records, setRecords] = useState<AdmissionRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [viewingName, setViewingName] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  /** Orders of the patient in the detail modal; tagged with its id so stale ones are ignored. */
  const [viewingOrders, setViewingOrders] = useState<{
    patientId: string;
    orders: PhysicianOrder[];
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

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
        gender: sexLabel(viewingPatient.gender),
        admissionDate: viewingAdmission
          ? new Date(viewingAdmission.admissionDate).toLocaleDateString('en-GB')
          : '—',
        recordId: viewingAdmission?.id ?? viewingPatient.id,
        assignedDoctors: [
          ...(viewingAdmission?.physician
            ? [`Dr. ${viewingAdmission.physician.firstName} ${viewingAdmission.physician.lastName}`]
            : []),
          ...(viewingAdmission?.additionalPhysicians ?? []).map(
            ({ physician }) => `Dr. ${physician.firstName} ${physician.lastName}`,
          ),
        ],
        triage: triageForDisplay(viewingAdmission),
        contact: contactDetailsOf(viewingPatient),
        classSince: viewingAdmission?.classSince,
      }
    : null;
  const viewingRecord = viewingName ? records.find((r) => r.name === viewingName) ?? null : null;

  // The nurse only carries out observation / admission / discharge once a
  // physician has ordered it, so the modal needs the admission's orders.
  const viewingPatientId = viewingPatient?.id;
  useEffect(() => {
    if (!viewingPatientId) return;
    let cancelled = false;
    ordersApi
      .forPatient(viewingPatientId)
      .then(({ data }) => {
        if (!cancelled) setViewingOrders({ patientId: viewingPatientId, orders: data });
      })
      .catch(() => {
        if (!cancelled) setViewingOrders({ patientId: viewingPatientId, orders: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [viewingPatientId]);

  const loadedOrders =
    viewingOrders && viewingOrders.patientId === viewingPatientId ? viewingOrders.orders : null;
  const hasActiveOrder = (type: PhysicianOrder['type']) =>
    Boolean(
      loadedOrders?.some(
        (order) =>
          order.admissionId === viewingAdmission?.id && order.active !== false && order.type === type,
      ),
    );
  const waitingFor = (type: PhysicianOrder['type'], name: string) =>
    !loadedOrders
      ? 'Checking physician orders...'
      : hasActiveOrder(type)
        ? undefined
        : `Waiting for the physician's ${name} order`;
  const observeBlockedReason = waitingFor('OBSERVATION', 'observation');
  const admitBlockedReason = waitingFor('ADMISSION', 'admission');
  // An outpatient visit is simply ended; everyone else needs a discharge order.
  const dischargeBlockedReason =
    viewingRecord?.status === 'Outpatient' ? undefined : waitingFor('DISCHARGE', 'discharge');

  const openViewing = (name: string) => {
    setActionError(null);
    setViewingName(name);
  };

  // Observe / admit / discharge, then refresh the list. A refusal (e.g. the order was
  // discontinued meanwhile) stays in the modal.
  const runAdmissionAction = (action: () => Promise<unknown>) => {
    setActionBusy(true);
    setActionError(null);
    action()
      .then(() => {
        setViewingName(null);
        reload();
      })
      .catch((err) => {
        const message = err?.response?.data?.message;
        setActionError(
          Array.isArray(message) ? message.join(', ') : message || 'The action could not be completed.',
        );
      })
      .finally(() => setActionBusy(false));
  };

  return (
    <section style={patientTableStyles.card}>
      {/* Same card-title scale as the Claims Processor "Patient Overview" card. */}
      <div style={patientTableStyles.cardHeader}>
        <h2 style={{ ...patientTableStyles.cardTitle, margin: 0 }}>Patient Management</h2>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          Add Patient
        </Button>
      </div>

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
            ...ADMISSION_STATUSES.map((status) => ({ value: status, label: status })),
          ],
          value: table.filters.status ?? 'all',
          onChange: (value) => table.setFilter('status', value),
        }}
        sortProps={{
          title: 'Sort patients by',
          options: [
            { value: 'admittedOn', label: 'Admission date' },
            { value: 'name', label: 'Patient name' },
          ],
          value: table.sort.field,
          onChange: table.setSortField,
          direction: table.sort.direction,
          onDirectionChange: (direction) => table.setSort({ field: table.sort.field, direction }),
        }}
      />

      <div style={patientTableStyles.tableWrapper}>
        <table style={{ ...patientTableStyles.table, tableLayout: 'auto' }}>
          <thead>
            <tr style={patientTableStyles.thRow}>
              <th style={patientTableStyles.th}>Full Name</th>
              <th style={patientTableStyles.th}>Admission Date</th>
              <th style={patientTableStyles.th}>Discharge Date</th>
              <th style={patientTableStyles.th}>Status</th>
              <th style={{ ...patientTableStyles.th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => openViewing(r.name)}
                style={{ ...patientTableStyles.tr, cursor: 'pointer' }}
              >
                <td style={patientTableStyles.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        ...patientTableStyles.dot,
                        backgroundColor: statusColor(
                          r.status === 'Discharged' ? 'discharged' : 'admitted',
                        ),
                      }}
                    />
                    <span style={patientTableStyles.name}>{r.name}</span>
                  </div>
                </td>
                <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>{r.admittedOn}</td>
                <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>
                  {r.dischargedOn ?? '—'}
                </td>
                <td style={patientTableStyles.td}>
                  <StatusBadge showDot status={STATUS_TONE[r.status]} label={r.status} />
                </td>
                <td style={{ ...patientTableStyles.td, textAlign: 'right' }}>
                  <button
                    type="button"
                    style={patientTableStyles.viewBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      openViewing(r.name);
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!table.rows.length && (
              <tr>
                <td
                  style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}
                  colSpan={5}
                >
                  No admissions match the current filters.
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

      {viewing && (
        <PatientDetailModal
          chart={viewing}
          onClose={() => setViewingName(null)}
          status={viewingRecord?.status}
          onCareTeamChanged={reload}
          onDischarge={
            viewingRecord && viewingRecord.status !== 'Discharged'
              ? () => runAdmissionAction(() => patientsApi.discharge(viewingRecord.id))
              : undefined
          }
          dischargeBlockedReason={dischargeBlockedReason}
          onObserve={
            viewingRecord && (viewingRecord.status === 'Emergency' || viewingRecord.status === 'Outpatient')
              ? () => runAdmissionAction(() => patientsApi.observe(viewingRecord.id))
              : undefined
          }
          observeBlockedReason={observeBlockedReason}
          onAdmit={
            viewingRecord &&
            (viewingRecord.status === 'Emergency' ||
              viewingRecord.status === 'Outpatient' ||
              viewingRecord.status === 'Observation')
              ? () => runAdmissionAction(() => patientsApi.admit(viewingRecord.id))
              : undefined
          }
          admitBlockedReason={admitBlockedReason}
          actionBusy={actionBusy}
          actionError={actionError}
        />
      )}

      {showAddModal && (
        <AddPatientModal onClose={() => setShowAddModal(false)} onCreated={reload} />
      )}
    </section>
  );
}
