/** Part of the physician dashboard — see index.tsx for the screen shell. */

import React, { useEffect, useState } from 'react';
import { patientsApi } from '../../services/domainApi';
import { StatusBadge } from '../../components/ui';
import { overview, TEAL } from './styles';

import { CalendarWidget } from './CalendarWidget';
import { BedIcon, HeartIcon, WheelchairIcon } from './icons';
import { mapPatient } from './patient';
import { TodoListWidget } from './TodoListWidget';
import type { DashboardPatient, OverviewFilter } from './types';

export function OverviewView() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<OverviewFilter>("admitted");
  const [patients, setPatients] = useState<DashboardPatient[]>([]);
  const pageSize = 8;

  useEffect(() => {
    patientsApi
      .assignedToMe()
      .then(({ data }) => setPatients(data.map(mapPatient)))
      .catch(() => setPatients([]));
  }, []);

  const admittedCount = patients.filter((p) => p.status === "admitted").length;
  const dischargedCount = patients.filter(
    (p) => p.status === "discharged",
  ).length;
  const filteredPatients =
    filter === "all" ? patients : patients.filter((p) => p.status === filter);

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
          color={TEAL}
          label="Total Patients"
          value={String(patients.length)}
          icon={<HeartIcon />}
          active={filter === "all"}
          onClick={() => setFilterAndReset("all")}
        />
        <StatCard
          color={TEAL}
          label="Admitted Patients"
          value={String(admittedCount)}
          icon={<BedIcon />}
          active={filter === "admitted"}
          onClick={() => setFilterAndReset("admitted")}
        />
        <StatCard
          color={TEAL}
          label="Discharged Patients"
          value={String(dischargedCount)}
          icon={<WheelchairIcon />}
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
                  <th style={overview.th}>Sex</th>
                  <th style={overview.th}>Admitted</th>
                  <th style={overview.th}>Days in care</th>
                  <th style={overview.th}>Status</th>
                  <th style={{ ...overview.th, width: 36 }} />
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
                  <td style={{ ...overview.td, color: "#64748b" }}>
                    {p.gender}
                  </td>
                  <td style={{ ...overview.td, color: "#64748b" }}>
                    {p.admissionDate}
                  </td>
                  <td style={{ ...overview.td, color: "#64748b" }}>
                    {p.daysInCare} {p.daysInCare === 1 ? "day" : "days"}
                  </td>
                  <td style={overview.td}>
                    <StatusBadge status={p.status} showDot />
                  </td>
                  <td style={{ ...overview.td, textAlign: "right", width: 36 }}>
                    <span style={overview.rowDots}>⋯</span>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </section>

        <div style={overview.rightCol}>
          <CalendarWidget />
          <TodoListWidget />
        </div>
      </div>
    </div>
  );
}
function StatCard({
  color,
  label,
  value,
  icon,
  active,
  onClick,
}: {
  color: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = color;
      }}
      style={{
        ...overview.statCard,
        backgroundColor: color,
        boxShadow: active
          ? "0 10px 28px rgba(16, 78, 101, 0.38)"
          : "0 10px 24px rgba(16, 78, 101, 0.22)",
        transform: active ? "translateY(-1px)" : "none",
      }}
    >
      <div style={overview.statIcon}>{icon}</div>
      <div>
        <div style={overview.statLabel}>{label}</div>
        <div style={overview.statValue}>{value}</div>
      </div>
    </button>
  );
}
