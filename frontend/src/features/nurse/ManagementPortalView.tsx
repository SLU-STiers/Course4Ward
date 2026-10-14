/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useCallback, useEffect, useState } from 'react';
import { DataTableToolbar, StatusBadge, TriageBadge } from '../../components/ui';
import { PatientTablePagination, patientTableStyles } from '../../components/patientList/PatientTable';
import { SubmittedOrdersTimeline } from '../../components/orders/SubmittedOrdersTimeline';
import { OrderStatusSummary } from '../../components/orders/OrderStatusSummary';
import { AiSummaryCard } from '../../components/ai/AiSummaryCard';
import { useTableState } from '../../hooks/useTableState';
import { formatDateLongFromKey, formatDateNumeric, toDateInputValue, toDateKey } from '../../lib/format';
import { daysInCare, sexLabel, statusColor } from '../../lib/patient';
import { triageForDisplay, triageUrgency } from '../../lib/triage';
import { ui } from './styles';
import { PatientDetailModal } from './PatientDetailModal';
import { OrderExecutionPanel } from './OrderExecutionPanel';
import { OnBehalfOrderForm } from './OnBehalfOrderForm';
import { OtherWardLabel, SECTION_ICONS, Section, contactDetailsOf } from './PatientModalParts';
import type { AdmissionStatus, NursePatient, OrderSet } from './types';
import { ADMISSION_STATUSES, STATUS_TONE, admissionStatusOf, wardLocation } from './patientClass';
import { courseInWardApi, ordersApi, patientsApi } from '../../services/domainApi';
import type { CourseInWard, Patient, PhysicianOrder } from '../../types';

const colors = ['#ef4444', '#22c55e', '#84cc16', '#6366f1', '#eab308', '#06b6d4'];

function mapPatient(patient: Patient, index: number): NursePatient {
  const admission = patient.admissions?.[0];
  const name = `${patient.firstName} ${patient.lastName}`;
  if (patient.restricted) {
    return {
      id: patient.id,
      name,
      patientId: patient.id,
      recordId: patient.id,
      admissionDate: '—',
      admissionDateRaw: '',
      color: colors[index % colors.length],
      age: 0,
      gender: '—',
      initials: `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`,
      daysInCare: 0,
      restricted: true,
      location: wardLocation(patient),
    };
  }
  const status = admission?.dischargeDate ? 'discharged' : 'admitted';
  const admissionDate = admission?.admissionDate ?? '';
  return {
    id: patient.id,
    name,
    patientId: patient.id,
    admissionId: admission?.id,
    recordId: admission?.id ?? patient.id,
    admissionDate: admissionDate ? formatDateNumeric(admissionDate) : '—',
    admissionDateRaw: admissionDate ? toDateInputValue(new Date(admissionDate)) : '',
    color: colors[index % colors.length],
    age: patient.dateOfBirth ? Math.max(0, new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()) : 0,
    gender: sexLabel(patient.gender),
    initials: `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`,
    status,
    daysInCare: daysInCare(admissionDate, admission?.dischargeDate),
    initialAssessment: admission?.initialAssessment,
    triage: triageForDisplay(admission),
    contact: contactDetailsOf(patient),
    room: admission?.room?.number,
    location: wardLocation(patient),
    patientClass: admission?.patientClass,
    classSince: admission?.classSince,
    assignedDoctor: admission?.physician
      ? `Dr. ${admission.physician.firstName} ${admission.physician.lastName}`
      : null,
    additionalDoctors: (admission?.additionalPhysicians ?? []).map(
      ({ physician }) => `Dr. ${physician.firstName} ${physician.lastName}`,
    ),
  };
}

/** Status shown in the table and matched by the status filter: discharged, else the patient class. */
function displayStatus(patient: NursePatient): AdmissionStatus {
  return admissionStatusOf({
    dischargeDate: patient.status === 'discharged' ? 'discharged' : null,
    patientClass: patient.patientClass,
  });
}

