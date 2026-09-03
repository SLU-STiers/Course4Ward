import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import logoImg from '../Img/Course4Ward-Logo.png';

type TabType = 'overview' | 'manage' | 'requests';

const TEAL = '#104E65';
const CARD_SHADOW = '0 8px 28px rgba(16, 78, 101, 0.08)';

type PatientStatus = 'admitted' | 'discharged';
type OverviewFilter = 'all' | PatientStatus;

const MOCK_PATIENTS: {
  id: string;
  name: string;
  patientId: string;
  admissionDate: string;
  color: string;
  status: PatientStatus;
}[] = [
  { id: '1', name: 'Sarah Brown', patientId: '1123', admissionDate: '15/04/2026', color: '#ef4444', status: 'admitted' },
  { id: '2', name: 'Michael Owen', patientId: '1122', admissionDate: '15/04/2026', color: '#22c55e', status: 'admitted' },
  { id: '3', name: 'Mary Jane', patientId: '1121', admissionDate: '14/04/2026', color: '#84cc16', status: 'admitted' },
  { id: '4', name: 'Peter Doolie', patientId: '1120', admissionDate: '14/04/2026', color: '#6366f1', status: 'admitted' },
  { id: '5', name: 'Peter Doolie', patientId: '1119', admissionDate: '14/04/2026', color: '#ef4444', status: 'admitted' },
  { id: '6', name: 'Peter Doolie', patientId: '1118', admissionDate: '15/04/2026', color: '#eab308', status: 'admitted' },
  { id: '7', name: 'Liam Park', patientId: '1117', admissionDate: '15/04/2026', color: '#d946ef', status: 'admitted' },
  { id: '8', name: 'Nora Reyes', patientId: '1116', admissionDate: '16/04/2026', color: '#f87171', status: 'admitted' },
  { id: '9', name: 'James Cruz', patientId: '1115', admissionDate: '16/04/2026', color: '#06b6d4', status: 'admitted' },
  { id: '10', name: 'Elena Santos', patientId: '1114', admissionDate: '17/04/2026', color: '#0ea5e9', status: 'admitted' },
  { id: '11', name: 'Carlos Vega', patientId: '1113', admissionDate: '17/04/2026', color: '#f97316', status: 'admitted' },
  { id: '12', name: 'Ava Lim', patientId: '1112', admissionDate: '18/04/2026', color: '#14b8a6', status: 'admitted' },
  { id: '13', name: 'Ben Torres', patientId: '1111', admissionDate: '10/04/2026', color: '#64748b', status: 'discharged' },
  { id: '14', name: 'Mia Chen', patientId: '1110', admissionDate: '09/04/2026', color: '#a855f7', status: 'discharged' },
  { id: '15', name: 'Owen Blake', patientId: '1109', admissionDate: '08/04/2026', color: '#e11d48', status: 'discharged' },
  { id: '16', name: 'Ruby Diaz', patientId: '1108', admissionDate: '07/04/2026', color: '#65a30d', status: 'discharged' },
  { id: '17', name: 'Noah Kim', patientId: '1107', admissionDate: '06/04/2026', color: '#2563eb', status: 'discharged' },
  { id: '18', name: 'Ivy Morales', patientId: '1106', admissionDate: '05/04/2026', color: '#db2777', status: 'discharged' },
  { id: '19', name: 'Leo Santos', patientId: '1105', admissionDate: '04/04/2026', color: '#ca8a04', status: 'discharged' },
  { id: '20', name: 'Paula Reed', patientId: '1104', admissionDate: '03/04/2026', color: '#7c3aed', status: 'discharged' },
];

const INITIAL_TODOS = [
  'Review newly admitted patients',
  'Update patient diagnoses',
  'Check lab/test results',
  'Monitor critical patients',
  'Approve discharge requests',
  'Review pending CF4 forms',
  'Verify AI-generated summaries',
  'Complete missing CF4 details',
  'Validate records (BAG check)',
];

const DEFAULT_ORDERS: Record<string, string[]> = {
  '1': [
    'IV Ceftriaxone 1g q12h',
    'Paracetamol 500mg PRN for fever',
    'Monitor vital signs every 2 hours',
    'Chest x-ray',
  ],
};

const DEFAULT_SUMMARY: Record<string, string> = {
  '1':
    'Patient was maintained on intravenous Ceftriaxone 1g every 12 hours and was given Paracetamol 500mg as needed for fever. Vital signs were regularly monitored every 2 hours. A chest X-ray was also requested for further assessment. The patient remained under close observation throughout the monitoring period.',
};

const MOCK_PHYSICIAN_ORDERS = [
  {
    when: 'April 15, 2026',
    time: 'Today, 1:00 PM',
    doctor: 'Dr. Mike Mentzer',
    orders: [
      'IV Ceftriaxone 1g q12h',
      'Paracetamol 500mg PRN for fever',
      'Monitor vital signs every 2 hours',
      'Chest X-ray',
    ],
  },
  {
    when: 'April 15, 2026',
    time: 'Today, 8:00 AM',
    doctor: 'Dr. Agcaoili Diddy',
    orders: ['Continue oxygen support at 2L/min', 'CBC repeat at 6 PM', 'Encourage oral fluids'],
  },
  {
    when: 'April 14, 2026',
    time: 'Yesterday, 4:30 PM',
    doctor: 'Dr. Jecy Guillian',
    orders: ['Continue antibiotics', 'Observe for respiratory distress'],
  },
];

type RequestStatus = 'Pending Review' | 'Reviewed';

