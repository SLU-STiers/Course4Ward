import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import logoImg from '../Img/Course4Ward-Logo.png';

type TabType = 'management' | 'patient';

const TEAL = '#104E65';

type NursePatient = {
  id: string;
  name: string;
  patientId: string;
  recordId: string;
  admissionDate: string;
  color: string;
  age: number;
  gender: string;
  initials: string;
};

type OrderSet = {
  dateLabel: string;
  time: string;
  doctor: string;
  orders: string[];
};

const MOCK_PATIENTS: NursePatient[] = [
  { id: '1', name: 'Sarah Brown', patientId: '1123', recordId: 'SH-2024-0123', admissionDate: '15/04/2026', color: '#ef4444', age: 28, gender: 'Female', initials: 'SB' },
  { id: '2', name: 'Michael Owen', patientId: '1122', recordId: 'SH-2024-0122', admissionDate: '15/04/2026', color: '#22c55e', age: 45, gender: 'Male', initials: 'MO' },
  { id: '3', name: 'Mary Jane', patientId: '1121', recordId: 'SH-2024-0121', admissionDate: '14/04/2026', color: '#84cc16', age: 32, gender: 'Female', initials: 'MJ' },
  { id: '4', name: 'Peter Doolie', patientId: '1120', recordId: 'SH-2024-0120', admissionDate: '14/04/2026', color: '#6366f1', age: 50, gender: 'Male', initials: 'PD' },
  { id: '5', name: 'Peter Doolie', patientId: '1119', recordId: 'SH-2024-0119', admissionDate: '14/04/2026', color: '#ef4444', age: 50, gender: 'Male', initials: 'PD' },
  { id: '6', name: 'Liam Park', patientId: '1117', recordId: 'SH-2024-0117', admissionDate: '15/04/2026', color: '#eab308', age: 41, gender: 'Male', initials: 'LP' },
  { id: '7', name: 'Nora Reyes', patientId: '1116', recordId: 'SH-2024-0116', admissionDate: '16/04/2026', color: '#d946ef', age: 36, gender: 'Female', initials: 'NR' },
  { id: '8', name: 'James Cruz', patientId: '1115', recordId: 'SH-2024-0115', admissionDate: '16/04/2026', color: '#06b6d4', age: 29, gender: 'Male', initials: 'JC' },
];

type AdmissionStatus = 'Admitted' | 'Discharged';

type AdmissionRecord = {
  id: string;
  name: string;
  admittedOn: string;
  dischargedOn: string | null;
  status: AdmissionStatus;
};

const INITIAL_ADMISSIONS: AdmissionRecord[] = [
  { id: 'ADM-0001', name: 'Sarah Brown', admittedOn: '15 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0002', name: 'Michael Owen', admittedOn: '15 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0003', name: 'Mary Jane', admittedOn: '14 Apr 2026', dischargedOn: '20 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0004', name: 'Peter Doolie', admittedOn: '14 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0005', name: 'Liam Park', admittedOn: '15 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0006', name: 'Nora Reyes', admittedOn: '16 Apr 2026', dischargedOn: '22 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0007', name: 'James Cruz', admittedOn: '16 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0008', name: 'Elena Santos', admittedOn: '17 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0009', name: 'Carlos Vega', admittedOn: '17 Apr 2026', dischargedOn: '25 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0010', name: 'Ava Lim', admittedOn: '18 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0011', name: 'Ben Torres', admittedOn: '10 Apr 2026', dischargedOn: '18 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0012', name: 'Mia Chen', admittedOn: '09 Apr 2026', dischargedOn: '16 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0013', name: 'Owen Blake', admittedOn: '08 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0014', name: 'Ruby Diaz', admittedOn: '07 Apr 2026', dischargedOn: '14 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0015', name: 'Noah Kim', admittedOn: '06 Apr 2026', dischargedOn: '12 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0016', name: 'Ivy Morales', admittedOn: '05 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0017', name: 'Leo Santos', admittedOn: '04 Apr 2026', dischargedOn: '11 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0018', name: 'Paula Reed', admittedOn: '03 Apr 2026', dischargedOn: '10 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0019', name: 'Grace Tan', admittedOn: '19 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0020', name: 'Hugo Ramos', admittedOn: '19 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0021', name: 'Iris Mendoza', admittedOn: '20 Apr 2026', dischargedOn: '28 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0022', name: 'Jules Navarro', admittedOn: '20 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0023', name: 'Kara Villanueva', admittedOn: '21 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0024', name: 'Marco Dela Cruz', admittedOn: '21 Apr 2026', dischargedOn: '29 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0025', name: 'Nina Flores', admittedOn: '22 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0026', name: 'Oscar Bautista', admittedOn: '22 Apr 2026', dischargedOn: '30 Apr 2026', status: 'Discharged' },
  { id: 'ADM-0027', name: 'Pia Gonzales', admittedOn: '23 Apr 2026', dischargedOn: null, status: 'Admitted' },
  { id: 'ADM-0028', name: 'Quinn Herrera', admittedOn: '23 Apr 2026', dischargedOn: '01 May 2026', status: 'Discharged' },
];

