import React, { useState } from 'react';
import logoImg from '../Img/Course4Ward-Logo.png';

type TabType = 'overview' | 'requests' | 'export';
type ExportSubView = 'selection' | 'new-cf4' | 'existing-cf4';

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
  { id: '1', name: 'Sarah brown', patientId: '1123', admissionDate: '15/04/2026', color: '#ef4444', selected: false },
  { id: '2', name: 'Micheal Owen', patientId: '1122', admissionDate: '15/04/2026', color: '#22c55e', selected: false },
  { id: '3', name: 'Mary Jane', patientId: '1121', admissionDate: '14/04/2026', color: '#84cc16', selected: false },
  { id: '4', name: 'Peter dodle', patientId: '1120', admissionDate: '14/04/2026', color: '#6366f1', selected: false },
  { id: '5', name: 'Peter dodle', patientId: '1119', admissionDate: '14/04/2026', color: '#f43f5e', selected: false },
  { id: '6', name: 'Peter dodle', patientId: '1119', admissionDate: '14/04/2026', color: '#eab308', selected: false },
  { id: '7', name: 'Peter dodle', patientId: '1119', admissionDate: '14/04/2026', color: '#d946ef', selected: false },
  { id: '8', name: 'Peter dodle', patientId: '1119', admissionDate: '14/04/2026', color: '#f87171', selected: false },
];