const MOCK_REQUESTS: {
  id: string;
  patient: string;
  patientId: string;
  submittedBy: string;
  role: string;
  date: string;
  time: string;
  status: RequestStatus;
  summary: string;
}[] = [
  {
    id: 'SUM-0001',
    patient: 'Sarah Brown',
    patientId: '1123',
    submittedBy: 'Steve Jacobs',
    role: 'Claims Processor',
    date: '15/04/2026',
    time: '08:00 AM',
    status: 'Pending Review',
    summary:
      'Patient was maintained on IV Ceftriaxone every 12 hours, with Paracetamol given as needed for fever. Oxygen support was continued at 2L/min, and repeat laboratory tests were requested.',
  },
  {
    id: 'SUM-0002',
    patient: 'Michael Owen',
    patientId: '1122',
    submittedBy: 'Steve Jacobs',
    role: 'Claims Processor',
    date: '15/04/2026',
    time: '07:50 AM',
    status: 'Pending Review',
    summary: 'Patient presented with mild hypertension. Administered routine medications and remained stable.',
  },
  {
    id: 'SUM-0003',
    patient: 'Mary Jane',
    patientId: '1121',
    submittedBy: 'Anna Cruz',
    role: 'Claims Processor',
    date: '14/04/2026',
    time: '04:30 PM',
    status: 'Reviewed',
    summary: 'Patient recovering well post-operation. Discharged with oral medications.',
  },
  {
    id: 'SUM-0004',
    patient: 'Peter Doolie',
    patientId: '1120',
    submittedBy: 'Steve Jacobs',
    role: 'Claims Processor',
    date: '14/04/2026',
    time: '02:15 PM',
    status: 'Pending Review',
    summary: 'Observation for respiratory symptoms. Oxygen saturation remained steady.',
  },
  {
    id: 'SUM-0005',
    patient: 'Anna Kendrick',
    patientId: '1119',
    submittedBy: 'Anna Cruz',
    role: 'Claims Processor',
    date: '14/04/2026',
    time: '11:45 AM',
    status: 'Reviewed',
    summary: 'Routine checkup completed without complications.',
  },
  {
    id: 'SUM-0006',
    patient: 'Sarah Brown',
    patientId: '1123',
    submittedBy: 'Steve Jacobs',
    role: 'Claims Processor',
    date: '13/04/2026',
    time: '09:20 AM',
    status: 'Pending Review',
    summary: 'Follow-up summary after overnight monitoring. Vitals remained within normal limits.',
  },
  {
    id: 'SUM-0007',
    patient: 'Michael Owen',
    patientId: '1122',
    submittedBy: 'Anna Cruz',
    role: 'Claims Processor',
    date: '13/04/2026',
    time: '08:10 AM',
    status: 'Reviewed',
    summary: 'Blood pressure trending down after medication adjustment.',
  },
  {
    id: 'SUM-0008',
    patient: 'Mary Jane',
    patientId: '1121',
    submittedBy: 'Steve Jacobs',
    role: 'Claims Processor',
    date: '12/04/2026',
    time: '03:40 PM',
    status: 'Pending Review',
    summary: 'Wound site clean and dry. Pain score decreased with current analgesic plan.',
  },
  {
    id: 'SUM-0009',
    patient: 'Peter Doolie',
    patientId: '1118',
    submittedBy: 'Anna Cruz',
    role: 'Claims Processor',
    date: '12/04/2026',
    time: '01:05 PM',
    status: 'Reviewed',
    summary: 'Respiratory rate improved after nebulization. Continue current oxygen support.',
  },
  {
    id: 'SUM-0010',
    patient: 'Liam Park',
    patientId: '1117',
    submittedBy: 'Steve Jacobs',
    role: 'Claims Processor',
    date: '11/04/2026',
    time: '10:00 AM',
    status: 'Pending Review',
    summary: 'New admission summary pending physician confirmation of overnight orders.',
  },
  {
    id: 'SUM-0011',
    patient: 'Nora Reyes',
    patientId: '1116',
    submittedBy: 'Anna Cruz',
    role: 'Claims Processor',
    date: '11/04/2026',
    time: '09:15 AM',
    status: 'Reviewed',
    summary: 'Labs reviewed. No acute findings requiring order changes.',
  },
  {
    id: 'SUM-0012',
    patient: 'Peter Doolie',
    patientId: '1115',
    submittedBy: 'Steve Jacobs',
    role: 'Claims Processor',
    date: '10/04/2026',
    time: '04:55 PM',
    status: 'Pending Review',
    summary: 'CF4 details incomplete. Claims processor requested physician validation.',
  },
];

export function PhysicianDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={shell.appContainer}>
      <aside style={shell.sidebar}>
        <div style={shell.sidebarLogoContainer}>
          <img src={logoImg} alt="Course Toward" style={shell.sidebarLogo} />
        </div>

        <nav style={shell.sidebarNav}>
          <NavItem
            label="Overview"
            icon={<OverviewIcon />}
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          />
          <NavItem
            label="Manage"
            icon={<ManageIcon />}
            active={activeTab === 'manage'}
            onClick={() => setActiveTab('manage')}
          />
          <NavItem
            label="Requests"
            icon={<RequestsIcon />}
            active={activeTab === 'requests'}
            onClick={() => setActiveTab('requests')}
          />
        </nav>

        <div style={shell.sidebarProfile}>
          <div style={shell.profileAvatar}>JD</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={shell.profileName}>Dr. John Doe</div>
            <div style={shell.profileEmail}>johndoe@gmail.com</div>
          </div>
          <button type="button" title="Log out" onClick={handleLogout} style={shell.logoutBtn}>
            Log out
          </button>
        </div>
      </aside>

      <div style={shell.mainWrapper}>
        <header style={shell.header}>
          <div>
            <h1 style={shell.headerTitle}>Good Day! Dr. John</h1>
            <p style={shell.headerSubtitle}>We are pleased to have you!</p>
          </div>
          <div style={shell.bellWrap}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>🔔</span>
            <span style={shell.bellBadge}>2</span>
          </div>
        </header>

        <main style={shell.content}>
          {activeTab === 'overview' && <OverviewView />}
          {activeTab === 'manage' && <ManageView />}
          {activeTab === 'requests' && <RequestsView />}
        </main>
      </div>
    </div>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...shell.navButton,
        ...(active ? shell.navButtonActive : {}),
      }}
    >
      <span style={shell.navIcon}>{icon}</span>
      {label}
    </button>
  );
}

function OverviewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ManageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 6.5h10v6A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M6 6.5V5a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function RequestsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 11.5V4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v4A1.5 1.5 0 0 1 11.5 10H6l-3 2.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 5.5v3M6.5 7h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function parseAdmissionDate(value: string) {
  const [dd, mm, yyyy] = value.split('/').map(Number);
  return new Date(yyyy, (mm || 1) - 1, dd || 1);
}

function monthCells(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: firstDow }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function OverviewView() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<OverviewFilter>('all');
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const pageSize = 8;

  const admittedCount = MOCK_PATIENTS.filter((p) => p.status === 'admitted').length;
  const dischargedCount = MOCK_PATIENTS.filter((p) => p.status === 'discharged').length;
  const filteredPatients =
    filter === 'all' ? MOCK_PATIENTS : MOCK_PATIENTS.filter((p) => p.status === filter);

  const pageCount = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filteredPatients.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const listTitle =
    filter === 'admitted' ? 'Admitted Patients' : filter === 'discharged' ? 'Discharged Patients' : 'Patient Lists';

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
          value={String(MOCK_PATIENTS.length)}
          icon={<HeartIcon />}
          active={filter === 'all'}
          onClick={() => setFilterAndReset('all')}
        />
        <StatCard
          color={TEAL}
          label="Admitted Patients"
          value={String(admittedCount)}
          icon={<BedIcon />}
          active={filter === 'admitted'}
          onClick={() => setFilterAndReset('admitted')}
        />
        <StatCard
          color={TEAL}
          label="Discharged Patients"
          value={String(dischargedCount)}
          icon={<WheelchairIcon />}
          active={filter === 'discharged'}
          onClick={() => setFilterAndReset('discharged')}
        />
      </div>

      <div style={overview.grid}>
        <section style={overview.patientCard}>
          <div style={overview.patientHeader}>
            <h2 style={overview.sectionTitle}>{listTitle}</h2>
            <div style={{ display: 'flex', gap: 6 }}>
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

          <table style={overview.table}>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...overview.td, width: 28 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(checkedIds[p.id])}
                      onChange={() =>
                        setCheckedIds((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                      }
                      style={overview.checkbox}
                      aria-label={`Select ${p.name}`}
                    />
                  </td>
                  <td style={{ ...overview.td, width: 22 }}>
                    <span style={{ ...overview.dot, backgroundColor: p.color }} />
                  </td>
                  <td style={{ ...overview.td, fontWeight: 600, color: '#1e293b' }}>{p.name}</td>
                  <td style={{ ...overview.td, color: '#64748b' }}>{p.patientId}</td>
                  <td style={{ ...overview.td, color: '#64748b' }}>{p.admissionDate}</td>
                  <td style={{ ...overview.td, textAlign: 'right', width: 36 }}>
                    <span style={overview.rowDots}>⋯</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        boxShadow: active ? '0 10px 28px rgba(16, 78, 101, 0.38)' : '0 10px 24px rgba(16, 78, 101, 0.22)',
        transform: active ? 'translateY(-1px)' : 'none',
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

function HeartIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M14 23s-8-5.2-8-10.2C6 9.6 8.2 7.5 11 7.5c1.6 0 2.6.8 3 1.6.4-.8 1.4-1.6 3-1.6 2.8 0 5 2.1 5 5.3C22 17.8 14 23 14 23z"
        stroke={TEAL}
        strokeWidth="1.8"
      />
      <path d="M8 14h3l1.5-3 2 6 1.5-3H20" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BedIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="9" cy="10" r="2.2" stroke={TEAL} strokeWidth="1.8" />
      <path d="M5 20v-5.5h16A2.5 2.5 0 0 1 23.5 17v3M5 16.5h10" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WheelchairIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="11" cy="8" r="2" stroke={TEAL} strokeWidth="1.8" />
      <path d="M11 10.5v4.5h6l2.5 5" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11" cy="19" r="3.5" stroke={TEAL} strokeWidth="1.8" />
    </svg>
  );
}

function CalendarWidget() {
  const [cursor, setCursor] = useState(new Date(2026, 5, 1));
  const [selected, setSelected] = useState(30);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const label = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <section style={overview.widget}>
      <div style={overview.calNav}>
        <button
          type="button"
          style={overview.pageChevron}
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          ‹
        </button>
        <span style={overview.calMonth}>{label}</span>
        <button
          type="button"
          style={overview.pageChevron}
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          ›
        </button>
      </div>
      <div style={overview.calGrid}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={`${d}-${i}`} style={overview.calDow}>
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <button
            key={i}
            type="button"
            disabled={!day}
            onClick={() => day && setSelected(day)}
            style={{
              ...overview.calDay,
              ...(day === selected ? overview.calDayActive : {}),
              visibility: day ? 'visible' : 'hidden',
            }}
          >
            {day}
          </button>
        ))}
      </div>
    </section>
  );
}

