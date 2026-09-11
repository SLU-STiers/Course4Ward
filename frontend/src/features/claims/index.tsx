/** Part of the claims dashboard — see index.tsx for the screen shell. */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { NotificationBell } from '../../components/layout/NotificationBell';
import { SidebarProfile } from '../../components/layout/SidebarProfile';
import { Button, DataTableToolbar, PageHeader, StatusBadge } from '../../components/ui';
import overviewIcon from '../../Img/overview.png';
import requestsIcon from '../../Img/requests.png';
import exportIcon from '../../Img/export.png';
import { useAuthStore } from '../../store/authStore';
import { claimsApi } from '../../services/domainApi';
import { formatDateMedium, formatTimeMedium } from '../../lib/format';
import { styles, overviewStyles } from './styles';

import { mapClaimToPatient, mapClaimToRequest } from './mappers';
import { ReviewRequestModal } from './ReviewRequestModal';
import type { CF4Patient, ExportSubView, PatientSortField, PatientStatus, RequestSortField, SortDirection, SummarizationRequest, TabType } from './types';

export function ClaimsProcessorDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [exportSubView, setExportSubView] = useState<ExportSubView>('selection');

  // Request State
  const [searchQuery, setSearchQuery] = useState('');
  const [requests, setRequests] = useState<SummarizationRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<SummarizationRequest | null>(null);
  const [requestPage, setRequestPage] = useState(1);
  const [requestSortField, setRequestSortField] = useState<RequestSortField>('date');
  const [requestSortDirection, setRequestSortDirection] = useState<SortDirection>('descending');
  const [requestDateFrom, setRequestDateFrom] = useState('');
  const [requestDateTo, setRequestDateTo] = useState('');
  const [requestStatus, setRequestStatus] = useState<'all' | SummarizationRequest['status']>('all');

  // CF4 Export State
  const [cf4Patients, setCf4Patients] = useState<CF4Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientPage, setPatientPage] = useState(1);
  const [patientSortField, setPatientSortField] = useState<PatientSortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');
  const [admissionFrom, setAdmissionFrom] = useState('');
  const [admissionTo, setAdmissionTo] = useState('');
  const [patientStatus, setPatientStatus] = useState<PatientStatus>('all');
  const [previewPatient, setPreviewPatient] = useState<CF4Patient | null>(null);
  const [selectedOrderDate, setSelectedOrderDate] = useState('2026-04-15');
  const [evaluator, setEvaluator] = useState('Dr. Mike Mentzer');
  const overviewRequest = requests.find((request) => request.id === previewPatient?.claimId) ?? requests[0];

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

  useEffect(() => {
    claimsApi.findAll().then(({ data }) => {
      setRequests(data.map(mapClaimToRequest));
      setCf4Patients(data.map(mapClaimToPatient));
    }).catch(() => {
      setRequests([]);
      setCf4Patients([]);
    });
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredRequests = requests.filter((req) => {
    const [day, month, year] = req.date.split(' ');
    const requestDate = `${year}-${
      {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
      }[month] ?? '01'
    }-${day.padStart(2, '0')}`;
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
  const orderDates = [...new Set(requests.map((request) => {
    const [day, month, year] = request.date.split(' ');
    return `${year}-${{ Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }[month] ?? '01'}-${day.padStart(2, '0')}`;
  }))].sort().reverse();

  const setPatientSearchAndResetPage = (value: string) => {
    setPatientSearch(value);
    setPatientPage(1);
  };

  const setRequestSearchAndResetPage = (value: string) => {
    setSearchQuery(value);
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

  const handleGenerateCf4 = async () => {
    const selectedPatient = cf4Patients.find((patient) => patient.selected);
    if (!selectedPatient) return;

    const { data } = await claimsApi.generateCf4(selectedPatient.claimId);
    setRequests((prev) => prev.map((request) => (
      request.id === selectedPatient.claimId ? { ...request, status: 'Approved' } : request
    )));
    setCf4Patients((prev) => prev.map((patient) => (
      patient.claimId === selectedPatient.claimId ? { ...patient, selected: false } : patient
    )));
    setPreviewPatient(null);
    alert(`CF4 generated for ${data.cf4Fields.patientName}`);
  };

  return (
    <Layout
      navbarProps={{
        ariaLabel: 'Claims processor navigation',
        activeId: activeTab,
        onNavigate: (id) => {
          const tab = id as TabType;
          setActiveTab(tab);
          if (tab === 'export') setExportSubView('selection');
        },
        items: [
          { id: 'overview', label: 'Dashboard', icon: <img src={overviewIcon} alt="" aria-hidden="true" style={styles.navIconImage} /> },
          { id: 'requests', label: 'Requests', icon: <img src={requestsIcon} alt="" aria-hidden="true" style={styles.navIconImage} /> },
          { id: 'export', label: 'Export', icon: <img src={exportIcon} alt="" aria-hidden="true" style={styles.navIconImage} /> },
        ],
        profile: <SidebarProfile initials="SJ" name="Steve Joabs" subtitle="Claims Processor" onLogout={handleLogout} />,
      }}
      header={
        <PageHeader
          title="Claims Processor"
          actions={<NotificationBell />}
        />
      }
    >
          {/* REQUESTS TAB */}
          {activeTab === 'requests' && (
            <div>
              <DataTableToolbar
                searchProps={{
                  value: searchQuery,
                  onChange: setRequestSearchAndResetPage,
                  placeholder: 'Search requests...',
                  ariaLabel: 'Search requests',
                }}
                filterProps={{
                  title: 'Filter requests',
                  options: [
                    { value: 'all', label: 'All' },
                    { value: 'Pending Review', label: 'Pending Review' },
                    { value: 'Approved', label: 'Approved' },
                    { value: 'Rejected', label: 'Rejected' },
                  ],
                  value: requestStatus,
                  onChange: (value) => { setRequestStatus(value as typeof requestStatus); setRequestPage(1); },
                  extra: (
                    <>
                      <span className="ui-menu__heading">Submitted on</span>
                      <input type="date" value={requestDateFrom} onChange={(e) => { setRequestDateFrom(e.target.value); setRequestPage(1); }} aria-label="Requests from date" />
                      <input type="date" value={requestDateTo} onChange={(e) => { setRequestDateTo(e.target.value); setRequestPage(1); }} aria-label="Requests to date" />
                    </>
                  ),
                }}
                sortProps={{
                  title: 'Sort requests by',
                  options: [
                    { value: 'id', label: 'Request ID' },
                    { value: 'date', label: 'Submitted on' },
                    { value: 'status', label: 'Status' },
                  ],
                  value: requestSortField,
                  onChange: (value) => { setRequestSortField(value as RequestSortField); setRequestPage(1); },
                  direction: requestSortDirection,
                  onDirectionChange: (direction) => { setRequestSortDirection(direction); setRequestPage(1); },
                }}
              />

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
                          <StatusBadge
                            showDot
                            status={
                              req.status === 'Pending Review'
                                ? 'pending'
                                : req.status === 'Approved'
                                  ? 'approved'
                                  : 'rejected'
                            }
                            label={req.status}
                          />
                        </td>
                        <td style={{ ...styles.td, ...styles.requestActionCell }}>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setSelectedRequest(req)}
                          >
                            Review
                          </Button>
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

          {selectedRequest && (
            <ReviewRequestModal
              request={selectedRequest}
              onClose={() => setSelectedRequest(null)}
              onRequestRevisions={() => {
                claimsApi.notifyPhysician(selectedRequest.id).then(() => {
                  setSelectedRequest(null);
                });
              }}
            />
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

                  <DataTableToolbar
                    searchProps={{
                      value: patientSearch,
                      onChange: setPatientSearchAndResetPage,
                      placeholder: 'Search patient',
                      ariaLabel: 'Search patients',
                    }}
                    filterProps={{
                      title: 'Filter patients',
                      options: [
                        { value: 'all', label: 'All' },
                        { value: 'admitted', label: 'Admitted' },
                        { value: 'discharged', label: 'Discharged' },
                      ],
                      value: patientStatus,
                      onChange: (value) => { setPatientStatus(value as PatientStatus); setPatientPage(1); },
                      extra: (
                        <>
                          <span className="ui-menu__heading">Admission date</span>
                          <input type="date" value={admissionFrom} onChange={(e) => { setAdmissionFrom(e.target.value); setPatientPage(1); }} aria-label="Admission date from" />
                          <input type="date" value={admissionTo} onChange={(e) => { setAdmissionTo(e.target.value); setPatientPage(1); }} aria-label="Admission date to" />
                        </>
                      ),
                    }}
                    sortProps={{
                      title: 'Sort patients by',
                      options: [
                        { value: 'name', label: 'Patient name' },
                        { value: 'patientId', label: 'Patient ID' },
                        { value: 'admissionDate', label: 'Admission date' },
                      ],
                      value: patientSortField,
                      onChange: (value) => { setPatientSortField(value as PatientSortField); setPatientPage(1); },
                      direction: sortDirection,
                      onDirectionChange: (direction) => { setSortDirection(direction); setPatientPage(1); },
                    }}
                  />

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
                      onClick={handleGenerateCf4}
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
                      onClick={handleGenerateCf4}
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

                <DataTableToolbar
                  searchProps={{
                    value: patientSearch,
                    onChange: setPatientSearchAndResetPage,
                    placeholder: 'Search patient',
                    ariaLabel: 'Search patients',
                  }}
                  filterProps={{
                    title: 'Filter patients',
                    options: [
                      { value: 'all', label: 'All' },
                      { value: 'admitted', label: 'Admitted' },
                      { value: 'discharged', label: 'Discharged' },
                    ],
                    value: patientStatus,
                    onChange: (value) => { setPatientStatus(value as PatientStatus); setPatientPage(1); },
                    extra: (
                      <>
                        <span className="ui-menu__heading">Admission date</span>
                        <input type="date" value={admissionFrom} onChange={(e) => { setAdmissionFrom(e.target.value); setPatientPage(1); }} aria-label="Admission date from" />
                        <input type="date" value={admissionTo} onChange={(e) => { setAdmissionTo(e.target.value); setPatientPage(1); }} aria-label="Admission date to" />
                      </>
                    ),
                  }}
                  sortProps={{
                    title: 'Sort patients by',
                    options: [
                      { value: 'name', label: 'Patient name' },
                      { value: 'patientId', label: 'Patient ID' },
                      { value: 'admissionDate', label: 'Admission date' },
                    ],
                    value: patientSortField,
                    onChange: (value) => { setPatientSortField(value as PatientSortField); setPatientPage(1); },
                    direction: sortDirection,
                    onDirectionChange: (direction) => { setSortDirection(direction); setPatientPage(1); },
                  }}
                />

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
                                backgroundColor: 'var(--c4w-color-primary-active)',
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
                    {overviewRequest?.orders.length ? overviewRequest.orders.map((order) => (
                      <div style={overviewStyles.timelineItem} key={`${overviewRequest.id}-${order.dateCreated}`}>
                        <div style={overviewStyles.timelineMeta}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatDateMedium(order.dateCreated)}</div>
                          <div style={{ color: '#64748b' }}>{formatTimeMedium(order.dateCreated)}</div>
                        </div>
                        <div style={overviewStyles.timelineDot} />
                        <div style={overviewStyles.orderBox}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '6px' }}>
                            {order.doctor}
                          </div>
                          <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                            {order.content}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div style={{ padding: '24px', color: '#64748b', fontSize: '13px' }}>
                        No physician orders are available for the selected claim.
                      </div>
                    )}
                  </div>
                </div>
                <div style={overviewStyles.aiCard}>
                  <div style={overviewStyles.aiHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span aria-hidden="true">✨</span>
                      <h3 style={overviewStyles.aiTitle}>AI Summarized</h3>
                    </div>
                    <span style={overviewStyles.aiStatus}>{overviewRequest?.status ?? 'No claims'}</span>
                  </div>
                  <div style={overviewStyles.aiBody}>
                    <p style={overviewStyles.aiSummary}>
                      {overviewRequest?.summaryText ?? 'Select a persisted claim to review its AI summary.'}
                    </p>
                    <div style={overviewStyles.aiActions}>
                      <select value={evaluator} onChange={(e) => setEvaluator(e.target.value)} style={overviewStyles.evaluatorSelect} aria-label="Evaluator">
                        <option>{overviewRequest?.doctor ?? 'Attending physician'}</option>
                      </select>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!overviewRequest}
                        onClick={() => overviewRequest && claimsApi.notifyPhysician(overviewRequest.id)}
                      >
                        Submit
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
    </Layout>
  );
}