export function ClaimsProcessorDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [exportSubView, setExportSubView] = useState<ExportSubView>('selection');

  // Request State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<SummarizationRequest | null>(null);
  const [doctorNote, setDoctorNote] = useState('');

  // CF4 Export State
  const [cf4Patients, setCf4Patients] = useState<CF4Patient[]>(INITIAL_CF4_PATIENTS);
  const [patientSearch, setPatientSearch] = useState('');
  const [previewPatient, setPreviewPatient] = useState<CF4Patient | null>(null);

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

  const filteredRequests = MOCK_REQUESTS.filter(
    (req) =>
      req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.patient.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCf4Patients = cf4Patients.filter(
    (p) =>
      p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.patientId.includes(patientSearch)
  );

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
            <span style={styles.navIcon}>🔲</span> Overview
          </button>
          <button
            style={{
              ...styles.navButton,
              ...(activeTab === 'requests' ? styles.navButtonActive : {}),
            }}
            onClick={() => setActiveTab('requests')}
          >
            <span style={styles.navIcon}>💬</span> Requests
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
            <span style={styles.navIcon}>📄</span> Export
          </button>
        </nav>
      </aside>

      {/* MAIN CONTAINER */}
      <div style={styles.mainWrapper}>
        {/* TOP HEADER */}
        <header style={styles.header}>
          <h2 style={styles.headerTitle}>Good Day! Steve Joabs</h2>
          <div style={styles.headerRight}>
            <div style={styles.notificationBadge}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              <span style={styles.badgeDot} />
            </div>
            <div style={styles.profileContainer}>
              <div style={styles.avatarCircle}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>SJ</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={styles.userName}>Steve Joabs</span>
                <span style={styles.userRole}>Claims Processor</span>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main style={styles.content}>
          {/* REQUESTS TAB */}
          {activeTab === 'requests' && (
            <div>
              <div style={styles.titleSearchRow}>
                <div>
                  <h1 style={styles.pageTitle}>AI Summarization Requests</h1>
                  <p style={styles.pageSubtitle}>
                    Review and approve AI summaries submitted by physicians.
                  </p>
                </div>
                <div style={styles.searchWrapper}>
                  <span style={styles.searchIcon}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={styles.searchInput}
                  />
                </div>
              </div>

              <div style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={{ ...styles.th, width: '25%' }}>Request ID</th>
                      <th style={{ ...styles.th, width: '25%' }}>Submitted On</th>
                      <th style={{ ...styles.th, width: '25%' }}>Status</th>
                      <th style={{ ...styles.th, width: '25%', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((req) => (
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
                        <td style={{ ...styles.td, textAlign: 'right' }}>
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
                    Showing 1 to {filteredRequests.length} of 12 requests
                  </span>
                  <div style={styles.paginationControls}>
                    <button style={styles.pageArrowBtn}>&lt;</button>
                    <button style={{ ...styles.pageNumberBtn, ...styles.pageActive }}>1</button>
                    <button style={styles.pageNumberBtn}>2</button>
                    <button style={styles.pageNumberBtn}>3</button>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>...</span>
                    <button style={styles.pageNumberBtn}>5</button>
                    <button style={styles.pageArrowBtn}>&gt;</button>
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
                  {/* TOP HEADER ROW WITH BACK BUTTON */}
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

                  {/* SEARCH PATIENT */}
                  <div style={{ marginBottom: '20px', width: '280px' }}>
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
                  </div>

                  {/* PATIENT SELECTION TABLE */}
                  <div style={styles.patientTableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.thRow}>
                          <th style={{ ...styles.th, width: '8%', textAlign: 'center' }}>
                            <input type="checkbox" />
                          </th>
                          <th style={{ ...styles.th, width: '37%' }}>Patient</th>
                          <th style={{ ...styles.th, width: '20%' }}>Patient ID</th>
                          <th style={{ ...styles.th, width: '20%' }}>Admission Date</th>
                          <th style={{ ...styles.th, width: '15%', textAlign: 'right' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCf4Patients.map((p) => (
                          <tr key={p.id} style={styles.tr}>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={p.selected}
                                onChange={() => toggleSelectPatient(p.id)}
                              />
                            </td>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    backgroundColor: p.color,
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
                                style={styles.cf4SelectBtn}
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

                  {/* BOTTOM ACTIONS */}
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
                  {/* HEADER */}
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

                  {/* UPLOAD SECTION TITLE */}
                  <div style={styles.uploadHeaderArea}>
                    <div style={styles.uploadCloudCircle}>
                      <span style={{ fontSize: '24px' }}>☁️</span>
                    </div>
                    <div>
                      <h4 style={styles.uploadTitle}>Upload files</h4>
                      <p style={styles.uploadSubtitle}>
                        Select and upload the files oof your choice
                      </p>
                    </div>
                  </div>

                  <hr style={styles.uploadDivider} />

                  {/* DRAG & DROP DASHED AREA */}
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

                  {/* UPLOADED FILE PROGRESS CARD */}
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

                  {/* FOOTER ACTIONS */}
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
              {/* LEFT SIDE: PATIENT OVERVIEW */}
              <div style={overviewStyles.leftCard}>
                <h2 style={overviewStyles.cardTitle}>Patient Overview</h2>
                
                {/* SEARCH PATIENT */}
                <div style={{ marginBottom: '16px' }}>
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
                </div>

                {/* PATIENT TABLE */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.thRow}>
                        <th style={{ ...styles.th, width: '8%', textAlign: 'center' }}>
                          <input type="checkbox" />
                        </th>
                        <th style={{ ...styles.th, width: '37%' }}>Patient</th>
                        <th style={{ ...styles.th, width: '20%' }}>Patient ID</th>
                        <th style={{ ...styles.th, width: '20%' }}>Admission Date</th>
                        <th style={{ ...styles.th, width: '15%', textAlign: 'right' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCf4Patients.map((p) => (
                        <tr key={p.id} style={styles.tr}>
                          <td style={{ ...styles.td, textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={p.selected}
                              onChange={() => toggleSelectPatient(p.id)}
                            />
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span
                                style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  backgroundColor: p.color,
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
              </div>

              {/* RIGHT SIDE: PHYSICIAN ORDERS & AI SUMMARIZED */}
              <div style={overviewStyles.rightColumn}>
                {/* SUBMITTED PHYSICIAN ORDERS CARD */}
                <div style={overviewStyles.ordersCard}>
                  <div style={overviewStyles.ordersHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>📝</span>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                        Submitted Physician Orders
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button style={overviewStyles.arrowNavBtn}>&lt;</button>
                      <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#0f172a' }}>April 15,2026</div>
                        <div style={{ fontSize: '9px', color: '#64748b' }}>1 of 5</div>
                      </div>
                      <button style={overviewStyles.arrowNavBtn}>&gt;</button>
                    </div>
                  </div>

                  {/* TIMELINE SECTION */}
                  <div style={overviewStyles.timelineContainer}>
                    <div style={overviewStyles.timelineLine} />

                    {/* ITEM 1 */}
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

                    {/* ITEM 2 */}
                    <div style={overviewStyles.timelineItem}>
                      <div style={overviewStyles.timelineMeta}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>April 15,2026</div>
                        <div style={{ color: '#64748b' }}>Today, 8:00 AM</div>
                      </div>
                      <div style={overviewStyles.timelineDot} />
                      <div style={overviewStyles.orderBox}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '6px' }}>
                          Dr. Agcaoili Diddy
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '11px', color: '#334155', marginBottom: '2px' }}>
                          Orders:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '12px', fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                          <li>• Continue oxygen support at 2L/min</li>
                          <li>• CBC repeat at 6 PM</li>
                          <li>• Encourage oral fluids</li>
                        </ul>
                      </div>
                    </div>

                    {/* ITEM 3 */}
                    <div style={overviewStyles.timelineItem}>
                      <div style={overviewStyles.timelineMeta}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>April 15,2026</div>
                        <div style={{ color: '#64748b' }}>Today, 8:00 AM</div>
                      </div>
                      <div style={overviewStyles.timelineDot} />
                      <div style={overviewStyles.orderBox}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '6px' }}>
                          Dr. Jecy Guillian
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '11px', color: '#334155', marginBottom: '2px' }}>
                          Orders:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '12px', fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                          <li>• Continue antibiotics</li>
                          <li>• Observe for respiratory distress</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI SUMMARIZED CARD */}
                <div style={overviewStyles.aiCard}>
                  <div style={overviewStyles.aiCardHeader}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b21a8' }}>
                      AI Summarized
                    </span>
                    <span style={overviewStyles.pendingBadge}>
                      Pending
                    </span>
                  </div>

                  <p style={{ fontSize: '11px', color: '#334155', lineHeight: '1.4', margin: '0 0 12px 0' }}>
                    Patient was maintained on IV Ceftriaxone every 12 hours, with Paracetamol given as needed for fever. Oxygen support was continued at 2L/min, and repeat laboratory tests were requested. Vital signs were monitored regularly, and the patient remained stable.
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={overviewStyles.evaluatorDropdown}>
                      <span>Evaluator</span>
                      <span style={{ fontSize: '10px' }}>▼</span>
                    </div>

                    <button style={overviewStyles.submitBtn}>
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
         REVIEW REQUEST MODAL
         ========================================================================= */}
      {selectedRequest && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={styles.statusPending}>{selectedRequest.status}</span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Request ID:{' '}
                  <strong style={{ color: '#0284c7' }}>{selectedRequest.id}</strong>
                </span>
              </div>
              <button style={styles.closeModalBtn} onClick={() => setSelectedRequest(null)}>
                ✕
              </button>
            </div>

            <div style={styles.modalTitleRow}>
              <div>
                <h2 style={styles.modalTitle}>Review AI Summarization</h2>
                <p style={styles.modalSubtitle}>
                  Evaluate the physician-reviewed summary and decide if it meets PhilHealth standards.
                </p>
              </div>
              <div style={styles.physicianBadge}>
                <span style={{ fontSize: '12px' }}>✓ Physician Reviewed</span>
                <span style={{ fontSize: '11px', color: '#475569' }}>
                  {selectedRequest.doctor}
                </span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>
                  {selectedRequest.date}, {selectedRequest.time}
                </span>
              </div>
            </div>

            <div style={styles.patientCard}>
              <div style={styles.patientAvatar}>{selectedRequest.patient.initials}</div>
              <div style={styles.patientMetaGrid}>
                <div>
                  <div style={styles.patientName}>{selectedRequest.patient.name}</div>
                  <div style={styles.patientSub}>
                    Patient ID: {selectedRequest.patient.patientId}
                  </div>
                </div>
                <div>
                  <span style={styles.metaLabel}>Age: </span>
                  <span style={styles.metaValue}>{selectedRequest.patient.age}</span>
                  <br />
                  <span style={styles.metaLabel}>Gender: </span>
                  <span style={styles.metaValue}>{selectedRequest.patient.gender}</span>
                </div>
                <div>
                  <span style={styles.metaLabel}>Admission Date:</span>
                  <div style={styles.metaValue}>{selectedRequest.patient.admissionDate}</div>
                </div>
              </div>
            </div>

            <div style={styles.aiContentBox}>
              <div style={styles.aiHeaderRow}>
                <span style={styles.aiLabel}>✨ AI Summarized Content</span>
                <span style={styles.aiGenTime}>
                  Generated: {selectedRequest.date}, {selectedRequest.time}
                </span>
              </div>
              <p style={styles.aiParagraph}>{selectedRequest.summaryText}</p>

              <div style={styles.checklistCard}>
                <div style={styles.checklistTitle}>
                  <span>ℹ️</span> Review Checklist
                </div>
                <ul style={styles.checklistUl}>
                  <li>Verify that medications, dosages, and frequencies are accurate</li>
                  <li>Ensure vital signs and patient condition are properly summarized</li>
                  <li>Check if the summary aligns with PhilHealth documentation standards</li>
                  <li>Confirm completeness and clarity of the Course in the Ward entry</li>
                </ul>
              </div>
            </div>

            <div style={styles.notifyBox}>
              <div style={styles.notifyTitle}>
                <span>✉️</span> Notify Physician to Review Again
              </div>
              <p style={styles.notifySubtitle}>
                Send a message to the physician if you need clarifications or want them to revise the summary.
              </p>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: '6px',
                }}
              >
                Add a message (Optional)
              </div>
              <div style={styles.notifyInputWrapper}>
                <textarea
                  style={styles.notifyTextarea}
                  placeholder="Add a message for the physician..."
                  value={doctorNote}
                  onChange={(e) => setDoctorNote(e.target.value)}
                />
                <button style={styles.sendNotifyBtn}>✈️ Send Notification</button>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                style={styles.requestRevisionsBtn}
                onClick={() => setSelectedRequest(null)}
              >
                Request Revisions
              </button>
              <button
                style={styles.approveSummaryBtn}
                onClick={() => {
                  alert('Summary Approved!');
                  setSelectedRequest(null);
                }}
              >
                ✓ Approve Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         CF4 FORM PREVIEW POPUP
         ========================================================================= */}
      {previewPatient && (
        <div style={styles.modalOverlay}>
          <div style={styles.cf4ModalCard}>
            <button style={styles.cf4CloseBtn} onClick={() => setPreviewPatient(null)}>
              ✕
            </button>

            <div style={styles.cf4PaperContainer}>
              <div style={styles.cf4SectionHeader}>
                <strong>IV. COURSE IN THE WARD</strong> (Attach photocopy of laboratory/imaging results){' '}
                <span style={{ fontSize: '10px' }}>☐ Check box if there is/are additional sheet(s).</span>
              </div>
              <table style={styles.cf4GridTable}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ ...styles.cf4Th, width: '20%' }}>Date</th>
                    <th style={{ ...styles.cf4Th, width: '80%' }}>DOCTOR'S ORDER/ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.cf4Td}>June 18, 2026</td>
                    <td style={styles.cf4Td}>
                      Admit to Medicine Ward, obtain vital signs every 4 hours. Keep NPO (nothing by mouth for the next 4 hours).
                    </td>
                  </tr>
                  <tr>
                    <td style={styles.cf4Td}>June 18, 2026</td>
                    <td style={styles.cf4Td}>
                      IV Fluids: Start PLR (Plastic Lactated Ringer's) 1L at 30 drops per minute (or 125 mL/hour) to correct volume depletion.
                    </td>
                  </tr>
                  <tr>
                    <td style={styles.cf4Td}>June 18, 2026</td>
                    <td style={styles.cf4Td}>
                      May go home once stable. Discontinue current IV fluids. Medications to take at home: Oral Rehydration Salts (ORS) 1.
                    </td>
                  </tr>
                  {[...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td style={{ ...styles.cf4Td, height: '20px' }}></td>
                      <td style={styles.cf4Td}></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={styles.cf4SubHeader}>
                SURGICAL PROCEDURE/RVS CODE (Attach photocopy of OR technique):
              </div>

              <div style={styles.cf4SectionHeader}>
                <strong>V. DRUGS/MEDICINES</strong>{' '}
                <span style={{ fontSize: '10px' }}>☐ Check box if there is/are additional sheet(s).</span>
              </div>
              <table style={styles.cf4GridTable}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={styles.cf4Th}>Generic Name</th>
                    <th style={styles.cf4Th}>Quantity/Dosage/Route/Frequency</th>
                    <th style={styles.cf4Th}>Total Cost</th>
                    <th style={styles.cf4Th}>Generic Name (cont)</th>
                    <th style={styles.cf4Th}>Quantity/Dosage/Route/Frequency (cont)</th>
                    <th style={styles.cf4Th}>Total Cost (cont)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(4)].map((_, i) => (
                    <tr key={i}>
                      <td style={{ ...styles.cf4Td, height: '18px' }}></td>
                      <td style={styles.cf4Td}></td>
                      <td style={styles.cf4Td}></td>
                      <td style={styles.cf4Td}></td>
                      <td style={styles.cf4Td}></td>
                      <td style={styles.cf4Td}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline styles for the Overview Dashboard layout
const overviewStyles: Record<string, React.CSSProperties> = {
  overviewLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    alignItems: 'start',
  },
  leftCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  cardTitle: {
    margin: '0 0 16px 0',
    fontSize: '20px',
    fontWeight: 700,
    color: '#334155',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  ordersCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  ordersHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e6f4ea',
    padding: '8px 12px',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  arrowNavBtn: {
    backgroundColor: '#c2e7ff',
    border: 'none',
    borderRadius: '4px',
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
    color: '#0f172a',
  },
  timelineContainer: {
    position: 'relative',
    paddingLeft: '100px',
    maxHeight: '380px',
    overflowY: 'auto',
  },
  timelineLine: {
    position: 'absolute',
    left: '120px',
    top: '10px',
    bottom: '10px',
    width: '2px',
    backgroundColor: '#cbd5e1',
  },
  timelineItem: {
    position: 'relative',
    marginBottom: '16px',
  },
  timelineMeta: {
    position: 'absolute',
    left: '-100px',
    top: '0',
    width: '85px',
    fontSize: '10px',
    textAlign: 'right',
  },
  timelineDot: {
    position: 'absolute',
    left: '16px',
    top: '4px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#cbd5e1',
    border: '2px solid #ffffff',
  },
  orderBox: {
    marginLeft: '36px',
    backgroundColor: '#ecfdf5',
    borderRadius: '8px',
    padding: '12px',
  },
  aiCard: {
    backgroundColor: '#f3e8ff',
    borderRadius: '12px',
    padding: '14px',
    border: '1px solid #e9d5ff',
  },
  aiCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  pendingBadge: {
    backgroundColor: '#d8b4fe',
    color: '#581c87',
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '12px',
  },
  evaluatorDropdown: {
    backgroundColor: '#ffffff',
    border: '1px solid #38bdf8',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    color: '#0284c7',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    cursor: 'pointer',
  },
  submitBtn: {
    backgroundColor: '#ffffff',
    border: '1px solid #38bdf8',
    color: '#0284c7',
    borderRadius: '6px',
    padding: '4px 16px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

// Existing styles kept intact
const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    backgroundColor: '#f8fafc',
  },
  sidebar: {
    width: '240px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarLogoContainer: {
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
  },
  sidebarLogo: {
    maxHeight: '40px',
    objectFit: 'contain',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '0 12px',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: '8px',
    color: '#64748b',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  navButtonActive: {
    backgroundColor: '#e0f2fe',
    color: '#0284c7',
  },
  navIcon: {
    fontSize: '16px',
  },
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: '64px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
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
    top: 0,
    right: 0,
    width: '8px',
    height: '8px',
    backgroundColor: '#ef4444',
    borderRadius: '50%',
  },
  profileContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatarCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#334155',
  },
  userName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#0f172a',
  },
  userRole: {
    fontSize: '11px',
    color: '#64748b',
  },
  content: {
    padding: '24px',
    flex: 1,
  },
  titleSearchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
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
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '6px 12px',
    gap: '8px',
  },
  searchIcon: {
    fontSize: '14px',
    color: '#94a3b8',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    width: '180px',
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
  },
  thRow: {
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  th: {
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#475569',
    textAlign: 'left',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    verticalAlign: 'middle',
  },
  reqId: {
    fontWeight: 600,
    color: '#0f172a',
  },
  docName: {
    fontSize: '12px',
    color: '#64748b',
  },
  dateText: {
    color: '#0f172a',
  },
  timeText: {
    fontSize: '12px',
    color: '#64748b',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
  },
  statusApproved: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
  },
  reviewBtn: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  paginationRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderTop: '1px solid #e2e8f0',
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
  pageArrowBtn: {
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  pageNumberBtn: {
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  pageActive: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    borderColor: '#0284c7',
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
    marginTop: 0,
    marginBottom: '24px',
  },
  exportOptionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    maxWidth: '600px',
  },
  exportOptionCard: {
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '16px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  exportCardHeader: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '16px',
  },
  exportCardIconArea: {
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  docIconBox: {
    position: 'relative',
    display: 'inline-block',
  },
  plusIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: '#0284c7',
    color: '#fff',
    borderRadius: '50%',
    width: '16px',
    height: '16px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportCardFooter: {
    fontSize: '12px',
    color: '#64748b',
  },
  newCf4HeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  backButton: {
    border: 'none',
    backgroundColor: 'transparent',
    color: '#0284c7',
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
    marginBottom: '20px',
  },
  cf4SelectBtn: {
    border: '1px solid #0284c7',
    backgroundColor: '#ffffff',
    color: '#0284c7',
    borderRadius: '4px',
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  newCf4FooterRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  cancelBtn: {
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#475569',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  proceedBtn: {
    border: 'none',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  uploadHeaderArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  uploadCloudCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#e0f2fe',
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
    margin: '0 0 20px 0',
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
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
  },
  dragDropSubtitle: {
    margin: '0 0 12px 0',
    fontSize: '11px',
    color: '#94a3b8',
  },
  browseFileBtn: {
    display: 'inline-block',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    padding: '6px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  uploadedFileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '20px',
  },
  pdfBadgeIcon: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
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
    border: 'none',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    width: '600px',
    maxWidth: '90%',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '24px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  closeModalBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '16px',
    color: '#94a3b8',
    cursor: 'pointer',
  },
  modalTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f172a',
  },
  modalSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '12px',
    color: '#64748b',
  },
  physicianBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: '6px 10px',
    borderRadius: '6px',
  },
  patientCard: {
    display: 'flex',
    gap: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
  },
  patientAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '12px',
    color: '#334155',
  },
  patientMetaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '12px',
    flex: 1,
  },
  patientName: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#0f172a',
  },
  patientSub: {
    fontSize: '11px',
    color: '#64748b',
  },
  metaLabel: {
    fontSize: '11px',
    color: '#64748b',
  },
  metaValue: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#0f172a',
  },
  aiContentBox: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
  },
  aiHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  aiLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#0284c7',
  },
  aiGenTime: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  aiParagraph: {
    fontSize: '12px',
    color: '#334155',
    lineHeight: '1.5',
    margin: '0 0 12px 0',
  },
  checklistCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: '6px',
    padding: '10px',
  },
  checklistTitle: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#0284c7',
    marginBottom: '4px',
  },
  checklistUl: {
    margin: 0,
    paddingLeft: '16px',
    fontSize: '11px',
    color: '#0369a1',
  },
  notifyBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
  },
  notifyTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#0f172a',
  },
  notifySubtitle: {
    fontSize: '11px',
    color: '#64748b',
    margin: '2px 0 8px 0',
  },
  notifyInputWrapper: {
    display: 'flex',
    gap: '8px',
  },
  notifyTextarea: {
    flex: 1,
    height: '36px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    padding: '6px 8px',
    fontSize: '12px',
    outline: 'none',
    resize: 'none',
  },
  sendNotifyBtn: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '0 12px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  requestRevisionsBtn: {
    border: '1px solid #ef4444',
    backgroundColor: '#ffffff',
    color: '#ef4444',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  approveSummaryBtn: {
    border: 'none',
    backgroundColor: '#16a34a',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cf4ModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    width: '700px',
    maxWidth: '95%',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '20px',
    position: 'relative',
  },
  cf4CloseBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '16px',
    cursor: 'pointer',
  },
  cf4PaperContainer: {
    border: '1px solid #000',
    padding: '12px',
    fontSize: '11px',
  },
  cf4SectionHeader: {
    backgroundColor: '#e2e8f0',
    padding: '4px',
    fontWeight: 'normal',
    border: '1px solid #000',
    marginBottom: '-1px',
  },
  cf4SubHeader: {
    padding: '4px',
    fontWeight: 'bold',
    fontSize: '10px',
    border: '1px solid #000',
    borderTop: 'none',
    marginBottom: '8px',
  },
  cf4GridTable: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '8px',
  },
  cf4Th: {
    border: '1px solid #000',
    fontSize: '10px',
    padding: '4px',
    textAlign: 'left',
  },
  cf4Td: {
    border: '1px solid #000',
    fontSize: '10px',
    padding: '4px',
    verticalAlign: 'top',
  },
};