function TodoListWidget() {
  const [todos, setTodos] = useState(INITIAL_TODOS.map((text) => ({ text, done: false })));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    setTodos((prev) => [...prev, { text, done: false }]);
    setDraft('');
    setAdding(false);
  };

  return (
    <section style={{ ...overview.widget, flex: 1 }}>
      <div style={overview.todoHeader}>
        <h3 style={{ ...overview.sectionTitle, margin: 0 }}>To do List</h3>
        <button type="button" style={overview.addNotesBtn} onClick={() => setAdding((v) => !v)}>
          Add Notes +
        </button>
      </div>
      {adding && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New note"
            style={overview.addNoteInput}
            onKeyDown={(e) => e.key === 'Enter' && addNote()}
          />
          <button type="button" onClick={addNote} style={overview.addNotesBtn}>
            Save
          </button>
        </div>
      )}
      <ul style={overview.todoList}>
        {todos.map((item, idx) => (
          <li key={`${item.text}-${idx}`} style={overview.todoItem}>
            <label style={overview.todoLabel}>
              <input
                type="checkbox"
                checked={item.done}
                onChange={() =>
                  setTodos((prev) => prev.map((t, i) => (i === idx ? { ...t, done: !t.done } : t)))
                }
                style={overview.checkbox}
              />
              <span style={item.done ? { textDecoration: 'line-through', color: '#94a3b8' } : undefined}>
                {item.text}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RequestsView() {
  const pageSize = 5;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState(MOCK_REQUESTS);
  const [selected, setSelected] = useState<(typeof MOCK_REQUESTS)[number] | null>(null);

  const filtered = items.filter(
    (r) =>
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.patient.toLowerCase().includes(search.toLowerCase()) ||
      r.submittedBy.toLowerCase().includes(search.toLowerCase())
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  const displayPages = [1, 2, 3].filter((n) => n <= pageCount);

  return (
    <section style={requests.card}>
      <div style={requests.headerRow}>
        <div>
          <h2 style={requests.title}>Requests</h2>
          <p style={requests.subtitle}>Review AI summaries submitted by Claims Processors.</p>
        </div>
        <div style={requests.searchWrap}>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search requests..."
            style={requests.searchInput}
          />
          <span style={requests.searchIcon}>🔍</span>
        </div>
      </div>

      <table style={requests.table}>
        <thead>
          <tr>
            <th style={requests.th}>Request ID</th>
            <th style={requests.th}>Patient</th>
            <th style={requests.th}>Submitted By</th>
            <th style={requests.th}>Submitted On</th>
            <th style={requests.th}>Status</th>
            <th style={{ ...requests.th, textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={requests.td}>
                <button type="button" style={requests.idLink} onClick={() => setSelected(r)}>
                  {r.id}
                </button>
              </td>
              <td style={requests.td}>
                <div style={requests.primary}>{r.patient}</div>
                <div style={requests.secondary}>ID: {r.patientId}</div>
              </td>
              <td style={requests.td}>
                <div style={requests.primary}>{r.submittedBy}</div>
                <div style={requests.secondary}>{r.role}</div>
              </td>
              <td style={requests.td}>
                <div style={requests.primary}>{r.date}</div>
                <div style={requests.secondary}>{r.time}</div>
              </td>
              <td style={requests.td}>
                <span style={r.status === 'Pending Review' ? requests.statusPending : requests.statusReviewed}>
                  {r.status}
                </span>
              </td>
              <td style={{ ...requests.td, textAlign: 'right' }}>
                <button type="button" style={requests.reviewBtn} onClick={() => setSelected(r)}>
                  Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={requests.pagination}>
        <span style={requests.pageInfo}>
          Showing {filtered.length ? start + 1 : 0} to {Math.min(start + pageSize, filtered.length)} of{' '}
          {filtered.length} requests
        </span>
        <div style={requests.pageControls}>
          <button
            type="button"
            style={requests.pageBtn}
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          {displayPages.map((n) => (
            <button
              key={n}
              type="button"
              style={{ ...requests.pageBtn, ...(n === safePage ? requests.pageActive : {}) }}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          {pageCount > 3 && (
            <>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>...</span>
              <button
                type="button"
                style={{
                  ...requests.pageBtn,
                  ...(safePage === pageCount ? requests.pageActive : {}),
                }}
                onClick={() => setPage(pageCount)}
              >
                {pageCount}
              </button>
            </>
          )}
          <button
            type="button"
            style={requests.pageBtn}
            disabled={safePage === pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            ›
          </button>
        </div>
      </div>

      {selected && (
        <ReviewSummaryModal
          request={selected}
          onClose={() => setSelected(null)}
          onApprove={() => {
            setItems((prev) =>
              prev.map((r) => (r.id === selected.id ? { ...r, status: 'Reviewed' } : r))
            );
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}

function ReviewSummaryModal({
  request,
  onClose,
  onApprove,
}: {
  request: (typeof MOCK_REQUESTS)[number];
  onClose: () => void;
  onApprove: () => void;
}) {
  const [showOrders, setShowOrders] = useState(true);
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(request.summary);
  const admissionDate =
    MOCK_PATIENTS.find((p) => p.patientId === request.patientId)?.admissionDate ?? request.date;

  useEffect(() => {
    setSummary(request.summary);
    setEditing(false);
    setShowOrders(true);
  }, [request]);

  return (
    <div style={review.overlay}>
      <div style={review.shell}>
        {showOrders && (
          <aside style={review.ordersPanel}>
            <h3 style={review.ordersTitle}>Physicians Orders:</h3>
            <div style={review.ordersScroll}>
              {MOCK_PHYSICIAN_ORDERS.map((group) => (
                <div key={`${group.doctor}-${group.time}`} style={review.orderCard}>
                  <div style={review.orderWhen}>{group.when}</div>
                  <div style={review.orderTime}>{group.time}</div>
                  <div style={review.orderDoctor}>{group.doctor}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, margin: '6px 0 4px' }}>Orders:</div>
                  <ul style={review.orderList}>
                    {group.orders.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>
        )}

        {showOrders && (
          <button type="button" style={review.collapseBtn} onClick={() => setShowOrders(false)} title="Hide orders">
            ›
          </button>
        )}

        <section style={review.mainPanel}>
          <header style={review.header}>
            <div>
              <h2 style={review.headerTitle}>AI Summary Review</h2>
              <div style={review.headerId}>{request.id}</div>
            </div>
            <button type="button" style={review.headerClose} onClick={onClose}>
              ✕
            </button>
          </header>

          <div style={review.body}>
            <div style={review.infoBanner}>
              <span>ℹ️</span>
              <span>
                Please review the AI summary and let us know if it is accurate, needs changes, or is
                incorrect.
              </span>
            </div>

            <div style={review.sectionLabel}>Patient Information</div>
            <div style={review.patientGrid}>
              <label style={review.field}>
                <span style={review.fieldLabel}>Name</span>
                <input readOnly value={request.patient} style={review.fieldInput} />
              </label>
              <label style={review.field}>
                <span style={review.fieldLabel}>Patient ID</span>
                <input readOnly value={request.patientId} style={review.fieldInput} />
              </label>
              <label style={review.field}>
                <span style={review.fieldLabel}>Admission Date</span>
                <input readOnly value={admissionDate} style={review.fieldInput} />
              </label>
            </div>

            <div style={review.sectionLabel}>Submitted By</div>
            <div style={review.submittedCard}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{request.submittedBy}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{request.role}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Submitted on</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                  {request.date} | {request.time}
                </div>
              </div>
            </div>

            <div style={review.aiHeader}>
              <div style={review.sectionLabel}>AI Summarization</div>
              <button type="button" style={review.hideOrdersBtn} onClick={() => setShowOrders((v) => !v)}>
                {showOrders ? 'Hide Orders' : 'Show Orders'}
              </button>
            </div>

            {editing ? (
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={7}
                style={review.summaryEditor}
              />
            ) : (
              <div style={review.summaryBox}>{summary}</div>
            )}

            <div style={review.aiActions}>
              <button type="button" style={review.outlineBtn} onClick={() => setEditing((v) => !v)}>
                ✎ {editing ? 'Save Summary' : 'Edit Summary'}
              </button>
              <button
                type="button"
                style={review.outlineBtn}
                onClick={() => {
                  setSummary(request.summary);
                  setEditing(false);
                }}
              >
                ✨ Regenerate
              </button>
            </div>
          </div>

          <footer style={review.footer}>
            <button type="button" style={review.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="button" style={review.approveBtn} onClick={onApprove}>
              Approve
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}

function CalendarModal({
  open,
  onClose,
  focusDate,
}: {
  open: boolean;
  onClose: () => void;
  focusDate: Date;
}) {
  const [cursor, setCursor] = useState(() => new Date(focusDate.getFullYear(), focusDate.getMonth(), 1));
  const [selected, setSelected] = useState(focusDate);

  useEffect(() => {
    if (!open) return;
    setCursor(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1));
    setSelected(focusDate);
  }, [open, focusDate]);

  if (!open) return null;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = monthCells(year, month);
  const label = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div style={manage.calOverlay} onClick={onClose}>
      <div style={manage.calModal} onClick={(e) => e.stopPropagation()}>
        <div style={manage.calHeader}>
          <h3 style={manage.calTitle}>Calendar</h3>
          <button type="button" style={manage.calClose} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={manage.calNav}>
          <button
            type="button"
            style={manage.calNavBtn}
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            ‹
          </button>
          <span style={manage.calMonth}>{label}</span>
          <button
            type="button"
            style={manage.calNavBtn}
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            ›
          </button>
        </div>
        <div style={manage.calGrid}>
          {weekdays.map((d) => (
            <div key={d} style={manage.calDow}>
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            const date = day ? new Date(year, month, day) : null;
            const isSelected = Boolean(date && sameDay(date, selected));
            return (
              <button
                key={i}
                type="button"
                disabled={!day}
                onClick={() => date && setSelected(date)}
                style={{
                  ...manage.calDay,
                  ...(isSelected ? manage.calDaySelected : {}),
                  visibility: day ? 'visible' : 'hidden',
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function ManageView() {
  const [selectedId, setSelectedId] = useState(MOCK_PATIENTS[0].id);
  const [search, setSearch] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingOrders, setEditingOrders] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = MOCK_PATIENTS.find((p) => p.id === selectedId) ?? MOCK_PATIENTS[0];
  const admissionDate = parseAdmissionDate(selected.admissionDate);

  const [ordersByPatient, setOrdersByPatient] = useState<Record<string, string[]>>(() => ({
    ...DEFAULT_ORDERS,
  }));
  const [draft, setDraft] = useState('');
  const [summaryByPatient, setSummaryByPatient] = useState<Record<string, string>>(() => ({
    ...DEFAULT_SUMMARY,
  }));
  const [editingSummary, setEditingSummary] = useState(false);

  const orders = ordersByPatient[selected.id] ?? [];
  const summary =
    summaryByPatient[selected.id] ??
    'No AI summary yet. Submit orders to generate a draft.';

  const filtered = MOCK_PATIENTS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.patientId.includes(search)
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openPatient = (id: string, edit = false) => {
    setSelectedId(id);
    setEditingSummary(false);
    setDraft('');
    setSubmitted(false);
    setEditingOrders(edit);
    setMenuOpenId(null);
  };

  const addOrder = () => {
    const text = draft.trim();
    if (!text) return;
    setOrdersByPatient((prev) => ({
      ...prev,
      [selected.id]: [...(prev[selected.id] ?? []), text],
    }));
    setDraft('');
    setSubmitted(false);
  };

  const updateOrder = (idx: number, text: string) => {
    setOrdersByPatient((prev) => {
      const next = [...(prev[selected.id] ?? [])];
      next[idx] = text;
      return { ...prev, [selected.id]: next };
    });
    setSubmitted(false);
  };

  const removeOrder = (idx: number) => {
    setOrdersByPatient((prev) => {
      const next = (prev[selected.id] ?? []).filter((_, i) => i !== idx);
      return { ...prev, [selected.id]: next };
    });
    setSubmitted(false);
  };

  return (
    <div style={manage.layout}>
      <section style={manage.listCard}>
        <div style={manage.listHeader}>
          <h2 style={manage.listTitle}>Patients List</h2>
          <div style={manage.searchWrap}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={manage.searchInput}
            />
          </div>
        </div>
        <table style={overview.table}>
          <thead>
            <tr>
              <th style={overview.th}>Patient</th>
              <th style={overview.th}>Patient ID</th>
              <th style={overview.th}>Admission Date</th>
              <th style={{ ...overview.th, width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const active = p.id === selected.id;
              return (
                <tr
                  key={p.id}
                  onClick={() => openPatient(p.id, false)}
                  style={{
                    backgroundColor: active ? '#eef6f8' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <td style={overview.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ ...overview.dot, backgroundColor: p.color }} />
                      <span style={{ fontWeight: 600, color: '#334155' }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ ...overview.td, color: '#64748b' }}>{p.patientId}</td>
                  <td style={{ ...overview.td, color: '#64748b' }}>{p.admissionDate}</td>
                  <td style={{ ...overview.td, textAlign: 'right', position: 'relative' }}>
                    <div ref={menuOpenId === p.id ? menuRef : undefined} style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        type="button"
                        style={manage.dotsBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId((id) => (id === p.id ? null : p.id));
                        }}
                      >
                        ⋯
                      </button>
                      {menuOpenId === p.id && (
                        <div style={manage.rowMenu} onClick={(e) => e.stopPropagation()}>
                          <button type="button" style={manage.rowMenuItem} onClick={() => openPatient(p.id, false)}>
                            View doctor’s order
                          </button>
                          <button type="button" style={manage.rowMenuItem} onClick={() => openPatient(p.id, true)}>
                            Edit doctor’s order
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div style={manage.rightCol}>
        <section style={manage.orderCard}>
          <div style={manage.orderHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📄</span>
              <h2 style={manage.panelTitle}>Doctor’s Order</h2>
            </div>
            <button type="button" style={manage.calendarBtn} onClick={() => setShowCalendar(true)}>
              📅 Calendar
            </button>
          </div>

          <div style={manage.patientMeta}>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>Patient: {selected.name}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#334155', marginTop: 8 }}>Orders:</div>
          </div>

          <div style={manage.orderLines}>
            {orders.map((line, idx) =>
              editingOrders ? (
                <div key={`${selected.id}-${idx}`} style={manage.orderEditRow}>
                  <input
                    value={line}
                    onChange={(e) => updateOrder(idx, e.target.value)}
                    style={manage.orderEditInput}
                  />
                  <button type="button" style={manage.removeOrderBtn} onClick={() => removeOrder(idx)}>
                    ✕
                  </button>
                </div>
              ) : (
                <div key={`${selected.id}-${idx}`} style={manage.orderBullet}>
                  • {line}
                </div>
              )
            )}
            {!orders.length && (
              <div style={{ ...manage.orderLine, color: '#94a3b8' }}>No orders yet.</div>
            )}
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a new order"
            rows={2}
            style={manage.noteArea}
          />

          <div style={manage.orderActions}>
            <button type="button" style={manage.addBtn} onClick={addOrder}>
              Add
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {submitted && <span style={{ fontSize: 12, color: '#166534' }}>Orders saved</span>}
              <button
                type="button"
                style={manage.submitBtn}
                onClick={() => {
                  setSubmitted(true);
                  setEditingOrders(false);
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </section>

        <section style={manage.aiCard}>
          <div style={manage.aiHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✨</span>
              <h3 style={manage.aiTitle}>AI Summarized</h3>
            </div>
            <span style={manage.aiBadge}>AI Draft ready</span>
          </div>

          {editingSummary ? (
            <textarea
              value={summary}
              onChange={(e) =>
                setSummaryByPatient((prev) => ({ ...prev, [selected.id]: e.target.value }))
              }
              rows={6}
              style={manage.aiEditor}
            />
          ) : (
            <p style={manage.aiText}>{summary}</p>
          )}

          <div style={manage.aiActions}>
            <button
              type="button"
              style={manage.aiLink}
              onClick={() => setEditingSummary((v) => !v)}
            >
              {editingSummary ? 'Save Summary' : 'Edit Summary'}
            </button>
            <button
              type="button"
              style={manage.aiLink}
              onClick={() => {
                setSummaryByPatient((prev) => ({
                  ...prev,
                  [selected.id]:
                    DEFAULT_SUMMARY[selected.id] ??
                    `${selected.name} is under observation. Orders are being reviewed for today’s course in the ward.`,
                }));
                setEditingSummary(false);
              }}
            >
              ↻ Regenerate
            </button>
          </div>
        </section>
      </div>

      <CalendarModal
        open={showCalendar}
        onClose={() => setShowCalendar(false)}
        focusDate={admissionDate}
      />
    </div>
  );
}

const shell: Record<string, React.CSSProperties> = {
  appContainer: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    backgroundColor: '#f3f4f6',
  },
  sidebar: {
    width: 232,
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 0 16px',
  },
  sidebarLogoContainer: {
    padding: '16px 20px 24px',
  },
  sidebarLogo: {
    maxHeight: 44,
    maxWidth: 180,
    objectFit: 'contain',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '0 14px',
    flex: 1,
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: 8,
    color: '#64748b',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  navButtonActive: {
    backgroundColor: 'transparent',
    color: '#0f172a',
    fontWeight: 800,
  },
  navIcon: {
    display: 'flex',
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '0 14px',
    padding: '10px 12px',
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: '#cbd5e1',
    color: TEAL,
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileName: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0f172a',
  },
  profileEmail: {
    fontSize: 10,
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    flexShrink: 0,
    border: '1px solid #fecaca',
    backgroundColor: '#fff',
    color: '#ef4444',
    borderRadius: 8,
    padding: '6px 8px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '28px 32px 8px',
  },
  headerTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  headerSubtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#94a3b8',
  },
  content: {
    padding: '16px 32px 32px',
    flex: 1,
  },
  bellWrap: {
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    boxShadow: CARD_SHADOW,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2563eb',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
};

const overview: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 16,
  },
  statCard: {
    borderRadius: 22,
    padding: '20px 22px',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    minHeight: 96,
    border: 'none',
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  statIcon: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: 600,
    opacity: 0.92,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.15,
    marginTop: 2,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.75fr)',
    gap: 16,
    alignItems: 'start',
  },
  patientCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: '20px 22px 12px',
    boxShadow: CARD_SHADOW,
  },
  patientHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
  },
  pageChevron: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#64748b',
    fontSize: 18,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    padding: '10px 8px',
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '14px 8px',
    fontSize: 13,
    borderBottom: 'none',
    verticalAlign: 'middle',
  },
  checkbox: {
    width: 14,
    height: 14,
    accentColor: TEAL,
    cursor: 'pointer',
  },
  rowDots: {
    color: '#94a3b8',
    fontSize: 18,
    letterSpacing: 1,
    lineHeight: 1,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: '50%',
    display: 'inline-block',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  widget: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    boxShadow: CARD_SHADOW,
  },
  calNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calMonth: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
  },
  calGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
  },
  calDow: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 700,
    color: '#94a3b8',
    padding: '4px 0',
  },
  calDay: {
    border: 'none',
    background: 'transparent',
    height: 32,
    borderRadius: 16,
    fontSize: 12,
    color: '#334155',
    cursor: 'pointer',
    padding: 0,
  },
  calDayActive: {
    backgroundColor: TEAL,
    color: '#ffffff',
    fontWeight: 700,
  },
  todoHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addNotesBtn: {
    border: '1.5px solid #38bdf8',
    backgroundColor: '#ffffff',
    color: '#0ea5e9',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  addNoteInput: {
    flex: 1,
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    outline: 'none',
  },
  todoList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 280,
    overflowY: 'auto',
  },
  todoItem: {
    margin: 0,
  },
  todoLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#334155',
    cursor: 'pointer',
  },
  pendingChip: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
  },
};

const manage: Record<string, React.CSSProperties> = {
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
    gap: 20,
    alignItems: 'start',
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: '18px 20px 12px',
    boxShadow: CARD_SHADOW,
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  listTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: '#0f172a',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #e2e8f0',
    borderRadius: 20,
    padding: '6px 12px',
    backgroundColor: '#ffffff',
    minWidth: 160,
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: 13,
    width: 120,
    padding: 0,
    background: 'transparent',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    boxShadow: CARD_SHADOW,
  },
  orderHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
  },
  calendarBtn: {
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: TEAL,
    cursor: 'pointer',
  },
  patientMeta: {
    marginBottom: 12,
  },
  orderLines: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 12,
  },
  orderLine: {
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    color: '#334155',
    backgroundColor: '#ffffff',
  },
  noteArea: {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    resize: 'vertical',
    marginBottom: 12,
    boxSizing: 'border-box',
  },
  orderActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addBtn: {
    border: `1.5px solid ${TEAL}`,
    backgroundColor: '#ffffff',
    color: TEAL,
    borderRadius: 10,
    padding: '8px 18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  submitBtn: {
    border: 'none',
    backgroundColor: TEAL,
    color: '#ffffff',
    borderRadius: 10,
    padding: '8px 20px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  aiCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    boxShadow: CARD_SHADOW,
  },
  aiHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aiTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
  },
  aiBadge: {
    backgroundColor: '#e0f2fe',
    color: TEAL,
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 999,
  },
  aiText: {
    margin: '0 0 14px',
    fontSize: 13,
    lineHeight: 1.55,
    color: '#334155',
  },
  aiEditor: {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginBottom: 12,
    boxSizing: 'border-box',
    backgroundColor: '#f8fafc',
  },
  aiActions: {
    display: 'flex',
    gap: 16,
  },
  aiLink: {
    border: 'none',
    background: 'transparent',
    color: '#2563eb',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
  },
  dotsBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#64748b',
    fontSize: 18,
    padding: '4px 8px',
    lineHeight: 1,
  },
  rowMenu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    zIndex: 12,
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.1)',
    minWidth: 180,
    overflow: 'hidden',
  },
  rowMenuItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#334155',
    cursor: 'pointer',
  },
  orderBullet: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 1.5,
  },
  orderEditRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  orderEditInput: {
    flex: 1,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
  },
  removeOrderBtn: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#dc2626',
    borderRadius: 6,
    width: 28,
    height: 28,
    padding: 0,
    cursor: 'pointer',
  },
  calOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  calModal: {
    width: 340,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
  },
  calHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
  },
  calClose: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#94a3b8',
    fontSize: 16,
    padding: 4,
  },
  calNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    padding: 0,
  },
  calMonth: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
  },
  calGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
  },
  calDow: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 700,
    color: '#94a3b8',
    padding: '4px 0',
  },
  calDay: {
    border: 'none',
    background: 'transparent',
    height: 36,
    borderRadius: 6,
    fontSize: 12,
    color: '#334155',
    cursor: 'pointer',
    padding: 0,
  },
  calDaySelected: {
    backgroundColor: TEAL,
    color: '#ffffff',
    fontWeight: 700,
    borderRadius: 18,
  },
};

const requests: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: '24px 24px 16px',
    boxShadow: CARD_SHADOW,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#64748b',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #e2e8f0',
    borderRadius: 20,
    padding: '8px 14px',
    backgroundColor: '#ffffff',
    minWidth: 240,
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: 13,
    flex: 1,
    padding: 0,
    background: 'transparent',
  },
  searchIcon: {
    fontSize: 13,
    color: '#94a3b8',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 700,
    color: TEAL,
    padding: '12px 14px',
    backgroundColor: '#f1f5f9',
    borderBottom: '1px solid #e2e8f0',
  },
  td: {
    padding: '14px',
    fontSize: 13,
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle',
  },
  idLink: {
    border: 'none',
    background: 'transparent',
    color: TEAL,
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    fontSize: 13,
  },
  primary: {
    fontWeight: 700,
    color: '#0f172a',
  },
  secondary: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusPending: {
    display: 'inline-block',
    backgroundColor: '#fff4e5',
    color: '#b76e00',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  statusReviewed: {
    display: 'inline-block',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  reviewBtn: {
    border: `1px solid ${TEAL}`,
    backgroundColor: '#ffffff',
    color: TEAL,
    borderRadius: 8,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 4px 4px',
  },
  pageInfo: {
    fontSize: 12,
    color: '#64748b',
  },
  pageControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  pageBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
  pageActive: {
    backgroundColor: TEAL,
    color: '#ffffff',
    borderColor: TEAL,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: 560,
    maxWidth: '90%',
    padding: 24,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
  },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#94a3b8',
    fontSize: 16,
  },
  modalMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 13,
    lineHeight: 1.6,
    color: '#334155',
    margin: '0 0 20px',
  },
};

const review: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 24,
  },
  shell: {
    display: 'flex',
    alignItems: 'stretch',
    maxWidth: 1080,
    width: '100%',
    maxHeight: '90vh',
    position: 'relative',
  },
  ordersPanel: {
    width: 280,
    flexShrink: 0,
    backgroundColor: '#ffffff',
    borderRadius: '16px 0 0 16px',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e2e8f0',
    borderRight: 'none',
  },
  ordersTitle: {
    margin: '0 0 12px',
    fontSize: 15,
    fontWeight: 800,
    color: '#0f172a',
  },
  ordersScroll: {
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    paddingRight: 4,
  },
  orderCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    padding: 12,
  },
  orderWhen: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0f172a',
  },
  orderTime: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
  },
  orderDoctor: {
    fontSize: 13,
    fontWeight: 800,
    color: '#0f172a',
  },
  orderList: {
    margin: 0,
    paddingLeft: 16,
    fontSize: 12,
    color: '#334155',
    lineHeight: 1.45,
  },
  collapseBtn: {
    position: 'absolute',
    left: 268,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    zIndex: 2,
    padding: 0,
    fontSize: 14,
  },
  mainPanel: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
  },
  header: {
    backgroundColor: TEAL,
    color: '#ffffff',
    padding: '14px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
  },
  headerId: {
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
  headerClose: {
    border: 'none',
    background: 'transparent',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: 16,
    padding: 4,
  },
  body: {
    padding: 18,
    overflowY: 'auto',
    flex: 1,
  },
  infoBanner: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 12,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 8,
  },
  patientGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 10,
    marginBottom: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  fieldInput: {
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  submittedCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
  },
  aiHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hideOrdersBtn: {
    border: `1px solid ${TEAL}`,
    backgroundColor: '#ffffff',
    color: TEAL,
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  summaryBox: {
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.6,
    color: '#334155',
    marginBottom: 12,
  },
  summaryEditor: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #bbf7d0',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 12,
    backgroundColor: '#f0fdf4',
  },
  aiActions: {
    display: 'flex',
    gap: 10,
  },
  outlineBtn: {
    border: `1px solid ${TEAL}`,
    backgroundColor: '#ffffff',
    color: TEAL,
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '12px 18px 16px',
    borderTop: '1px solid #f1f5f9',
  },
  cancelBtn: {
    border: '1px solid #cbd5e1',
    backgroundColor: '#e2e8f0',
    color: '#334155',
    borderRadius: 8,
    padding: '8px 18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  approveBtn: {
    border: 'none',
    backgroundColor: TEAL,
    color: '#ffffff',
    borderRadius: 8,
    padding: '8px 20px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

