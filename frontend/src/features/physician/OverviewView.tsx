/** Part of the physician dashboard — see index.tsx for the screen shell. */

import React, { useCallback, useEffect, useState } from 'react';
import { patientsApi } from '../../services/domainApi';
import { ORDER_POLL_MS, usePolling } from '../../hooks/usePolling';
import { StatusBadge, TriageBadge } from '../../components/ui';
import { overview } from './styles';

import { CalendarWidget } from './CalendarWidget';
import { BedIcon, HeartIcon, WheelchairIcon } from './icons';
import { mapPatient } from './patient';
import { triageQueueKey } from '../../lib/triage';
import { TodoListWidget } from './TodoListWidget';
import type { DashboardPatient, OverviewFilter } from './types';

export function OverviewView() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<OverviewFilter>("all");
  const [patients, setPatients] = useState<DashboardPatient[]>([]);
  const pageSize = 8;

  const loadPatients = useCallback(() => {
    patientsApi
      .assignedToMe()
      .then(({ data }) => setPatients(data.map(mapPatient)))
      .catch(() => setPatients([]));
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  usePolling(loadPatients, ORDER_POLL_MS);

  const admittedCount = patients.filter((p) => p.status === "admitted").length;
  const dischargedCount = patients.filter(
    (p) => p.status === "discharged",
  ).length;
  // Active patients first, most urgent then longest waiting; discharged
  // patients after them in their existing (most recently updated) order.
  const filteredPatients = (
    filter === "all" ? patients : patients.filter((p) => p.status === filter)
  )
    .slice()
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "admitted" ? -1 : 1;
      if (a.status === "discharged") return 0;
      return (
        triageQueueKey(b.triageLevel, b.admittedAt) -
        triageQueueKey(a.triageLevel, a.admittedAt)
      );
    });

  const pageCount = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filteredPatients.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );
  const listTitle =
    filter === "admitted"
      ? "Admitted Patients"
      : filter === "discharged"
        ? "Discharged Patients"
        : "Patient Lists";

  const setFilterAndReset = (next: OverviewFilter) => {
    setFilter(next);
    setPage(0);
  };

  return (
    <div style={overview.page}>
      <div style={overview.statsRow}>
        <StatCard
          tone="total"
          label="Total Patients"
          value={String(patients.length)}
          icon={<HeartIcon color="#2563eb" />}
          active={filter === "all"}
          onClick={() => setFilterAndReset("all")}
        />
        <StatCard
          tone="admitted"
          label="Admitted Patients"
          value={String(admittedCount)}
          icon={<BedIcon color="#16a34a" />}
          active={filter === "admitted"}
          onClick={() => setFilterAndReset("admitted")}
        />
        <StatCard
          tone="discharged"
          label="Discharged Patients"
          value={String(dischargedCount)}
          icon={<WheelchairIcon color="#dc2626" />}
          active={filter === "discharged"}
          onClick={() => setFilterAndReset("discharged")}
        />
      </div>

      <div style={overview.grid}>
        <section style={overview.patientCard}>
          <div style={overview.patientHeader}>
            <h2 style={overview.sectionTitle}>{listTitle}</h2>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                style={overview.pageChevron}
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ‹
              </button>
              <button
                type="button"
                style={overview.pageChevron}
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                ›
              </button>
            </div>
          </div>

          <div style={overview.tableScroll}>
            <table style={overview.table}>
              <thead>
                <tr>
                  <th style={{ ...overview.th, width: 22 }} />
                  <th style={overview.th}>Patient</th>
                  <th style={overview.th}>Triage</th>
                  <th style={overview.th}>Sex</th>
                  <th style={overview.th}>Admitted</th>
                  {filter === "discharged" && <th style={overview.th}>Discharged</th>}
                  <th style={overview.th}>Days in care</th>
                  <th style={overview.th}>Status</th>
                </tr>
              </thead>
              <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...overview.td, width: 22 }}>
                    <span
                      style={{
                        ...overview.dot,
                        backgroundColor:
                          p.status === "admitted" ? "#22c55e" : "#ef4444",
                      }}
                    />
                  </td>
                  <td
                    style={{
                      ...overview.td,
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    {p.name}
                  </td>
                  <td style={overview.td}>
                    <TriageBadge level={p.triageLevel} compact />
                  </td>
                  <td style={{ ...overview.td, color: "#64748b" }}>
                    {p.gender}
                  </td>
                  <td style={{ ...overview.td, color: "#64748b" }}>
                    {p.admissionDate}
                  </td>
                  {filter === "discharged" && (
                    <td style={{ ...overview.td, color: "#64748b" }}>
                      {p.dischargeDate}
                    </td>
                  )}
                  <td style={{ ...overview.td, color: "#64748b" }}>
                    {p.daysInCare} {p.daysInCare === 1 ? "day" : "days"}
                  </td>
                  <td style={overview.td}>
                    <StatusBadge status={p.status} showDot />
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </section>

        <div style={overview.rightCol}>
          <CalendarWidget />
          <TodoListWidget patients={patients} />
        </div>
      </div>
    </div>
  );
}
function StatCard({
  tone,
  label,
  value,
  icon,
  active,
  onClick,
}: {
  tone: "total" | "admitted" | "discharged";
  label: string;
  value: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={
        tone === "total"
          ? "physician-overview-stat"
          : `physician-overview-stat physician-overview-stat--${tone}`
      }
      aria-pressed={active}
      onClick={onClick}
    >
      <div className="physician-overview-stat__icon">{icon}</div>
      <div>
        <div className="physician-overview-stat__label">{label}</div>
        <div className="physician-overview-stat__value">{value}</div>
      </div>
    </button>
  );
}