const DEFAULT_ORDER_SETS: Record<string, OrderSet[]> = {
  '1': [
    {
      dateLabel: 'April 15, 2026',
      time: 'Today, 8:00 AM',
      doctor: 'Dr. Mike Mentzer',
      orders: [
        'IV Ceftriaxone 1g q12h',
        'Paracetamol 500mg PRN for fever',
        'Monitor vital signs every 2 hours',
        'Chest X-ray',
      ],
    },
    {
      dateLabel: 'April 15, 2026',
      time: 'Today, 1:00 PM',
      doctor: 'Dr. Agcaoili Diddy',
      orders: ['Continue oxygen support at 2L/min', 'CBC repeat at 6 PM', 'Encourage oral fluids'],
    },
    {
      dateLabel: 'April 14, 2026',
      time: 'Yesterday, 4:30 PM',
      doctor: 'Dr. Jecy Guillian',
      orders: ['Continue antibiotics', 'Observe for respiratory distress'],
    },
  ],
  '2': [
    {
      dateLabel: 'April 15, 2026',
      time: 'Today, 7:50 AM',
      doctor: 'Dr. Mike Mentzer',
      orders: ['Amlodipine 5mg once daily', 'Monitor BP every 4 hours', 'Low-salt diet'],
    },
  ],
  '3': [
    {
      dateLabel: 'April 14, 2026',
      time: 'Yesterday, 4:30 PM',
      doctor: 'Dr. Jecy Guillian',
      orders: ['Continue oral antibiotics', 'Wound dressing daily', 'Ambulate as tolerated'],
    },
  ],
};

const DEFAULT_SUMMARIES: Record<string, string> = {
  '1':
    'Patient was maintained on IV Ceftriaxone every 12 hours, with Paracetamol given as needed for fever. Oxygen support was continued at 2L/min, and repeat laboratory tests were requested. Vital signs were monitored regularly, and the patient remained stable throughout the day.',
  '2': 'Patient presented with mild hypertension. Routine medications were administered and blood pressure remained stable.',
  '3': 'Patient recovering well post-operation. Current orders focus on antibiotics, wound care, and gradual ambulation.',
};

