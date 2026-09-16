/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useEffect, useState } from 'react';
import { DataTableToolbar, PageHeader, Pagination } from '../../components/ui';
import { SubmittedOrdersTimeline } from '../../components/orders/SubmittedOrdersTimeline';
import { useTableState } from '../../hooks/useTableState';
import { formatDateLongFromKey } from '../../lib/format';
import llamaIcon from '../../Img/llama.png';
import { ui } from './styles';
import { PatientDetailModal } from './PatientDetailModal';
import type { NursePatient, OrderSet } from './types';
import { ordersApi, patientsApi } from '../../services/domainApi';
import type { Patient, PhysicianOrder } from '../../types';

const colors = ['#ef4444', '#22c55e', '#84cc16', '#6366f1', '#eab308', '#06b6d4'];

function mapPatient(patient: Patient, index: number): NursePatient {
  const admission = patient.admissions?.[0];
  const name = `${patient.firstName} ${patient.lastName}`;
  return {
    id: patient.id,
    name,
    patientId: patient.id,
    recordId: admission?.id ?? patient.id,
    admissionDate: admission ? new Date(admission.admissionDate).toLocaleDateString('en-GB') : '—',
    color: colors[index % colors.length],
    age: patient.dateOfBirth ? Math.max(0, new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()) : 0,
    gender: patient.gender ?? '—',
    initials: `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`,
    status: admission?.dischargeDate ? 'discharged' : 'admitted',
    initialAssessment: admission?.initialAssessment,
    assignedDoctor: admission?.physician
      ? `Dr. ${admission.physician.firstName} ${admission.physician.lastName}`
      : null,
  };
}

function mapOrder(order: PhysicianOrder): OrderSet {
  const date = new Date(order.dateCreated);
  return {
    dateKey: date.toISOString().slice(0, 10),
    dateLabel: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    doctor: order.orderedBy ? `Dr. ${order.orderedBy.firstName} ${order.orderedBy.lastName}` : 'Physician',
    orders: [order.orderContent],
  };
}

