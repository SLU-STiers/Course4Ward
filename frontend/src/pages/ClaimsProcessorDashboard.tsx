import React, { useState } from 'react';
import { Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoImg from '../Img/Course4Ward-Logo.png';
import overviewIcon from '../Img/overview.png';
import requestsIcon from '../Img/requests.png';
import exportIcon from '../Img/export.png';
import { useAuthStore } from '../store/authStore';

type TabType = 'overview' | 'requests' | 'export';
type ExportSubView = 'selection' | 'new-cf4' | 'existing-cf4';
type PatientSortField = 'name' | 'patientId' | 'admissionDate';
type SortDirection = 'ascending' | 'descending';
type RequestSortField = 'id' | 'date' | 'status';
type PatientStatus = 'all' | 'admitted' | 'discharged';

interface SummarizationRequest {
  id: string;
  doctor: string;
  date: string;
  time: string;
  status: 'Pending Review' | 'Approved' | 'Rejected';
  patient: {
    name: string;
    initials: string;
    patientId: string;
    age: number;
    gender: string;
    admissionDate: string;
  };
  summaryText: string;
}

interface CF4Patient {
  id: string;
  patientId: string;
  name: string;
  color: string;
  admissionDate: string;
  status: Exclude<PatientStatus, 'all'>;
  selected: boolean;
}

const MOCK_REQUESTS: SummarizationRequest[] = [
  {
    id: 'SUM-0001',
    doctor: 'Dr. Mike Mentzer',
    date: '15 Apr 2026',
    time: '08:00 AM',
    status: 'Pending Review',
    patient: {
      name: 'Sarah Brown',
      initials: 'SB',
      patientId: 'SH-2024-0123',
      age: 29,
      gender: 'Female',
      admissionDate: '15 Apr 2026',
    },
    summaryText:
      'Patient was maintained on IV Ceftriaxone every 12 hours, with Paracetamol given as needed for fever. Oxygen support was continued at 2L/min, and repeat laboratory tests were requested. Vital signs were monitored regularly, and the patient remained stable throughout the day.',
  },
  {
    id: 'SUM-0002',
    doctor: 'Dr. Agcaoili Diddy',
    date: '15 Apr 2026',
    time: '07:50 AM',
    status: 'Pending Review',
    patient: {
      name: 'Micheal Owen',
      initials: 'MO',
      patientId: 'SH-2024-0122',
      age: 45,
      gender: 'Male',
      admissionDate: '15 Apr 2026',
    },
    summaryText: 'Patient presented with mild hypertension. Administered routine meds.',
  },
  {
    id: 'SUM-0003',
    doctor: 'Dr. Jecy Guillian',
    date: '14 Apr 2026',
    time: '04:30 PM',
    status: 'Approved',
    patient: {
      name: 'Mary Jane',
      initials: 'MJ',
      patientId: 'SH-2024-0121',
      age: 32,
      gender: 'Female',
      admissionDate: '14 Apr 2026',
    },
    summaryText: 'Patient recovering well post-operation. Discharged with oral meds.',
  },
  {
    id: 'SUM-0004',
    doctor: 'Dr. Mike Mentzer',
    date: '14 Apr 2026',
    time: '02:15 PM',
    status: 'Pending Review',
    patient: {
      name: 'Peter Dodle',
      initials: 'PD',
      patientId: 'SH-2024-0120',
      age: 50,
      gender: 'Male',
      admissionDate: '14 Apr 2026',
    },
    summaryText: 'Observation for respiratory symptoms. Oxygen saturation steady.',
  },
  {
    id: 'SUM-0005',
    doctor: 'Dr. Agcaoili Diddy',
    date: '14 Apr 2026',
    time: '11:45 AM',
    status: 'Approved',
    patient: {
      name: 'Anna Kendrick',
      initials: 'AK',
      patientId: 'SH-2024-0119',
      age: 28,
      gender: 'Female',
      admissionDate: '14 Apr 2026',
    },
    summaryText: 'Routine checkup completed without complications.',
  },
];

const INITIAL_CF4_PATIENTS: CF4Patient[] = [
  { id: '1', name: 'Sarah brown', patientId: '1123', admissionDate: '15/04/2026', color: '#ef4444', status: 'admitted', selected: false },
  { id: '2', name: 'Micheal Owen', patientId: '1122', admissionDate: '15/04/2026', color: '#22c55e', status: 'admitted', selected: false },
  { id: '3', name: 'Mary Jane', patientId: '1121', admissionDate: '14/04/2026', color: '#84cc16', status: 'admitted', selected: false },
  { id: '4', name: 'Peter dodle', patientId: '1120', admissionDate: '14/04/2026', color: '#6366f1', status: 'admitted', selected: false },
  { id: '5', name: 'Peter dodle', patientId: '1119', admissionDate: '14/04/2026', color: '#f43f5e', status: 'discharged', selected: false },
  { id: '6', name: 'Peter dodle', patientId: '1119', admissionDate: '14/04/2026', color: '#eab308', status: 'discharged', selected: false },
  

];

function HoverMenu({
  label,
  icon,
  open,
  setOpen,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  children: React.ReactNode;
}) {
  return (
    <div
      style={overviewStyles.filterMenuWrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button type="button" style={overviewStyles.filterButton} aria-expanded={open}>
        {icon}
        {label}
      </button>
      {open && <div style={overviewStyles.filterDropdown}>{children}</div>}
    </div>
  );
}

export function ClaimsProcessorDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [exportSubView, setExportSubView] = useState<ExportSubView>('selection');

  // Request State
  const [searchQuery, setSearchQuery] = useState('');
  const [, setSelectedRequest] = useState<SummarizationRequest | null>(null);
  const [requestPage, setRequestPage] = useState(1);
  const [requestSortField, setRequestSortField] = useState<RequestSortField>('date');
  const [requestSortDirection, setRequestSortDirection] = useState<SortDirection>('descending');
  const [showRequestFilter, setShowRequestFilter] = useState(false);
  const [showRequestSort, setShowRequestSort] = useState(false);
  const [requestDateFrom, setRequestDateFrom] = useState('');
  const [requestDateTo, setRequestDateTo] = useState('');
  const [requestStatus, setRequestStatus] = useState<'all' | SummarizationRequest['status']>('all');

  // CF4 Export State
  const [cf4Patients, setCf4Patients] = useState<CF4Patient[]>(INITIAL_CF4_PATIENTS);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientPage, setPatientPage] = useState(1);
  const [patientSortField, setPatientSortField] = useState<PatientSortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');
  const [showPatientFilter, setShowPatientFilter] = useState(false);
  const [showPatientSort, setShowPatientSort] = useState(false);
  const [admissionFrom, setAdmissionFrom] = useState('');
  const [admissionTo, setAdmissionTo] = useState('');
  const [patientStatus, setPatientStatus] = useState<PatientStatus>('all');
  const [, setPreviewPatient] = useState<CF4Patient | null>(null);
  const [selectedOrderDate, setSelectedOrderDate] = useState('2026-04-15');
  const [evaluator, setEvaluator] = useState('Dr. Mike Mentzer');

  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  // Upload File State
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: string;
    progress: string;
    isUploading: boolean;
  } | null>({
    name: 'SteveJoabs_PhilHealth.pdf',
    size: '60 KB of 120 KB',
    progress: 'Uploading...',
    isUploading: true,
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredRequests = MOCK_REQUESTS.filter((req) => {
    const [day, month, year] = req.date.split(' ');
    const requestDate = `${year}-${{ Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }[month] ?? '01'}-${day.padStart(2, '0')}`;
    return (
      req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.patient.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) &&
      (requestStatus === 'all' || req.status === requestStatus) &&
      (!requestDateFrom || requestDate >= requestDateFrom) &&
      (!requestDateTo || requestDate <= requestDateTo);
  });
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const valueA = requestSortField === 'id' ? a.id : requestSortField === 'date' ? `${a.date} ${a.time}` : a.status;
    const valueB = requestSortField === 'id' ? b.id : requestSortField === 'date' ? `${b.date} ${b.time}` : b.status;
    const comparison = valueA.localeCompare(valueB, undefined, { numeric: true });
    return requestSortDirection === 'ascending' ? comparison : -comparison;
  });
  const requestPageSize = 8;
  const requestPageCount = Math.max(1, Math.ceil(sortedRequests.length / requestPageSize));
  const safeRequestPage = Math.min(requestPage, requestPageCount);
  const requestStart = (safeRequestPage - 1) * requestPageSize;
  const visibleRequests = sortedRequests.slice(requestStart, requestStart + requestPageSize);
  const requestPages = Array.from({ length: requestPageCount }, (_, index) => index + 1);

  const filteredCf4Patients = cf4Patients.filter(
    (p) =>
      (p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.patientId.includes(patientSearch)) &&
      (patientStatus === 'all' || p.status === patientStatus) &&
      (!admissionFrom || p.admissionDate.split('/').reverse().join('-') >= admissionFrom) &&
      (!admissionTo || p.admissionDate.split('/').reverse().join('-') <= admissionTo)
  );
  const sortedCf4Patients = [...filteredCf4Patients].sort((a, b) => {
    const valueA = patientSortField === 'admissionDate' ? a.admissionDate.split('/').reverse().join('') : a[patientSortField].toLowerCase();
    const valueB = patientSortField === 'admissionDate' ? b.admissionDate.split('/').reverse().join('') : b[patientSortField].toLowerCase();
    const comparison = valueA.localeCompare(valueB, undefined, { numeric: true });
    return sortDirection === 'ascending' ? comparison : -comparison;
  });
  const patientPageSize = 8;
  const patientPageCount = Math.max(1, Math.ceil(sortedCf4Patients.length / patientPageSize));
  const safePatientPage = Math.min(patientPage, patientPageCount);
  const patientStart = (safePatientPage - 1) * patientPageSize;
  const visibleCf4Patients = sortedCf4Patients.slice(patientStart, patientStart + patientPageSize);
  const patientPages = Array.from({ length: patientPageCount }, (_, index) => index + 1);
  const orderDates = [...new Set(MOCK_REQUESTS.map((request) => {
    const [day, month, year] = request.date.split(' ');
    return `${year}-${{ Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }[month] ?? '01'}-${day.padStart(2, '0')}`;
  }))].sort().reverse();

  const setPatientSearchAndResetPage = (value: string) => {
    setPatientSearch(value);
    setPatientPage(1);
  };

  const setPatientSort = (field: PatientSortField, direction: SortDirection) => {
    setPatientSortField(field);
    setSortDirection(direction);
    setPatientPage(1);
  };

  const setRequestSearchAndResetPage = (value: string) => {
    setSearchQuery(value);
    setRequestPage(1);
  };

  const setRequestSort = (field: RequestSortField, direction: SortDirection) => {
    setRequestSortField(field);
    setRequestSortDirection(direction);
    setRequestPage(1);
  };

  const shiftOrderDate = (direction: -1 | 1) => {
    const currentIndex = Math.max(0, orderDates.indexOf(selectedOrderDate));
    const nextDate = orderDates[currentIndex + direction];
    if (nextDate) setSelectedOrderDate(nextDate);
  };

  const toggleSelectPatient = (id: string) => {
    setCf4Patients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleSelectOrView = (patient: CF4Patient) => {
    if (!patient.selected) {
      toggleSelectPatient(patient.id);
    }
    setPreviewPatient(patient);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile({
        name: file.name,
        size: `${(file.size / 1024).toFixed(0)} KB`,
        progress: 'Uploading...',
        isUploading: true,
      });
    }
  };

  return (
    <div style={styles.appContainer}>
      {/* SIDEBAR */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarLogoContainer}>
          <img src={logoImg} alt="Course4Ward Logo" style={styles.sidebarLogo} />
        </div>

        <nav style={styles.sidebarNav}>
          <button
            style={{
              ...styles.navButton,
              ...(activeTab === 'overview' ? styles.navButtonActive : {}),
            }}
            onClick={() => setActiveTab('overview')}
          >
            <img src={overviewIcon} alt="Overview" style={styles.navIconImage} />
            Overview
          </button>

          <button
            style={{
              ...styles.navButton,
              ...(activeTab === 'requests' ? styles.navButtonActive : {}),
            }}
            onClick={() => setActiveTab('requests')}
          >
            <img src={requestsIcon} alt="Requests" style={styles.navIconImage} />
            Requests
          </button>

          <button
            style={{
              ...styles.navButton,
              ...(activeTab === 'export' ? styles.navButtonActive : {}),
            }}
            onClick={() => {
              setActiveTab('export');
              setExportSubView('selection');
            }}
          >
            <img src={exportIcon} alt="Export" style={styles.navIconImage} />
            Export
          </button>
        </nav>

        <div style={styles.sidebarProfile}>
          <div style={styles.profileAvatar}>SJ</div>
          <div style={styles.profileDetails}>
            <div style={styles.profileName}>Steve Joabs</div>
            <div style={styles.profileEmail}>Claims Processor</div>
          </div>
          <button type="button" style={styles.logoutBtn} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div style={styles.mainWrapper}>
        {/* TOP HEADER */}
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>Claims Processor</h1>
          <div style={styles.headerRight}>
            <div style={styles.notificationBadge}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              <span style={styles.badgeDot} />
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main style={styles.content}>
          {/* REQUESTS TAB */}
          {activeTab === 'requests' && (
            <div>
              <div style={styles.requestToolbar}>
                <div style={styles.searchWrapper}>
                  <span style={styles.searchIcon}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChange={(e) => setRequestSearchAndResetPage(e.target.value)}
                    style={styles.searchInput}
                  />
                </div>
                <HoverMenu
                  label="Filter"
                  icon={<Filter size={15} aria-hidden="true" />}
                  open={showRequestFilter}
                  setOpen={setShowRequestFilter}
                >
                  <div style={overviewStyles.filterLabel}>Filter requests</div>
                  <span style={overviewStyles.filterOptionLabel}>Submitted on</span>
                  <input type="date" value={requestDateFrom} onChange={(e) => { setRequestDateFrom(e.target.value); setRequestPage(1); }} style={overviewStyles.dateFilterInput} aria-label="Requests from date" />
                  <input type="date" value={requestDateTo} onChange={(e) => { setRequestDateTo(e.target.value); setRequestPage(1); }} style={overviewStyles.dateFilterInput} aria-label="Requests to date" />
                  <span style={{ ...overviewStyles.filterOptionLabel, marginTop: '8px' }}>Status</span>
                  {(['all', 'Pending Review', 'Approved', 'Rejected'] as const).map((status) => (
                    <button type="button" key={status} style={overviewStyles.menuChoiceButton} onClick={() => { setRequestStatus(status === 'all' ? 'all' : status); setRequestPage(1); }}>
                      {status === 'all' ? 'All' : status}
                    </button>
                  ))}
                </HoverMenu>
                <HoverMenu
                  label="Sort by"
                  open={showRequestSort}
                  setOpen={setShowRequestSort}
                >
                  <div style={overviewStyles.filterLabel}>Sort requests by</div>
                  {([
                    ['id', 'Request ID'],
                    ['date', 'Submitted on'],
                    ['status', 'Status'],
                  ] as [RequestSortField, string][]).map(([field, label]) => (
                    <div key={field} style={overviewStyles.filterOptionGroup}>
                      <span style={overviewStyles.filterOptionLabel}>{label}</span>
                      <div style={overviewStyles.filterDirectionRow}>
                        <button type="button" style={overviewStyles.filterDirectionButton} onClick={() => setRequestSort(field, 'ascending')}>Ascending</button>
                        <button type="button" style={overviewStyles.filterDirectionButton} onClick={() => setRequestSort(field, 'descending')}>Descending</button>
                      </div>
                    </div>
                  ))}
                </HoverMenu>
              </div>

              <div style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={{ ...styles.th, width: '30%' }}>Request ID</th>
                      <th style={{ ...styles.th, width: '28%' }}>Submitted On</th>
                      <th style={{ ...styles.th, width: '22%' }}>Status</th>
                      <th style={{ ...styles.th, width: '20%', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRequests.map((req) => (
                      <tr key={req.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={styles.reqId}>{req.id}</div>
                          <div style={styles.docName}>{req.doctor}</div>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.dateText}>{req.date}</div>
                          <div style={styles.timeText}>{req.time}</div>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={
                              req.status === 'Pending Review'
                                ? styles.statusPending
                                : styles.statusApproved
                            }
                          >
                            {req.status}
                          </span>
                        </td>
                        <td style={{ ...styles.td, ...styles.requestActionCell }}>
                          <button
                            style={styles.reviewBtn}
                            onClick={() => setSelectedRequest(req)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={styles.paginationRow}>
                  <span style={styles.paginationText}>
                    Showing {sortedRequests.length ? requestStart + 1 : 0} to {Math.min(requestStart + requestPageSize, sortedRequests.length)} of {sortedRequests.length} requests
                  </span>
                  <div style={styles.paginationControls}>
                    <button type="button" style={styles.pageArrowBtn} disabled={safeRequestPage === 1} onClick={() => setRequestPage((page) => Math.max(1, page - 1))}>‹</button>
                    {requestPages.map((page) => (
                      <button type="button" key={page} style={{ ...styles.pageNumberBtn, ...(page === safeRequestPage ? styles.pageActive : {}) }} onClick={() => setRequestPage(page)}>{page}</button>
                    ))}
                    <button type="button" style={styles.pageArrowBtn} disabled={safeRequestPage === requestPageCount} onClick={() => setRequestPage((page) => Math.min(requestPageCount, page + 1))}>›</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EXPORT TAB */}
          {activeTab === 'export' && (
            <div>
              {/* SUBVIEW 1: SELECTION */}
              {exportSubView === 'selection' && (
                <div style={styles.exportContainerCard}>
                  <p style={styles.exportInstruction}>
                    Select a workflow option to begin generating or editing CF4 PDF documents.
                  </p>
                  <div style={styles.exportOptionsGrid}>
                    {/* NEW CF4 CARD */}
                    <div
                      style={styles.exportOptionCard}
                      onClick={() => setExportSubView('new-cf4')}
                    >
                      <div style={styles.exportCardHeader}>New CF4 PDF</div>
                      <div style={styles.exportCardIconArea}>
                        <div style={styles.docIconBox}>
                          <span style={{ fontSize: '32px' }}>📄</span>
                          <span style={styles.plusIconBadge}>+</span>
                        </div>
                      </div>
                      <div style={styles.exportCardFooter}>
                        Generate a fresh form from active ward data.
                      </div>
                    </div>

                    {/* EXISTING CF4 CARD */}
                    <div
                      style={styles.exportOptionCard}
                      onClick={() => setExportSubView('existing-cf4')}
                    >
                      <div style={styles.exportCardHeader}>Existing CF4 PDF</div>
                      <div style={styles.exportCardIconArea}>
                        <span style={{ fontSize: '48px', color: '#475569' }}>📁</span>
                      </div>
                      <div style={styles.exportCardFooter}>
                        Upload and populate an existing local PDF.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBVIEW 2: NEW CF4 */}
              {exportSubView === 'new-cf4' && (
                <div style={styles.exportContainerCard}>
                  <div style={styles.newCf4HeaderRow}>
                    <button
                      style={styles.backButton}
                      onClick={() => setExportSubView('selection')}
                    >
                      &lt; Back to Selection
                    </button>
                    <h3 style={styles.newCf4Title}>New CF4 Generation</h3>
                    <div style={{ width: '120px' }} />
                  </div>

                  <div style={styles.exportToolbar}>
                    <div style={styles.searchWrapper}>
                      <span style={styles.searchIcon}>🔍</span>
                      <input
                        type="text"
                        placeholder="Search patient"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        style={styles.searchInput}
                      />
                    </div>
                    <HoverMenu label="Filter" icon={<Filter size={15} aria-hidden="true" />} open={showPatientFilter} setOpen={setShowPatientFilter}>
                      <div style={overviewStyles.filterLabel}>Filter patients</div>
                      <span style={overviewStyles.filterOptionLabel}>Admission date</span>
                      <input type="date" value={admissionFrom} onChange={(e) => { setAdmissionFrom(e.target.value); setPatientPage(1); }} style={overviewStyles.dateFilterInput} aria-label="Admission date from" />
                      <input type="date" value={admissionTo} onChange={(e) => { setAdmissionTo(e.target.value); setPatientPage(1); }} style={overviewStyles.dateFilterInput} aria-label="Admission date to" />
                      <span style={{ ...overviewStyles.filterOptionLabel, marginTop: '8px' }}>Patient status</span>
                      {(['all', 'admitted', 'discharged'] as PatientStatus[]).map((status) => (
                        <button type="button" key={status} style={overviewStyles.menuChoiceButton} onClick={() => { setPatientStatus(status); setPatientPage(1); }}>
                          {status[0].toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </HoverMenu>
                    <HoverMenu label="Sort by" open={showPatientSort} setOpen={setShowPatientSort}>
                      <div style={overviewStyles.filterLabel}>Sort patients by</div>
                      {([
                        ['name', 'Patient name'],
                        ['patientId', 'Patient ID'],
                        ['admissionDate', 'Admission date'],
                      ] as [PatientSortField, string][]).map(([field, label]) => (
                        <div key={field} style={overviewStyles.filterOptionGroup}>
                          <span style={overviewStyles.filterOptionLabel}>{label}</span>
                          <div style={overviewStyles.filterDirectionRow}>
                            <button type="button" style={overviewStyles.filterDirectionButton} onClick={() => setPatientSort(field, 'ascending')}>Ascending</button>
                            <button type="button" style={overviewStyles.filterDirectionButton} onClick={() => setPatientSort(field, 'descending')}>Descending</button>
                          </div>
                        </div>
                      ))}
                    </HoverMenu>
                  </div>

                  <div style={styles.patientTableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.thRow}>
                          <th style={{ ...styles.th, width: '37%' }}>Patient</th>
                          <th style={{ ...styles.th, width: '20%' }}>Patient ID</th>
                          <th style={{ ...styles.th, width: '20%' }}>Admission Date</th>
                          <th style={{ ...styles.th, width: '15%', textAlign: 'right' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCf4Patients.map((p) => (
                          <tr key={p.id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    backgroundColor: p.status === 'discharged' ? '#ef4444' : '#22c55e',
                                    display: 'inline-block',
                                  }}
                                />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                                  {p.name}
                                </span>
                              </div>
                            </td>
                            <td style={{ ...styles.td, fontSize: '12px', color: '#64748b' }}>
                              {p.patientId}
                            </td>
                            <td style={{ ...styles.td, fontSize: '12px', color: '#64748b' }}>
                              {p.admissionDate}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <button
                                style={styles.reviewBtn}
                                onClick={() => handleSelectOrView(p)}
                              >
                                {p.selected ? 'View' : 'Select'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={styles.newCf4FooterRow}>
                    <button
                      style={styles.cancelBtn}
                      onClick={() => setExportSubView('selection')}
                    >
                      Cancel
                    </button>
                    <button
                      style={styles.proceedBtn}
                      onClick={() => alert('Proceeding to Summary...')}
                    >
                      Proceed to Summary
                    </button>
                  </div>
                </div>
              )}

              {/* SUBVIEW 3: EXISTING CF4 (UPLOAD FILE) */}
              {exportSubView === 'existing-cf4' && (
                <div style={styles.exportContainerCard}>
                  <div style={styles.newCf4HeaderRow}>
                    <button
                      style={styles.backButton}
                      onClick={() => setExportSubView('selection')}
                    >
                      &lt; Back to Selection
                    </button>
                    <h3 style={styles.newCf4Title}>Modify Existing CF4</h3>
                    <div style={{ width: '120px' }} />
                  </div>

                  <div style={styles.uploadHeaderArea}>
                    <div style={styles.uploadCloudCircle}>
                      <span style={{ fontSize: '24px' }}>☁️</span>
                    </div>
                    <div>
                      <h4 style={styles.uploadTitle}>Upload files</h4>
                      <p style={styles.uploadSubtitle}>
                        Select and upload the files of your choice
                      </p>
                    </div>
                  </div>

                  <hr style={styles.uploadDivider} />

                  <div style={styles.dragDropZone}>
                    <p style={styles.dragDropTitle}>Choose a file or drag & drop it here</p>
                    <p style={styles.dragDropSubtitle}>PDF or XML, up to 50MB</p>
                    <label style={styles.browseFileBtn}>
                      Browse File
                      <input
                        type="file"
                        accept=".pdf,.xml"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>

                  {uploadedFile && (
                    <div style={styles.uploadedFileCard}>
                      <div style={styles.pdfBadgeIcon}>PDF</div>
                      <div style={{ flex: 1 }}>
                        <div style={styles.uploadedFileName}>{uploadedFile.name}</div>
                        <div style={styles.uploadedFileMeta}>
                          {uploadedFile.size} •{' '}
                          <span style={{ color: '#0284c7' }}>⚙️ {uploadedFile.progress}</span>
                        </div>
                      </div>
                      <button
                        style={styles.removeFileBtn}
                        onClick={() => setUploadedFile(null)}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div style={{ ...styles.newCf4FooterRow, marginTop: 'auto' }}>
                    <button
                      style={styles.cancelBtn}
                      onClick={() => setExportSubView('selection')}
                    >
                      Cancel
                    </button>
                    <button
                      style={styles.proceedBtn}
                      onClick={() => alert('Proceeding to Summary...')}
                    >
                      Proceed to Summary
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div style={overviewStyles.overviewLayout}>
              <div style={overviewStyles.leftCard}>
                <h2 style={overviewStyles.cardTitle}>Patient Overview</h2>

                <div style={overviewStyles.patientToolbar}>
                  <div style={styles.searchWrapper}>
                    <span style={styles.searchIcon}>🔍</span>
                    <input
                      type="text"
                      placeholder="Search patient"
                      value={patientSearch}
                      onChange={(e) => setPatientSearchAndResetPage(e.target.value)}
                      style={styles.searchInput}
                    />
                  </div>
                  <HoverMenu label="Filter" icon={<Filter size={15} aria-hidden="true" />} open={showPatientFilter} setOpen={setShowPatientFilter}>
                    <div style={overviewStyles.filterLabel}>Filter patients</div>
                    <span style={overviewStyles.filterOptionLabel}>Admission date</span>
                    <input type="date" value={admissionFrom} onChange={(e) => { setAdmissionFrom(e.target.value); setPatientPage(1); }} style={overviewStyles.dateFilterInput} aria-label="Admission date from" />
                    <input type="date" value={admissionTo} onChange={(e) => { setAdmissionTo(e.target.value); setPatientPage(1); }} style={overviewStyles.dateFilterInput} aria-label="Admission date to" />
                    <span style={{ ...overviewStyles.filterOptionLabel, marginTop: '8px' }}>Patient status</span>
                    {(['all', 'admitted', 'discharged'] as PatientStatus[]).map((status) => (
                      <button type="button" key={status} style={overviewStyles.menuChoiceButton} onClick={() => { setPatientStatus(status); setPatientPage(1); }}>
                        {status[0].toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </HoverMenu>
                  <HoverMenu label="Sort by" open={showPatientSort} setOpen={setShowPatientSort}>
                    <div style={overviewStyles.filterLabel}>Sort patients by</div>
                    {([
                      ['name', 'Patient name'],
                      ['patientId', 'Patient ID'],
                      ['admissionDate', 'Admission date'],
                    ] as [PatientSortField, string][]).map(([field, label]) => (
                      <div key={field} style={overviewStyles.filterOptionGroup}>
                        <span style={overviewStyles.filterOptionLabel}>{label}</span>
                        <div style={overviewStyles.filterDirectionRow}>
                          <button type="button" style={overviewStyles.filterDirectionButton} onClick={() => setPatientSort(field, 'ascending')}>Ascending</button>
                          <button type="button" style={overviewStyles.filterDirectionButton} onClick={() => setPatientSort(field, 'descending')}>Descending</button>
                        </div>
                      </div>
                    ))}
                  </HoverMenu>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.thRow}>
                        <th style={{ ...styles.th, width: '37%' }}>Patient</th>
                        <th style={{ ...styles.th, width: '20%' }}>Patient ID</th>
                        <th style={{ ...styles.th, width: '20%' }}>Admission Date</th>
                        <th style={{ ...styles.th, width: '15%', textAlign: 'right' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCf4Patients.map((p) => (
                        <tr key={p.id} style={styles.tr}>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span
                                style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                    backgroundColor: p.status === 'discharged' ? '#ef4444' : '#22c55e',
                                  display: 'inline-block',
                                }}
                              />
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                                {p.name}
                              </span>
                            </div>
                          </td>
                          <td style={{ ...styles.td, fontSize: '12px', color: '#64748b' }}>
                            {p.patientId}
                          </td>
                          <td style={{ ...styles.td, fontSize: '12px', color: '#64748b' }}>
                            {p.admissionDate}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>
                            <button
                              style={{
                                backgroundColor: '#004358',
                                color: '#ffffff',
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                              onClick={() => handleSelectOrView(p)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={overviewStyles.pagination}>
                  <span style={overviewStyles.paginationText}>
                    Showing {sortedCf4Patients.length ? patientStart + 1 : 0} to{' '}
                    {Math.min(patientStart + patientPageSize, sortedCf4Patients.length)} of{' '}
                    {sortedCf4Patients.length} patients
                  </span>
                  <div style={overviewStyles.paginationControls}>
                    <button
                      type="button"
                      style={overviewStyles.pageButton}
                      disabled={safePatientPage === 1}
                      onClick={() => setPatientPage((page) => Math.max(1, page - 1))}
                    >
                      ‹
                    </button>
                    {patientPages.map((page) => (
                      <button
                        type="button"
                        key={page}
                        style={{
                          ...overviewStyles.pageButton,
                          ...(page === safePatientPage ? overviewStyles.pageActive : {}),
                        }}
                        onClick={() => setPatientPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      style={overviewStyles.pageButton}
                      disabled={safePatientPage === patientPageCount}
                      onClick={() => setPatientPage((page) => Math.min(patientPageCount, page + 1))}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>

              <div style={overviewStyles.rightColumn}>
                <div style={overviewStyles.ordersCard}>
                  <div style={overviewStyles.ordersHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>📝</span>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                        Submitted Physician Orders
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        style={overviewStyles.arrowNavBtn}
                        disabled={!orderDates.length || orderDates.indexOf(selectedOrderDate) >= orderDates.length - 1}
                        onClick={() => shiftOrderDate(1)}
                        title="Older date"
                      >
                        ‹
                      </button>
                      <input
                        type="date"
                        value={selectedOrderDate}
                        onChange={(e) => setSelectedOrderDate(e.target.value)}
                        style={overviewStyles.dateInput}
                        aria-label="Order date"
                      />
                      <button
                        type="button"
                        style={overviewStyles.arrowNavBtn}
                        disabled={!orderDates.length || orderDates.indexOf(selectedOrderDate) <= 0}
                        onClick={() => shiftOrderDate(-1)}
                        title="Newer date"
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  <div style={overviewStyles.timelineContainer}>
                    <div style={overviewStyles.timelineLine} />

                    <div style={overviewStyles.timelineItem}>
                      <div style={overviewStyles.timelineMeta}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>April 15,2026</div>
                        <div style={{ color: '#64748b' }}>Today, 8:00 AM</div>
                      </div>
                      <div style={overviewStyles.timelineDot} />
                      <div style={overviewStyles.orderBox}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '6px' }}>
                          Dr. Mike Mentzer
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '11px', color: '#334155', marginBottom: '2px' }}>
                          Orders:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '12px', fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                          <li>• IV Ceftriaxone 1g q12h</li>
                          <li>• Paracetamol 500mg PRN for fever</li>
                          <li>• Monitor vital signs every 2 hours</li>
                          <li>• Chest X-ray</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={overviewStyles.aiCard}>
                  <div style={overviewStyles.aiHeader}>
                    <span style={overviewStyles.aiTitle}>AI Summarized</span>
                    <span style={overviewStyles.aiStatus}>Pending</span>
                  </div>
                  <p style={overviewStyles.aiSummary}>
                    Patient was maintained on IV Ceftriaxone every 12 hours, with Paracetamol given as needed for fever. Oxygen support was continued at 2L/min, and repeat laboratory tests were requested. Vital signs were monitored regularly, and the patient remained stable throughout the day.
                  </p>
                  <div style={overviewStyles.aiActions}>
                    <select value={evaluator} onChange={(e) => setEvaluator(e.target.value)} style={overviewStyles.evaluatorSelect} aria-label="Evaluator">
                      <option>Dr. Mike Mentzer</option>
                      <option>Dr. Agcaoili Diddy</option>
                      <option>Dr. Jecy Guillian</option>
                    </select>
                    <button type="button" style={overviewStyles.submitButton} onClick={() => alert(`Submitted to ${evaluator}`)}>Submit</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  sidebar: {
    width: '232px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarLogoContainer: {
    padding: '16px 20px 24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarLogo: {
    width: '180px',
    height: '44px',
    objectFit: 'contain',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '0 14px',
    flex: 1,
  },
  sidebarProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '0 14px',
    padding: '10px 8px',
    borderTop: '1px solid #f1f5f9',
  },
  profileAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#cbd5e1',
    color: '#0a5c83',
    fontSize: '11px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileDetails: {
    minWidth: 0,
    flex: 1,
  },
  profileName: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#0f172a',
  },
  profileEmail: {
    fontSize: '10px',
    color: '#94a3b8',
  },
  logoutBtn: {
    flexShrink: 0,
    border: '1px solid #fecaca',
    backgroundColor: '#ffffff',
    color: '#ef4444',
    borderRadius: '8px',
    padding: '6px 8px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  navButtonActive: {
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
  },
  navIconImage: {
  width: '20px',
  height: '20px',
  marginRight: '8px',
  objectFit: 'contain',
  },
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '28px 32px 8px',
  },
  headerTitle: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  notificationBadge: {
    position: 'relative',
    cursor: 'pointer',
  },
  badgeDot: {
    position: 'absolute',
    top: '0px',
    right: '0px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#0284c7',
  },
  profileButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '8px',
  },
  avatarCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
  },
  userRole: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: '48px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    width: '140px',
    zIndex: 100,
    overflow: 'hidden',
  },
  dropdownItem: {
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#ef4444',
    fontSize: '13px',
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  content: {
    padding: '32px',
    flex: 1,
  },
  titleSearchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  requestToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '24px',
  },
  exportToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: '13px',
    color: '#64748b',
    margin: '4px 0 0 0',
  },
  searchWrapper: {
    position: 'relative',
    width: '280px',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '14px',
    color: '#94a3b8',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px 8px 36px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  thRow: {
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  th: {
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    textAlign: 'left',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '14px 16px',
  },
  requestActionCell: {
    width: '20%',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  reqId: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0f172a',
  },
  docName: {
    fontSize: '12px',
    color: '#64748b',
  },
  dateText: {
    fontSize: '13px',
    color: '#334155',
  },
  timeText: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  statusApproved: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  reviewBtn: {
    backgroundColor: '#0a5c83',
    color: '#ffffff',
    border: 'none',
    padding: '6px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  paginationRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderTop: '1px solid #e2e8f0',
  },
  paginationText: {
    fontSize: '12px',
    color: '#64748b',
  },
  paginationControls: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  pageArrowBtn: {
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
  },
  pageNumberBtn: {
    minWidth: '32px',
    height: '32px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'transparent',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '12px',
    color: '#64748b',
    cursor: 'pointer',
  },
  pageActive: {
    backgroundColor: '#0a5c83',
    borderColor: '#0a5c83',
    color: '#ffffff',
    fontWeight: 700,
  },
  exportContainerCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
  },
  exportInstruction: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '24px',
  },
  exportOptionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '24px',
  },
  exportOptionCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '20px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  exportCardHeader: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '16px',
  },
  exportCardIconArea: {
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconBox: {
    position: 'relative',
  },
  plusIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0a5c83',
    color: '#fff',
    borderRadius: '50%',
    width: '16px',
    height: '16px',
    fontSize: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportCardFooter: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '16px',
  },
  newCf4HeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  backButton: {
    border: 'none',
    backgroundColor: 'transparent',
    color: '#0a5c83',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  newCf4Title: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  patientTableWrapper: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  cf4SelectBtn: {
    border: '1px solid #0a5c83',
    backgroundColor: 'transparent',
    color: '#0a5c83',
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  newCf4FooterRow: {
    display: 'flex',
    justifyContent
    : 'flex-end',
    gap: '12px',
    marginTop: '20px',
  },
  cancelBtn: {
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#475569',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  proceedBtn: {
    backgroundColor: '#0a5c83',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  uploadHeaderArea: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '16px',
  },
  uploadCloudCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
  },
  uploadSubtitle: {
    margin: 0,
    fontSize: '12px',
    color: '#64748b',
  },
  uploadDivider: {
    border: 'none',
    borderTop: '1px solid #e2e8f0',
    margin: '0 0 16px 0',
  },
  dragDropZone: {
    border: '2px dashed #cbd5e1',
    borderRadius: '8px',
    padding: '32px',
    textAlign: 'center',
    marginBottom: '20px',
  },
  dragDropTitle: {
    margin: '0 0 4px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#334155',
  },
  dragDropSubtitle: {
    margin: '0 0 16px 0',
    fontSize: '12px',
    color: '#94a3b8',
  },
  browseFileBtn: {
    backgroundColor: '#f1f5f9',
    color: '#334155',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-block',
  },
  uploadedFileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
  },
  pdfBadgeIcon: {
    backgroundColor: '#ef4444',
    color: '#fff',
    fontWeight: 700,
    fontSize: '10px',
    padding: '4px 6px',
    borderRadius: '4px',
  },
  uploadedFileName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#0f172a',
  },
  uploadedFileMeta: {
    fontSize: '11px',
    color: '#64748b',
  },
  removeFileBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
  },
};

const overviewStyles: Record<string, React.CSSProperties> = {
  overviewLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  leftCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 16px 0',
  },
  patientToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  filterButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    color: '#004358',
    borderColor: '#b8cbd2',
    fontWeight: 600,
  },
  filterMenuWrap: {
    position: 'relative',
  },
  filterDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    width: '220px',
    padding: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.12)',
    zIndex: 10,
  },
  filterLabel: {
    padding: '2px 4px 8px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  filterOptionGroup: {
    padding: '8px 4px',
    borderTop: '1px solid #f1f5f9',
  },
  filterOptionLabel: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#334155',
  },
  filterDirectionRow: {
    display: 'flex',
    gap: '4px',
  },
  filterDirectionButton: {
    flex: 1,
    padding: '5px 4px',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    color: '#0a5c83',
    fontSize: '10px',
    cursor: 'pointer',
  },
  dateFilterInput: {
    display: 'block',
    width: '100%',
    marginBottom: '6px',
    padding: '6px 8px',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    fontSize: '11px',
  },
  menuChoiceButton: {
    display: 'block',
    width: '100%',
    padding: '6px 4px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    color: '#334155',
    textAlign: 'left',
    fontSize: '11px',
    cursor: 'pointer',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '16px',
  },
  paginationText: {
    fontSize: '12px',
    color: '#64748b',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  pageButton: {
    minWidth: '32px',
    height: '32px',
    padding: '4px 8px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontSize: '12px',
    cursor: 'pointer',
  },
  pageActive: {
    backgroundColor: '#0a5c83',
    borderColor: '#0a5c83',
    color: '#ffffff',
    fontWeight: 700,
  },
  dateInput: {
    width: '112px',
    padding: '5px 6px',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    color: '#0f172a',
    fontSize: '10px',
  },
  aiCard: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  aiHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    backgroundColor: '#f1eaff',
  },
  aiTitle: {
    color: '#7c00b8',
    fontSize: '11px',
    fontWeight: 600,
  },
  aiStatus: {
    padding: '4px 18px',
    borderRadius: '6px',
    backgroundColor: '#d3a0f5',
    color: '#7c00b8',
    fontSize: '11px',
    fontWeight: 600,
  },
  aiSummary: {
    margin: 0,
    padding: '8px 14px',
    color: '#0f172a',
    fontSize: '11px',
    lineHeight: 1.35,
  },
  aiActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 14px 9px',
  },
  evaluatorSelect: {
    width: '118px',
    padding: '5px 8px',
    border: '1px solid #9cc8ff',
    borderRadius: '6px',
    color: '#0066cc',
    backgroundColor: '#ffffff',
    fontSize: '11px',
  },
  submitButton: {
    padding: '5px 16px',
    border: '1px solid #9cc8ff',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#0066cc',
    fontSize: '11px',
    cursor: 'pointer',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  ordersCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
  },
  ordersHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  arrowNavBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#64748b',
  },
  timelineContainer: {
    position: 'relative',
    paddingLeft: '120px',
  },
  timelineLine: {
    position: 'absolute',
    left: '110px',
    top: 0,
    bottom: 0,
    width: '2px',
    backgroundColor: '#e2e8f0',
  },
  timelineItem: {
    position: 'relative',
    marginBottom: '20px',
  },
  timelineMeta: {
    position: 'absolute',
    left: '-120px',
    width: '100px',
    textAlign: 'right',
    fontSize: '11px',
  },
  timelineDot: {
    position: 'absolute',
    left: '-14px',
    top: '4px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#0a5c83',
  },
  orderBox: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #e2e8f0',
  },
};