export function NurseDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('management');
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={shell.appContainer}>
      <aside style={shell.sidebar}>
        <div style={shell.sidebarLogoContainer}>
          <img src={logoImg} alt="Course Toward" style={shell.sidebarLogo} />
        </div>
        <nav style={shell.sidebarNav}>
          <NavItem
            label="Management"
            icon={<ManagementIcon />}
            active={activeTab === 'management'}
            onClick={() => setActiveTab('management')}
          />
          <NavItem
            label="Patient"
            icon={<PatientIcon />}
            active={activeTab === 'patient'}
            onClick={() => setActiveTab('patient')}
          />
        </nav>
        <div style={shell.sidebarProfile}>
          <div style={shell.profileAvatar}>AT</div>
          <div style={{ minWidth: 0 }}>
            <div style={shell.profileName}>Adrian Tabalvaro</div>
            <div style={shell.profileEmail}>ID 2246787</div>
          </div>
        </div>
      </aside>

      <div style={shell.mainWrapper}>
        <header style={shell.header}>
          <h1 style={shell.headerTitle}>{activeTab === 'management' ? 'Management' : 'Patient Management'}</h1>
          <div style={shell.headerRight}>
            <div style={shell.bellWrap}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>🔔</span>
              <span style={shell.bellBadge}>2</span>
            </div>
            <div ref={profileRef} style={shell.headerProfileWrap}>
              <button type="button" style={shell.headerProfileBtn} onClick={() => setShowProfile((v) => !v)}>
                <div style={shell.headerAvatar}>AT</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={shell.headerProfileName}>Adrian Tabalvaro</div>
                  <div style={shell.headerProfileId}>2246787</div>
                </div>
                <span style={{ fontSize: 10, color: '#64748b' }}>▼</span>
              </button>
              {showProfile && (
                <div style={shell.dropdownMenu}>
                  <button
                    type="button"
                    style={shell.dropdownItem}
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={shell.content}>
          {activeTab === 'management' && <ManagementPortalView />}
          {activeTab === 'patient' && <PatientView />}
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
      style={{ ...shell.navButton, ...(active ? shell.navButtonActive : {}) }}
    >
      <span style={shell.navIcon}>{icon}</span>
      {label}
    </button>
  );
}

function ManagementIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PatientIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 11.5V4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v4A1.5 1.5 0 0 1 11.5 10H6l-3 2.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PatientView() {
  const pageSize = 8;
  const [records, setRecords] = useState(INITIAL_ADMISSIONS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('01 Sep 2026');
  const [viewing, setViewing] = useState<AdmissionRecord | null>(null);

  const filtered = records.filter(
    (r) =>
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase())
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const visiblePages =
    pageCount <= 4 ? pages : [...pages.slice(0, 3), pageCount].filter((n, i, arr) => arr.indexOf(n) === i);

  const discharge = (id: string) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: 'Discharged', dischargedOn: '01 Sep 2026' } : r
      )
    );
  };

  const addPatient = () => {
    const name = newName.trim();
    if (!name) return;
    const nextNum = records.length + 1;
    const id = `ADM-${String(nextNum).padStart(4, '0')}`;
    setRecords((prev) => [
      { id, name, admittedOn: newDate, dischargedOn: null, status: 'Admitted' },
      ...prev,
    ]);
    setNewName('');
    setShowAdd(false);
    setPage(1);
  };

  return (
    <section style={ui.card}>
      <div style={ui.pmHeader}>
        <div>
          <h2 style={{ ...ui.sectionTitle, margin: 0 }}>Patient Management</h2>
          <p style={ui.muted}>Manage admissions and discharges.</p>
        </div>
      </div>

      <div style={ui.pmToolbar}>
        <div style={{ ...ui.searchWrap, flex: 1, marginBottom: 0 }}>
          <span style={{ color: '#94a3b8' }}>🔍</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search patient, admission ID..."
            style={ui.searchInput}
          />
        </div>
        <button type="button" style={ui.primaryBtn} onClick={() => setShowAdd(true)}>
          + Add Patient
        </button>
      </div>

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
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={ui.td}>
                  <button type="button" style={ui.idLink} onClick={() => setViewing(r)}>
                    {r.id}
                  </button>
                </td>
                <td style={{ ...ui.td, fontWeight: 600, color: '#0f172a' }}>{r.name}</td>
                <td style={{ ...ui.td, color: '#334155' }}>{r.admittedOn}</td>
                <td style={{ ...ui.td, color: '#64748b' }}>{r.dischargedOn ?? '—'}</td>
                <td style={ui.td}>
                  <span style={r.status === 'Admitted' ? ui.badgeAdmitted : ui.badgeDischarged}>
                    {r.status}
                  </span>
                </td>
                <td style={{ ...ui.td, textAlign: 'right' }}>
                  {r.status === 'Admitted' ? (
                    <button type="button" style={ui.primaryBtn} onClick={() => discharge(r.id)}>
                      Discharge Patient
                    </button>
                  ) : (
                    <button type="button" style={ui.outlineBtn} onClick={() => setViewing(r)}>
                      View Record
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={ui.pagination}>
        <span style={ui.pageInfo}>
          Showing {filtered.length ? start + 1 : 0} to {Math.min(start + pageSize, filtered.length)} of{' '}
          {filtered.length} patients
        </span>
        <div style={ui.pageControls}>
          <button
            type="button"
            style={ui.pageBtn}
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          {visiblePages.map((n, i) => (
            <React.Fragment key={n}>
              {i === visiblePages.length - 1 && n - visiblePages[i - 1] > 1 && (
                <span style={{ color: '#94a3b8', fontSize: 13 }}>...</span>
              )}
              <button
                type="button"
                style={{ ...ui.pageBtn, ...(n === safePage ? ui.pageActive : {}) }}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            </React.Fragment>
          ))}
          <button
            type="button"
            style={ui.pageBtn}
            disabled={safePage === pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            ›
          </button>
        </div>
      </div>

      {showAdd && (
        <div style={ui.overlay} onClick={() => setShowAdd(false)}>
          <div style={ui.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...ui.sectionTitle, marginTop: 0 }}>Add Patient</h3>
            <label style={ui.field}>
              <span style={ui.fieldLabel}>Full Name</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} style={ui.input} />
            </label>
            <label style={ui.field}>
              <span style={ui.fieldLabel}>Admission Date</span>
              <input value={newDate} onChange={(e) => setNewDate(e.target.value)} style={ui.input} />
            </label>
            <div style={ui.modalActions}>
              <button type="button" style={ui.outlineBtn} onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button type="button" style={ui.primaryBtn} onClick={addPatient} disabled={!newName.trim()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div style={ui.overlay} onClick={() => setViewing(null)}>
          <div style={ui.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...ui.sectionTitle, marginTop: 0 }}>{viewing.id}</h3>
            <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{viewing.name}</p>
            <p style={ui.muted}>Admitted: {viewing.admittedOn}</p>
            <p style={ui.muted}>Discharged: {viewing.dischargedOn ?? '—'}</p>
            <span style={viewing.status === 'Admitted' ? ui.badgeAdmitted : ui.badgeDischarged}>
              {viewing.status}
            </span>
            <div style={{ ...ui.modalActions, marginTop: 16 }}>
              <button type="button" style={ui.outlineBtn} onClick={() => setViewing(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ManagementPortalView() {
  const [patients] = useState(MOCK_PATIENTS);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_PATIENTS[0].id);
  const [viewedIds, setViewedIds] = useState<string[]>([MOCK_PATIENTS[0].id]);
  const [orderIndex, setOrderIndex] = useState(0);
  const [ordersByPatient, setOrdersByPatient] = useState<Record<string, OrderSet[]>>(DEFAULT_ORDER_SETS);
  const [physicianName, setPhysicianName] = useState('');
  const [newOrder, setNewOrder] = useState('');

  const selected = patients.find((p) => p.id === selectedId) ?? null;
  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.patientId.includes(search) ||
      p.recordId.toLowerCase().includes(search.toLowerCase())
  );

  const orderSets = selected ? ordersByPatient[selected.id] ?? [] : [];
  const currentSet = orderSets[orderIndex] ?? null;

  const openPatient = (id: string) => {
    setSelectedId(id);
    setOrderIndex(0);
    setPhysicianName('');
    setNewOrder('');
    setViewedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const addOrderNote = () => {
    if (!selected || !newOrder.trim()) return;
    const doctor = physicianName.trim() || currentSet?.doctor || 'Ordering physician';
    setOrdersByPatient((prev) => {
      const existing = prev[selected.id] ?? [];
      if (existing[orderIndex]) {
        const next = existing.map((set, i) =>
          i === orderIndex ? { ...set, orders: [...set.orders, newOrder.trim()] } : set
        );
        return { ...prev, [selected.id]: next };
      }
      return {
        ...prev,
        [selected.id]: [
          ...existing,
          {
            dateLabel: 'April 15, 2026',
            time: 'Today',
            doctor,
            orders: [newOrder.trim()],
          },
        ],
      };
    });
    setNewOrder('');
  };

  return (
    <div style={ui.layout}>
      <section style={ui.card}>
        <h2 style={ui.sectionTitle}>Patient Overview</h2>
        <div style={ui.searchWrap}>
          <span style={{ color: '#94a3b8' }}>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient"
            style={ui.searchInput}
          />
        </div>
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
            {filtered.map((p) => {
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
                      <span style={{ ...ui.dot, backgroundColor: p.color }} />
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
                  <span>📄</span>
                  <strong>Doctor’s Order</strong>
                </div>
                <div style={ui.dateNav}>
                  <button
                    type="button"
                    style={ui.navChevron}
                    disabled={orderIndex === 0}
                    onClick={() => setOrderIndex((i) => Math.max(0, i - 1))}
                  >
                    ‹
                  </button>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {currentSet?.dateLabel ?? 'No orders'}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      {orderSets.length ? `${orderIndex + 1} of ${orderSets.length}` : '0 of 0'}
                    </div>
                  </div>
                  <button
                    type="button"
                    style={ui.navChevron}
                    disabled={orderIndex >= orderSets.length - 1}
                    onClick={() => setOrderIndex((i) => Math.min(orderSets.length - 1, i + 1))}
                  >
                    ›
                  </button>
                </div>
              </div>

              {currentSet ? (
                <>
                  <div style={ui.orderMeta}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{currentSet.doctor}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{currentSet.time}</div>
                    </div>
                    {viewedIds.includes(selected.id) && (
                      <span style={ui.viewedBadge}>✓ Order Viewed</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Orders:</div>
                  <ul style={ui.orderList}>
                    {currentSet.orders.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p style={ui.muted}>No physician orders have been entered for this patient yet.</p>
              )}

              <div style={ui.addRow}>
                <input
                  placeholder="Ordering Physician"
                  value={physicianName}
                  onChange={(e) => setPhysicianName(e.target.value)}
                  style={ui.input}
                />
                <input
                  placeholder="Edit Physician Order"
                  value={newOrder}
                  onChange={(e) => setNewOrder(e.target.value)}
                  style={ui.input}
                  onKeyDown={(e) => e.key === 'Enter' && addOrderNote()}
                />
              </div>
              <button type="button" style={ui.addBtn} onClick={addOrderNote} disabled={!newOrder.trim()}>
                Add
              </button>
            </div>

            <div style={ui.aiCard}>
              <div style={ui.aiHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#3b0764' }}>
                  <span>✨</span> AI Summarized
                </div>
                <span style={ui.aiBadge}>AI Draft ready</span>
              </div>
              <p style={ui.aiText}>
                {DEFAULT_SUMMARIES[selected.id] ??
                  `No AI summary yet for ${selected.name}. Physician orders will appear here once summarized.`}
              </p>
            </div>
          </>
        ) : (
          <p style={ui.muted}>Select a patient to view physician orders.</p>
        )}
      </section>
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
  sidebarLogoContainer: { padding: '16px 20px 24px' },
  sidebarLogo: { maxHeight: 44, maxWidth: 180, objectFit: 'contain' },
  sidebarNav: { display: 'flex', flexDirection: 'column', gap: 4, padding: '0 14px', flex: 1 },
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
  navButtonActive: { backgroundColor: '#f1f5f9', color: '#0f172a' },
  navIcon: { display: 'flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  sidebarProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '0 14px',
    padding: '10px 8px',
    borderTop: '1px solid #f1f5f9',
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
  profileName: { fontSize: 12, fontWeight: 700, color: '#0f172a' },
  profileEmail: { fontSize: 10, color: '#94a3b8' },
  mainWrapper: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '28px 32px 8px',
  },
  headerTitle: { margin: 0, fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  bellWrap: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
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
  headerProfileWrap: { position: 'relative' },
  headerProfileBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: 4,
  },
  headerAvatar: {
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
  },
  headerProfileName: { fontSize: 13, fontWeight: 700, color: '#0f172a' },
  headerProfileId: { fontSize: 11, color: '#64748b' },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 8px)',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    minWidth: 140,
    overflow: 'hidden',
    zIndex: 20,
  },
  dropdownItem: {
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#ef4444',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
  },
  content: { padding: '16px 32px 32px', flex: 1 },
};

const ui: Record<string, React.CSSProperties> = {
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(340px, 0.9fr)',
    gap: 20,
    alignItems: 'start',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    border: '1px solid #e5e7eb',
  },
  sectionTitle: { margin: '0 0 12px', fontSize: 20, fontWeight: 800, color: '#0f172a' },
  muted: { color: '#64748b', fontSize: 13, marginTop: 0 },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #e2e8f0',
    borderRadius: 20,
    padding: '8px 14px',
    marginBottom: 12,
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    flex: 1,
    fontSize: 13,
    padding: 0,
    background: 'transparent',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    padding: '10px 8px',
    borderBottom: '1px solid #f1f5f9',
  },
  td: { padding: '12px 8px', fontSize: 13, borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  dot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  viewBtn: {
    border: 'none',
    backgroundColor: TEAL,
    color: '#ffffff',
    borderRadius: 8,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  detailCol: { display: 'flex', flexDirection: 'column', gap: 16 },
  patientHeader: { display: 'flex', gap: 14, alignItems: 'center' },
  patientAvatar: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    color: '#ffffff',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#64748b', marginTop: 6 },
  orderCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    padding: 16,
    border: '1px solid #bbf7d0',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateNav: { display: 'flex', alignItems: 'center', gap: 8 },
  navChevron: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#fff',
    cursor: 'pointer',
    padding: 0,
  },
  orderMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewedBadge: {
    backgroundColor: '#bbf7d0',
    color: '#166534',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  orderList: { margin: '0 0 14px', paddingLeft: 18, fontSize: 13, color: '#334155', lineHeight: 1.5 },
  addRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 },
  input: {
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    background: '#fff',
  },
  addBtn: {
    border: '1px solid #86efac',
    backgroundColor: '#dcfce7',
    color: '#166534',
    borderRadius: 8,
    padding: '8px 18px',
    fontWeight: 700,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  
  aiCard: {
    backgroundColor: '#f3e8ff',
    borderRadius: 16,
    padding: 16,
    border: '1px solid #e9d5ff',
  },
  aiHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  aiBadge: {
    backgroundColor: '#d8b4fe',
    color: '#6b21a8',
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 999,
  },
  aiText: { margin: 0, fontSize: 13, lineHeight: 1.55, color: '#4c1d95' },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 },
  statTile: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    border: '1px solid #e2e8f0',
  },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: 600 },
  statValue: { fontSize: 24, fontWeight: 800, color: TEAL, marginTop: 4 },
  pmHeader: { marginBottom: 16 },
  pmToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  primaryBtn: {
    border: 'none',
    backgroundColor: TEAL,
    color: '#ffffff',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  outlineBtn: {
    border: '1px solid #0284c7',
    backgroundColor: '#ffffff',
    color: '#0284c7',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  tableWrap: {
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  thBlue: {
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 700,
    color: '#0f172a',
    padding: '12px 14px',
    backgroundColor: '#e0f2fe',
    borderBottom: '1px solid #bae6fd',
  },
  idLink: {
    border: 'none',
    background: 'transparent',
    color: '#0284c7',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    fontSize: 13,
  },
  badgeAdmitted: {
    display: 'inline-block',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  badgeDischarged: {
    display: 'inline-block',
    backgroundColor: '#e2e8f0',
    color: '#1e3a5f',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
  },
  pageInfo: { fontSize: 12, color: '#64748b' },
  pageControls: { display: 'flex', alignItems: 'center', gap: 6 },
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
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: 420,
    maxWidth: '90%',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: '#64748b', fontWeight: 600 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
};