function mapOrder(order: PhysicianOrder): OrderSet {
  const date = new Date(order.dateCreated);
  return {
    // Local calendar day, the same key the physician files orders and summaries under.
    dateKey: toDateKey(date),
    dateLabel: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    doctor: order.orderedBy ? `Dr. ${order.orderedBy.firstName} ${order.orderedBy.lastName}` : 'Physician',
    orders: [order.orderContent],
    order,
  };
}

/**
 * The order day a Course in the Ward belongs to: the day of the orders it was
 * built from, falling back to its `summaryDate` (same rule as the physician view).
 */
function summaryDayKey(summary: CourseInWard): string {
  const days = (summary.orders ?? [])
    .map((order) => toDateKey(order.dateCreated))
    .filter(Boolean)
    .sort();
  return days[0] ?? toDateKey(summary.summaryDate);
}

export function ManagementPortalView() {
  const [patients, setPatients] = useState<NursePatient[]>([]);
  /** The patient open in the View modal. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [ordersByPatient, setOrdersByPatient] = useState<Record<string, OrderSet[]>>({});
  /** The submitted order whose status editor is open in the modal. */
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [summariesByPatient, setSummariesByPatient] = useState<Record<string, CourseInWard[]>>({});

  /* Refetched every time a patient is opened, so a summary the physician
     approved since the last look shows up without reloading the page. */
  const loadSummaries = useCallback((patientId: string) => {
    courseInWardApi.forPatient(patientId)
      .then(({ data }) => setSummariesByPatient((previous) => ({ ...previous, [patientId]: data })))
      .catch(() => undefined);
  }, []);

  const loadPatients = useCallback(() => {
    return patientsApi.list().then(({ data }) => {
      const mapped = data.map(mapPatient);
      setPatients(mapped);
      return mapped;
    });
  }, []);

  useEffect(() => {
    loadPatients().catch(() => setPatients([]));
  }, [loadPatients]);

  useEffect(() => {
    if (!selectedId) return;
    ordersApi.forPatient(selectedId).then(({ data }) => {
      const mapped = data.filter((order) => order.active).map(mapOrder);
      setOrdersByPatient((previous) => ({ ...previous, [selectedId]: mapped }));
      const days = [...new Set(mapped.map((order) => order.dateKey))].sort().reverse();
      setSelectedDate((current) => current || days[0] || '');
    }).catch(() => setOrdersByPatient((previous) => ({ ...previous, [selectedId]: [] })));
    loadSummaries(selectedId);
  }, [selectedId, loadSummaries]);

  const table = useTableState<NursePatient>({
    items: patients,
    pageSize: 8,
    searchFields: (patient) => [patient.name, patient.patientId, patient.recordId],
    filterPredicates: {
      status: (patient, value) => value === 'all' || (!patient.restricted && displayStatus(patient) === value),
    },
    initialFilters: { status: 'all' },
    sorters: {
      name: (patient) => patient.name,
      triage: (patient) => triageUrgency(patient.triage?.level),
      age: (patient) => patient.age,
      daysInCare: (patient) => patient.daysInCare,
      admissionDate: (patient) => patient.admissionDateRaw,
    },
    initialSort: { field: 'admissionDate', direction: 'descending' },
  });

  const selected = patients.find((p) => p.id === selectedId) ?? null;

  const orderSets = selected ? ordersByPatient[selected.id] ?? [] : [];
  const datesWithOrders = [...new Set(orderSets.map((o) => o.dateKey))].sort().reverse();
  /* `''` means every date; a day that this patient has no orders on falls back
     to it, so the list can never be emptied by a stale selection. */
  const activeDate = selectedDate && datesWithOrders.includes(selectedDate) ? selectedDate : '';
  const dateIndex = activeDate ? datesWithOrders.indexOf(activeDate) : -1;
  const hasPrevDate = datesWithOrders.length > 0 && (dateIndex < 0 || dateIndex < datesWithOrders.length - 1);
  const hasNextDate = datesWithOrders.length > 0 && (dateIndex < 0 || dateIndex > 0);
  const ordersForDisplay = activeDate
    ? orderSets.filter((set) => set.dateKey === activeDate)
    : [...orderSets].sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
  /* The AI card always names a day — the newest one while showing all dates. */
  const cardDay = activeDate || datesWithOrders[0] || '';

  /* Nurses read only what the physician approved; a draft just says it is pending.
     The list comes newest first, so the first match per day is the latest one. */
  const summariesForCardDay = (selected ? summariesByPatient[selected.id] ?? [] : [])
    .filter((summary) => cardDay && summaryDayKey(summary) === cardDay);
  const approvedSummary = summariesForCardDay.find((summary) => summary.status === 'APPROVED');
  const pendingSummary = !approvedSummary && summariesForCardDay.length > 0;
  const cardDayLabel = cardDay ? formatDateLongFromKey(cardDay) : 'this patient';

  const openPatient = (id: string) => {
    setSelectedId(id);
    setSelectedOrderId(null);
    if (id === selectedId) loadSummaries(id);
    const sets = ordersByPatient[id] ?? [];
    const latest = [...new Set(sets.map((o) => o.dateKey))].sort().reverse()[0] ?? '';
    setSelectedDate(latest);
  };

  /* Swap in the saved copy of an order after the nurse updates its status. */
  const replaceOrder = (saved: PhysicianOrder) => {
    setOrdersByPatient((previous) => {
      const next: Record<string, OrderSet[]> = {};
      for (const [patientId, sets] of Object.entries(previous)) {
        next[patientId] = sets.map((set) =>
          set.order?.id === saved.id ? { ...set, order: { ...set.order, ...saved } } : set,
        );
      }
      return next;
    });
  };

  const addOrder = (patientId: string, saved: PhysicianOrder) => {
    const mapped = mapOrder(saved);
    setOrdersByPatient((previous) => ({
      ...previous,
      [patientId]: [
        mapped,
        ...(previous[patientId] ?? []).filter((item) => item.order?.id !== saved.id),
      ],
    }));
    setSelectedDate(mapped.dateKey);
  };
  const ordersById = new Map(
    ordersForDisplay.flatMap((set) => (set.order ? [[set.order.id, set.order] as const] : [])),
  );

  const shiftDate = (dir: -1 | 1) => {
    if (!datesWithOrders.length) return;
    if (!activeDate) {
      // From "all dates" the first step focuses the day at that end of the list.
      setSelectedDate(dir < 0 ? datesWithOrders[datesWithOrders.length - 1] : datesWithOrders[0]);
      return;
    }
    const next = datesWithOrders[datesWithOrders.indexOf(activeDate) + dir];
    if (next) setSelectedDate(next);
  };

  const detailPatient = selected && !selected.restricted ? selected : null;
  const detailChart = detailPatient ? {
    name: detailPatient.name,
    age: detailPatient.age,
    gender: detailPatient.gender,
    admissionDate: detailPatient.admissionDate,
    recordId: detailPatient.recordId,
    assignedDoctors: [
      ...(detailPatient.assignedDoctor ? [detailPatient.assignedDoctor] : []),
      ...(detailPatient.additionalDoctors ?? []),
    ],
    triage: detailPatient.triage ?? triageForDisplay(null),
    contact: detailPatient.contact,
    room: detailPatient.room,
    classSince: detailPatient.classSince,
  } : null;
  const detailStatus: AdmissionStatus | undefined = detailPatient
    ? displayStatus(detailPatient)
    : undefined;
  const careTeamNames = detailPatient
    ? [
        ...(detailPatient.assignedDoctor ? [detailPatient.assignedDoctor] : []),
        ...(detailPatient.additionalDoctors ?? []),
      ]
    : [];
  const canEnterOrders = Boolean(detailPatient?.admissionId) && detailPatient?.status !== 'discharged';

  const ordersColumn = detailPatient && (
    <>
      <SubmittedOrdersTimeline
        title="Order Timeline"
        dateValue={activeDate}
        onDateChange={setSelectedDate}
        onPrev={() => shiftDate(1)}
        onNext={() => shiftDate(-1)}
        prevDisabled={!hasPrevDate}
        nextDisabled={!hasNextDate}
        availableDays={datesWithOrders}
        onClear={() => setSelectedDate('')}
        clearLabel="Show all"
        orders={ordersForDisplay.flatMap((set) => set.orders.map((content, index) => ({
          id: set.order?.id ?? `${set.dateKey}-${set.time}-${index}`,
          dateCreated: `${set.dateKey}T00:00:00`,
          dateLabel: set.dateLabel,
          timeLabel: set.time,
          doctor: set.doctor,
          content,
        })))}
        renderContent={(entry) => {
          const order = ordersById.get(entry.id);
          const editing = Boolean(order && canEnterOrders && order.id === selectedOrderId);
          return (
            <>
              <div style={{ ...ui.orderContent, whiteSpace: 'pre-wrap' }}>{entry.content}</div>
              {order && editing && (
                <>
                  <OrderExecutionPanel
                    key={order.id}
                    order={order}
                    onSaved={(saved) => {
                      replaceOrder(saved);
                      setSelectedOrderId(null);
                    }}
                  />
                  <button
                    type="button"
                    style={{ ...ui.orderPick, marginTop: 8 }}
                    onClick={() => setSelectedOrderId(null)}
                  >
                    Close
                  </button>
                </>
              )}
              {order && !editing && (
                <OrderStatusSummary
                  order={order}
                  action={
                    canEnterOrders ? (
                      <button
                        type="button"
                        style={ui.orderPick}
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        Update status
                      </button>
                    ) : undefined
                  }
                />
              )}
            </>
          );
        }}
        emptyMessage={
          activeDate
            ? `No physician orders for ${formatDateLongFromKey(activeDate)}. Choose another date to view previous orders.`
            : 'No physician orders recorded for this patient yet.'
        }
      />

      <AiSummaryCard
        badgeLabel={approvedSummary ? 'Approved' : pendingSummary ? 'Awaiting approval' : 'No summary yet'}
        badgeMuted={!approvedSummary}
        dayLabel={cardDay ? formatDateLongFromKey(cardDay) : 'No order dates'}
        dayPosition={
          datesWithOrders.length > 1 && cardDay
            ? `${datesWithOrders.indexOf(cardDay) + 1} of ${datesWithOrders.length}`
            : undefined
        }
        onPrevDay={() => shiftDate(1)}
        onNextDay={() => shiftDate(-1)}
        prevDayDisabled={!hasPrevDate}
        nextDayDisabled={!hasNextDate}
        text={approvedSummary?.summaryContent}
        emptyMessage={
          pendingSummary
            ? `The Course in the Ward for ${cardDayLabel} is waiting for the physician's approval.`
            : `No Course in the Ward for ${cardDayLabel} yet. Physician summaries are written in the physician workflow.`
        }
      />
    </>
  );

  const orderActionsColumn = detailPatient && (
    <>
      {canEnterOrders && detailPatient.admissionId ? (
        <Section icon={SECTION_ICONS.triage} title="Doctor's Order" hint="Type an order received from the physician">
          <OnBehalfOrderForm
            key={detailPatient.admissionId}
            admissionId={detailPatient.admissionId}
            careTeamNames={careTeamNames}
            onSaved={(saved) => addOrder(detailPatient.id, saved)}
          />
        </Section>
      ) : (
        <p style={ui.muted}>This patient is discharged; no new orders can be entered.</p>
      )}
    </>
  );

  return (
    <div>
      <section style={patientTableStyles.card}>
        <h2 style={patientTableStyles.cardTitle}>Patient Overview</h2>
        <DataTableToolbar
          searchProps={{
            value: table.query,
            onChange: table.setQuery,
            placeholder: 'Search patient',
            ariaLabel: 'Search patients',
          }}
          filterProps={{
            title: 'Patient status',
            options: [
              { value: 'all', label: 'All patients' },
              ...ADMISSION_STATUSES.map((status) => ({ value: status, label: status })),
            ],
            value: table.filters.status ?? 'all',
            onChange: (value) => table.setFilter('status', value),
          }}
          sortProps={{
            title: 'Sort patients by',
            options: [
              { value: 'admissionDate', label: 'Admission date' },
              { value: 'triage', label: 'Triage priority' },
              { value: 'daysInCare', label: 'Days in care' },
              { value: 'age', label: 'Age' },
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
              <th style={patientTableStyles.th}>Patient</th>
              <th style={patientTableStyles.th}>Ward</th>
              <th style={patientTableStyles.th}>Triage</th>
              <th style={patientTableStyles.th}>Sex</th>
              <th style={patientTableStyles.th}>Age</th>
              <th style={patientTableStyles.th}>Admitted</th>
              <th style={patientTableStyles.th}>Days in care</th>
              <th style={patientTableStyles.th}>Status</th>
              <th style={{ ...patientTableStyles.th, textAlign: 'right' }} />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((p) => {
              if (p.restricted) {
                return (
                  <tr key={p.id} style={patientTableStyles.tr}>
                    <td style={patientTableStyles.td}>
                      <span style={patientTableStyles.name}>{p.name}</span>
                    </td>
                    <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>{p.location}</td>
                    <td style={patientTableStyles.td} colSpan={6} />
                    <td style={{ ...patientTableStyles.td, textAlign: 'right' }}>
                      <OtherWardLabel />
                    </td>
                  </tr>
                );
              }
              return (
                <tr
                  key={p.id}
                  onClick={() => openPatient(p.id)}
                  style={{ ...patientTableStyles.tr, cursor: 'pointer' }}
                >
                  <td style={patientTableStyles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ ...patientTableStyles.dot, backgroundColor: statusColor(p.status ?? 'admitted') }} />
                      <span style={patientTableStyles.name}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>{p.location}</td>
                  <td style={patientTableStyles.td}>
                    <TriageBadge level={p.triage?.level} compact />
                  </td>
                  <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>{p.gender}</td>
                  <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>{p.age}</td>
                  <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>{p.admissionDate}</td>
                  <td style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}>
                    {p.daysInCare} {p.daysInCare === 1 ? 'day' : 'days'}
                  </td>
                  <td style={patientTableStyles.td}>
                    <StatusBadge
                      status={STATUS_TONE[displayStatus(p)]}
                      label={displayStatus(p)}
                      showDot
                    />
                  </td>
                  <td style={{ ...patientTableStyles.td, textAlign: 'right' }}>
                    <button
                      type="button"
                      style={patientTableStyles.viewBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        openPatient(p.id);
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
            {!table.rows.length && (
              <tr>
                <td
                  style={{ ...patientTableStyles.td, ...patientTableStyles.cell }}
                  colSpan={9}
                >
                  {patients.length === 0
                    ? 'No patients are currently admitted.'
                    : 'No patients match the current filters.'}
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

      {detailChart && (
        <PatientDetailModal
          chart={detailChart}
          status={detailStatus}
          onCareTeamChanged={() => {
            loadPatients().catch(() => undefined);
          }}
          onRoomChanged={() => {
            loadPatients().catch(() => undefined);
          }}
          onClose={() => setSelectedId(null)}
          ordersColumn={ordersColumn}
          orderActionsColumn={orderActionsColumn}
        />
      )}
    </div>
  );
}