export function ManagementPortalView() {
  const [patients, setPatients] = useState<NursePatient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [ordersByPatient, setOrdersByPatient] = useState<Record<string, OrderSet[]>>({});
  const [detailName, setDetailName] = useState<string | null>(null);

  useEffect(() => {
    patientsApi.list().then(({ data }) => {
      const mapped = data.map(mapPatient);
      setPatients(mapped);
      if (mapped[0]) setSelectedId(mapped[0].id);
    }).catch(() => setPatients([]));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    ordersApi.forPatient(selectedId).then(({ data }) => {
      const mapped = data.filter((order) => order.active).map(mapOrder);
      setOrdersByPatient((previous) => ({ ...previous, [selectedId]: mapped }));
      setSelectedDate((current) => current || mapped[0]?.dateKey || '');
    }).catch(() => setOrdersByPatient((previous) => ({ ...previous, [selectedId]: [] })));
  }, [selectedId]);

  const table = useTableState<NursePatient>({
    items: patients,
    pageSize: 8,
    searchFields: (patient) => [patient.name, patient.patientId, patient.recordId],
    filterPredicates: {
      status: (patient, value) => value === 'all' || (patient.status ?? 'admitted') === value,
    },
    initialFilters: { status: 'all' },
    sorters: {
      name: (patient) => patient.name,
      patientId: (patient) => patient.patientId,
      admissionDate: (patient) => patient.admissionDate,
    },
    initialSort: { field: 'admissionDate', direction: 'descending' },
  });

  const selected = patients.find((p) => p.id === selectedId) ?? null;

  const orderSets = selected ? ordersByPatient[selected.id] ?? [] : [];
  const datesWithOrders = [...new Set(orderSets.map((o) => o.dateKey))].sort().reverse();
  const ordersForDate = orderSets.filter((o) => o.dateKey === selectedDate);

  const openPatient = (id: string) => {
    setSelectedId(id);
    const sets = ordersByPatient[id] ?? [];
    const latest = [...new Set(sets.map((o) => o.dateKey))].sort().reverse()[0] ?? '';
    setSelectedDate(latest);
  };

  const shiftDate = (dir: -1 | 1) => {
    if (!datesWithOrders.length) return;
    const idx = Math.max(0, datesWithOrders.indexOf(selectedDate));
    const next = datesWithOrders[idx + dir];
    if (next) setSelectedDate(next);
  };

  const detailPatient = detailName ? patients.find((patient) => patient.name === detailName) : null;
  const detailChart = detailPatient ? {
    name: detailPatient.name,
    age: detailPatient.age,
    gender: detailPatient.gender,
    admissionDate: detailPatient.admissionDate,
    recordId: detailPatient.recordId,
    assignedDoctors: detailPatient.assignedDoctor
      ? [detailPatient.assignedDoctor]
      : [],
    triage: {
      time: '—',
      heartRate: '—',
      respRate: '—',
      spo2: '—',
      bp: '—',
      temp: '—',
      pain: '—',
      notes: detailPatient.initialAssessment ?? 'No triage assessment recorded.',
    },
  } : null;

  return (
    <div style={ui.layout}>
      <section style={ui.card}>
        <PageHeader title="Patient Overview" />
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
              { value: 'admitted', label: 'Admitted' },
              { value: 'discharged', label: 'Discharged' },
            ],
            value: table.filters.status ?? 'all',
            onChange: (value) => table.setFilter('status', value),
          }}
          sortProps={{
            title: 'Sort patients by',
            options: [
              { value: 'name', label: 'Patient name' },
              { value: 'patientId', label: 'Patient ID' },
              { value: 'admissionDate', label: 'Admission date' },
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
              <th style={ui.th}>Patient</th>
              <th style={ui.th}>Patient ID</th>
              <th style={ui.th}>Admission Date</th>
              <th style={{ ...ui.th, textAlign: 'right' }} />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((p) => {
              const active = p.id === selectedId;
              return (
                <tr
                  key={p.id}
                  onClick={() => openPatient(p.id)}
                  style={{
                    backgroundColor: active ? '#f1f5f9' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <td style={ui.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ ...ui.dot, backgroundColor: p.status === 'discharged' ? '#ef4444' : '#22c55e' }} />
                      <span style={{ fontWeight: 600, color: '#334155' }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ ...ui.td, color: '#64748b' }}>{p.patientId}</td>
                  <td style={{ ...ui.td, color: '#64748b' }}>{p.admissionDate}</td>
                  <td style={{ ...ui.td, textAlign: 'right' }}>
                    <button
                      type="button"
                      style={ui.viewBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        openPatient(p.id);
                        setDetailName(p.name);
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
        <div className="ui-table-footer">
          <span className="ui-table-footer__info">
            Showing {table.rangeStart} to {table.rangeEnd} of {table.total} patients
          </span>
          <Pagination page={table.page} pageCount={table.pageCount} onPageChange={table.setPage} />
        </div>
      </section>

      <section style={ui.detailCol}>
        {selected ? (
          <>
            <div style={ui.patientHeader}>
              <div style={{ ...ui.patientAvatar, backgroundColor: selected.color }}>{selected.initials}</div>
              <div>
                <h2 style={{ ...ui.sectionTitle, margin: 0 }}>{selected.name}</h2>
                <div style={ui.metaRow}>
                  <span>Patient ID: {selected.recordId}</span>
                  <span>Age: {selected.age}</span>
                  <span>Gender: {selected.gender}</span>
                  <span>Admission Date: {selected.admissionDate}</span>
                </div>
              </div>
            </div>

            <SubmittedOrdersTimeline
              dateValue={selectedDate}
              onDateChange={setSelectedDate}
              onPrev={() => shiftDate(1)}
              onNext={() => shiftDate(-1)}
              prevDisabled={!datesWithOrders.length || datesWithOrders.indexOf(selectedDate) >= datesWithOrders.length - 1}
              nextDisabled={!datesWithOrders.length || datesWithOrders.indexOf(selectedDate) <= 0}
              orders={ordersForDate.flatMap((set) => set.orders.map((content, index) => ({
                id: `${set.dateKey}-${set.time}-${index}`,
                dateCreated: `${set.dateKey}T00:00:00`,
                dateLabel: set.dateLabel,
                timeLabel: set.time,
                doctor: set.doctor,
                content,
              })))}
              emptyMessage={`No physician orders for ${formatDateLongFromKey(selectedDate)}. Choose another date to view previous orders.`}
            />

            <div style={ui.aiCard}>
              <div style={ui.aiHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={llamaIcon} alt="" style={{ width: 16, height: 16, display: 'block', objectFit: 'contain' }} />
                  <span style={ui.aiTitle}>AI Summarized</span>
                </div>
                <span style={ui.aiBadge}>AI Draft ready</span>
              </div>
              <div style={ui.aiBody}>
                <p style={ui.aiText}>
                  {`No AI summary loaded for ${selected.name}. Physician summaries are available through the physician workflow.`}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p style={ui.muted}>Select a patient to view physician orders.</p>
        )}
      </section>

      {detailChart && (
        <PatientDetailModal
          chart={detailChart}
          onClose={() => setDetailName(null)}
        />
      )}
    </div>
  );
}
