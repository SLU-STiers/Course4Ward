/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { DataTableToolbar, PageHeader, Pagination } from '../../components/ui';
import { useTableState } from '../../hooks/useTableState';
import { formatDateLongFromKey } from '../../lib/format';
import documentImg from '../../Img/document.png';
import llamaIcon from '../../Img/llama.png';
import { ui } from './styles';

import { DEFAULT_ORDER_SETS, DEFAULT_SUMMARIES, MOCK_PATIENTS, resolveChart } from './data';
import { PatientDetailModal } from './PatientDetailModal';
import type { NursePatient, OrderSet, PatientChart } from './types';

export function ManagementPortalView({ charts }: { charts: Record<string, PatientChart> }) {
  const [patients] = useState(MOCK_PATIENTS);
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_PATIENTS[0].id);
  const [viewedIds, setViewedIds] = useState<string[]>([MOCK_PATIENTS[0].id]);
  const [selectedDate, setSelectedDate] = useState('2026-04-15');
  const [ordersByPatient] = useState<Record<string, OrderSet[]>>(DEFAULT_ORDER_SETS);
  const [detailName, setDetailName] = useState<string | null>(null);

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
    const latest = [...new Set(sets.map((o) => o.dateKey))].sort().reverse()[0] ?? '2026-04-15';
    setSelectedDate(latest);
    setViewedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const shiftDate = (dir: -1 | 1) => {
    if (!datesWithOrders.length) return;
    const idx = Math.max(0, datesWithOrders.indexOf(selectedDate));
    const next = datesWithOrders[idx + dir];
    if (next) setSelectedDate(next);
  };

  const detailChart = detailName ? resolveChart(detailName, charts) : null;

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

            <div style={ui.orderCard}>
              <div style={ui.orderHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={documentImg} alt="Doctor's order" style={{ width: 16, height: 16 }} />
                  <strong>Doctor’s Order</strong>
                </div>
                <div style={ui.dateNav}>
                  <button
                    type="button"
                    style={ui.navChevron}
                    disabled={!datesWithOrders.length || datesWithOrders.indexOf(selectedDate) >= datesWithOrders.length - 1}
                    onClick={() => shiftDate(1)}
                    title="Older date"
                  >
                    ‹
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={ui.dateInput}
                  />
                  <button
                    type="button"
                    style={ui.navChevron}
                    disabled={!datesWithOrders.length || datesWithOrders.indexOf(selectedDate) <= 0}
                    onClick={() => shiftDate(-1)}
                    title="Newer date"
                  >
                    ›
                  </button>
                </div>
              </div>

              {ordersForDate.length ? (
                <div style={ui.orderBox}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                    Showing physician orders for {formatDateLongFromKey(selectedDate)}
                  </div>
                  {ordersForDate.map((set) => (
                    <div key={`${set.doctor}-${set.time}`} style={{ marginBottom: 14 }}>
                      <div style={ui.orderMeta}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{set.doctor}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{set.time}</div>
                        </div>
                        {viewedIds.includes(selected.id) && (
                          <span style={ui.viewedBadge}>✓ Order Viewed</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Orders:</div>
                      <ul style={ui.orderList}>
                        {set.orders.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={ui.muted}>
                  No physician orders for {formatDateLongFromKey(selectedDate)}. Choose another date to view previous
                  orders.
                </p>
              )}
            </div>

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
                  {DEFAULT_SUMMARIES[selected.id] ??
                    `No AI summary yet for ${selected.name}. Physician orders will appear here once summarized.`}
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
          canAddDoctor={false}
          onClose={() => setDetailName(null)}
        />
      )}
    </div>
  );
}
