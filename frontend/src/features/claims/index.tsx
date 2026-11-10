/** Part of the claims dashboard — see index.tsx for the screen shell. */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { NotificationBell } from '../../components/layout/NotificationBell';
import { SidebarProfile } from '../../components/layout/SidebarProfile';
import { Button, DataTableToolbar, PageHeader, StatusBadge } from '../../components/ui';
import { patientTableStyles } from '../../components/patientList/PatientTable';
import { DashboardIcon, ExportIcon, RequestsIcon } from '../../components/icons/NavIcons';
import { AiSummaryCard } from '../../components/ai/AiSummaryCard';
import { ORDER_TEXT_STYLE, SubmittedOrdersTimeline } from '../../components/orders/SubmittedOrdersTimeline';
import { OrderStatusSummary } from '../../components/orders/OrderStatusSummary';
import { signOut } from '../../services/signOut';
import { useAuthStore } from '../../store/authStore';
import { claimsApi } from '../../services/domainApi';
import { ORDER_POLL_MS, usePolling } from '../../hooks/usePolling';
import { formatDateMedium, toDateKey } from '../../lib/format';
import { styles, overviewStyles } from './styles';

import { groupApprovedPatients, groupStayPatients, mapClaimToPatient, mapClaimToRequest } from './mappers';
import { ReviewRequestModal } from './ReviewRequestModal';
import { EligibleSummariesCard } from './EligibleSummariesCard';
import { Cf4SummaryPreview } from './Cf4SummaryPreview';
import type { CF4Patient, Cf4SummaryDraft, ExportSource, ExportSubView, PatientSortField, PatientStatus, RequestSortField, SortDirection, SummarizationRequest, TabType } from './types';

/** Sort key for a patient-list column (numbers compare numerically). */
function patientSortValue(patient: CF4Patient, field: PatientSortField): string | number {
  if (field === 'age') return patient.age ?? 0;
  if (field === 'daysInCare') return patient.daysInCare;
  if (field === 'admissionDate') return patient.admissionDateRaw;
  return patient.name;
}

export function ClaimsProcessorDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [exportSubView, setExportSubView] = useState<ExportSubView>('selection');

  // Request State
  const [searchQuery, setSearchQuery] = useState('');
  const [requests, setRequests] = useState<SummarizationRequest[]>([]);
  /** Every day of the stay opened from the requests table or a notification. */
  const [reviewStay, setReviewStay] = useState<SummarizationRequest[] | null>(null);
  /** Claim a notification should open once the requests list has it. */
  const [focusRequestId, setFocusRequestId] = useState<string | null>(null);
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
  const [exportPatientPage, setExportPatientPage] = useState(1);
  const [patientSortField, setPatientSortField] = useState<PatientSortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');
  const [admissionFrom, setAdmissionFrom] = useState('');
  const [admissionTo, setAdmissionTo] = useState('');
  const [patientStatus, setPatientStatus] = useState<PatientStatus>('all');
  const [selectedExportPatientIds, setSelectedExportPatientIds] = useState<string[]>([]);
  const [previewPatient, setPreviewPatient] = useState<CF4Patient | null>(null);
  const [selectedOrderDate, setSelectedOrderDate] = useState('');
  // Signed-in claims processor: the CF4's "Prepared by".
  const user = useAuthStore((s) => s.user);
  const evaluator = user ? `${user.firstName} ${user.lastName}` : 'Claims Processor';

  // Export → Course in the Ward Summary review step
  const [exportSource, setExportSource] = useState<ExportSource>('new-cf4');
  /** Every patient queued for CF4 generation, in the order it was shown. */
  const [summaryDrafts, setSummaryDrafts] = useState<Cf4SummaryDraft[]>([]);
  const [summaryIndex, setSummaryIndex] = useState(0);
  const [existingPatientId, setExistingPatientId] = useState('');
  const [exportError, setExportError] = useState('');
  const [confirmingSummary, setConfirmingSummary] = useState(false);
  const stayRequests = previewPatient
    ? requests
        .filter((request) => previewPatient.claimIds.includes(request.id))
        .sort((a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime())
    : [];

  const navigate = useNavigate();

  // Upload File State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const loadClaims = useCallback(() => {
    claimsApi.findAll().then(({ data }) => {
      const mappedRequests = data.map(mapClaimToRequest);
      const mappedPatients = data.map(mapClaimToPatient);
      const eligibleIds = new Set(groupApprovedPatients(mappedPatients).map((patient) => patient.id));
      setRequests(mappedRequests);
      setCf4Patients(mappedPatients);
      setSelectedExportPatientIds((previous) => previous.filter((id) => eligibleIds.has(id)));
    }).catch(() => {
      setRequests([]);
      setCf4Patients([]);
      setSelectedExportPatientIds([]);
    });
  }, []);

  useEffect(loadClaims, [loadClaims]);
  usePolling(loadClaims, ORDER_POLL_MS);

  useEffect(() => {
    if (!focusRequestId) return;
    const match = requests.find((request) => request.id === focusRequestId);
    if (!match) return;
    setActiveTab('requests');
    setReviewStay(requests.filter((request) => request.patient.patientId === match.patient.patientId));
    setFocusRequestId(null);
  }, [focusRequestId, requests]);

  useEffect(() => {
    if (!reviewStay?.length) return;
    const ids = new Set(reviewStay.map((request) => request.id));
    const fresh = requests.filter((request) => ids.has(request.id));
    const previous = reviewStay.map((request) => request.status).join();
    const next = fresh.map((request) => request.status).join();
    if (fresh.length && previous !== next) setReviewStay(fresh);
  }, [requests, reviewStay]);

  const handleLogout = () => {
    signOut('MANUAL');
    navigate('/login');
  };

  const filteredRequests = requests.filter((req) => {
    const requestDate = toDateKey(req.submittedAt);
    return (
      req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.patient.patientId.toLowerCase().includes(searchQuery.toLowerCase())
    ) &&
      (requestStatus === 'all' || req.status === requestStatus) &&
      (!requestDateFrom || requestDate >= requestDateFrom) &&
      (!requestDateTo || requestDate <= requestDateTo);
  });
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const comparison = requestSortField === 'date'
      ? new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      : (requestSortField === 'id' ? a.id : a.status).localeCompare(
          requestSortField === 'id' ? b.id : b.status,
          undefined,
          { numeric: true },
        );
    return requestSortDirection === 'ascending' ? comparison : -comparison;
  });
  const requestGroupsByPatient = new Map<string, SummarizationRequest[]>();
  for (const request of sortedRequests) {
    const key = request.patient.patientId;
    const group = requestGroupsByPatient.get(key);
    if (group) group.push(request);
    else requestGroupsByPatient.set(key, [request]);
  }
  const groupedRequests = [...requestGroupsByPatient].map(([id, groupRequests]) => ({
    id,
    requests: groupRequests,
  }));
  const requestPageSize = 8;
  const requestPageCount = Math.max(1, Math.ceil(groupedRequests.length / requestPageSize));
  const safeRequestPage = Math.min(requestPage, requestPageCount);
  const requestStart = (safeRequestPage - 1) * requestPageSize;
  const visibleRequestGroups = groupedRequests.slice(requestStart, requestStart + requestPageSize);
  const requestPages = Array.from({ length: requestPageCount }, (_, index) => index + 1);

  const filteredCf4Patients = groupStayPatients(cf4Patients).filter(
    (p) =>
      (p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.patientId.includes(patientSearch)) &&
      (patientStatus === 'all' || p.status === patientStatus) &&
      (!admissionFrom || p.admissionDateRaw >= admissionFrom) &&
      (!admissionTo || p.admissionDateRaw <= admissionTo)
  );
  const sortedCf4Patients = [...filteredCf4Patients].sort((a, b) => {
    const valueA = patientSortValue(a, patientSortField);
    const valueB = patientSortValue(b, patientSortField);
    const comparison =
      typeof valueA === 'number' && typeof valueB === 'number'
        ? valueA - valueB
        : String(valueA).localeCompare(String(valueB), undefined, { numeric: true });
    return sortDirection === 'ascending' ? comparison : -comparison;
  });
  const patientPageSize = 8;
  const patientPageCount = Math.max(1, Math.ceil(sortedCf4Patients.length / patientPageSize));
  const safePatientPage = Math.min(patientPage, patientPageCount);
  const patientStart = (safePatientPage - 1) * patientPageSize;
  const visibleCf4Patients = sortedCf4Patients.slice(patientStart, patientStart + patientPageSize);
  const patientPages = Array.from({ length: patientPageCount }, (_, index) => index + 1);
  const eligibleExportPatients = groupApprovedPatients(cf4Patients);
  const filteredExportPatients = eligibleExportPatients.filter(
    (patient) =>
      (patient.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
        patient.patientId.toLowerCase().includes(patientSearch.toLowerCase())) &&
      (patientStatus === 'all' || patient.status === patientStatus) &&
      (!admissionFrom || patient.admissionDateRaw >= admissionFrom) &&
      (!admissionTo || patient.admissionDateRaw <= admissionTo),
  );
  const sortedExportPatients = [...filteredExportPatients].sort((a, b) => {
    const valueA = patientSortValue(a, patientSortField);
    const valueB = patientSortValue(b, patientSortField);
    const comparison =
      typeof valueA === 'number' && typeof valueB === 'number'
        ? valueA - valueB
        : String(valueA).localeCompare(String(valueB), undefined, { numeric: true });
    return sortDirection === 'ascending' ? comparison : -comparison;
  });
  const exportPatientPageCount = Math.max(1, Math.ceil(sortedExportPatients.length / patientPageSize));
  const safeExportPatientPage = Math.min(exportPatientPage, exportPatientPageCount);
  const exportPatientStart = (safeExportPatientPage - 1) * patientPageSize;
  const visibleExportPatients = sortedExportPatients.slice(
    exportPatientStart,
    exportPatientStart + patientPageSize,
  );
  const exportPatientPages = Array.from({ length: exportPatientPageCount }, (_, index) => index + 1);
  /* The days of the claim on screen that actually carry orders — the only stops
     the date arrows and the calendar offer. */
  const stayOrders = (() => {
    const seen = new Set<string>();
    return stayRequests.flatMap((request) => request.orders).filter((order) => {
      if (seen.has(order.id)) return false;
      seen.add(order.id);
      return true;
    });
  })();
  const orderDates = [
    ...new Set(stayOrders.map((order) => toDateKey(order.dateCreated)).filter(Boolean)),
  ].sort();
  /* Like the physician's list: a picked day only sticks while the claim on
     screen actually has orders on it. */
  const activeOrderDate =
    selectedOrderDate && orderDates.includes(selectedOrderDate)
      ? selectedOrderDate
      : '';
  const hasPrevOrderDate =
    orderDates.length > 0 &&
    (!activeOrderDate || orderDates.some((day) => day < activeOrderDate));
  const hasNextOrderDate =
    orderDates.length > 0 &&
    (!activeOrderDate || orderDates.some((day) => day > activeOrderDate));

  const setPatientSearchAndResetPage = (value: string) => {
    setPatientSearch(value);
    setPatientPage(1);
    setExportPatientPage(1);
  };

  const setRequestSearchAndResetPage = (value: string) => {
    setSearchQuery(value);
    setRequestPage(1);
  };

  const shiftOrderDate = (direction: -1 | 1) => {
    if (!orderDates.length) return;
    if (!activeOrderDate) {
      setSelectedOrderDate(
        direction < 0 ? orderDates[orderDates.length - 1] : orderDates[0],
      );
      return;
    }
    const candidates = orderDates.filter((day) =>
      direction < 0 ? day < activeOrderDate : day > activeOrderDate,
    );
    if (!candidates.length) return;
    setSelectedOrderDate(
      direction < 0 ? candidates[candidates.length - 1] : candidates[0],
    );
  };

  const toggleSelectExportPatient = (id: string) => {
    setSelectedExportPatientIds((previous) =>
      previous.includes(id) ? previous.filter((selectedId) => selectedId !== id) : [...previous, id],
    );
  };

  /* The Overview tab's "View" only drives the orders timeline / AI card on the
     right — it must not touch the export selection, or browsing the dashboard
     would silently queue patients for CF4 generation. */
  const handleViewPatient = (patient: CF4Patient) => {
    setPreviewPatient(patient);
  };

  /* Counts every queued row, including the ones on other pages. */
  const selectedPatientCount = selectedExportPatientIds.length;

  const acceptTemplateFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') || file.type && file.type !== 'application/pdf') {
      setUploadedFile(null);
      setExportError('Choose a valid PDF file to use as the existing CF4 template.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadedFile(null);
      setExportError('The PDF must be 50 MB or smaller.');
      return;
    }
    setExportError('');
    setUploadedFile(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (file) acceptTemplateFile(file);
  };

  const goToExportSubView = (view: ExportSubView) => {
    setExportError('');
    setExportSubView(view);
  };

  /* Each export draft covers one patient and all approved daily summaries. */
  const handleProceedToSummary = (source: ExportSource) => {
    if (source === 'existing-cf4' && !uploadedFile) {
      setExportError('Upload an existing CF4 PDF before proceeding.');
      return;
    }

    const queued =
      source === 'new-cf4'
        ? sortedExportPatients.filter((candidate) => selectedExportPatientIds.includes(candidate.id))
        : eligibleExportPatients.filter((candidate) => candidate.id === existingPatientId);

    if (!queued.length) {
      setExportError(
        'Select at least one approved patient first.',
      );
      return;
    }

    setExportError('');
    setSummaryDrafts(
      queued.map((patient) => ({
        patient,
        requests: requests
          .filter((request) => patient.claimIds.includes(request.id))
          .sort((a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime()),
      })),
    );
    setSummaryIndex(0);
    setExportSource(source);
    setExportSubView('summary');
  };

  /* Each patient is exported once, after generating every included daily claim. */
  const handleConfirmSummary = async () => {
    if (!summaryDrafts.length) return;
    setConfirmingSummary(true);
    setExportError('');

    const generated: Cf4SummaryDraft[] = [];
    const failed: string[] = [];
    const generatedClaimIds: string[] = [];
    for (const draft of summaryDrafts) {
      let allClaimsGenerated = true;
      for (const claimId of draft.patient.claimIds) {
        try {
          await claimsApi.generateCf4(claimId);
          generatedClaimIds.push(claimId);
        } catch {
          allClaimsGenerated = false;
          break;
        }
      }
      if (allClaimsGenerated) generated.push(draft);
      else failed.push(draft.patient.name);
    }

    setRequests((prev) => prev.map((request) => (
      generatedClaimIds.includes(request.id) ? { ...request, status: 'Approved' } : request
    )));
    setSelectedExportPatientIds((prev) =>
      prev.filter((id) => !generated.some((draft) => draft.patient.id === id)),
    );
    setConfirmingSummary(false);

    if (failed.length) {
      setSummaryDrafts(summaryDrafts.filter((draft) => !generated.includes(draft)));
      setSummaryIndex(0);
      setExportError(
        `Could not generate the CF4 for ${failed.join(', ')} — the Course in the Ward summary must be physician-approved.`,
      );
      return;
    }

    const count = generated.length;
    setPreviewPatient(null);
    setSummaryDrafts([]);
    setSummaryIndex(0);
    setExistingPatientId('');
    setUploadedFile(null);
    setExportSubView('selection');
    alert(
      count === 1
        ? `CF4 generated for ${generated[0].patient.name}`
        : `CF4 generated for ${count} patients.`,
    );
  };

  return (
    <Layout
      navbarProps={{
        ariaLabel: 'Claims processor navigation',
        activeId: activeTab,
        onNavigate: (id) => {
          const tab = id as TabType;
          setActiveTab(tab);
          if (tab === 'export') goToExportSubView('selection');
        },
        items: [
          { id: 'overview', label: 'Dashboard', icon: <DashboardIcon /> },
          { id: 'requests', label: 'Requests', icon: <RequestsIcon /> },
          { id: 'export', label: 'Export', icon: <ExportIcon /> },
        ],
        profile: <SidebarProfile initials="SJ" name="Steve Joabs" subtitle="Claims Processor" onLogout={handleLogout} />,
      }}
      header={
        <PageHeader
          title="Claims Processor"
          actions={
            <NotificationBell
              onOpenRequest={(requestId) => {
                setActiveTab('requests');
                setFocusRequestId(requestId);
                loadClaims();
              }}
            />
          }
        />
      }
    >
          {/* REQUESTS TAB */}
          {activeTab === 'requests' && (
            <div>
              <EligibleSummariesCard onClaimCreated={loadClaims} />
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
                <table style={styles.table} className="ui-table-hover">
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={{ ...styles.th, width: '23%' }}>Submitted On</th>
                      <th style={{ ...styles.th, width: '42%' }}>Patient</th>
                      <th style={{ ...styles.th, width: '18%' }}>Status</th>
                      <th style={{ ...styles.th, width: '17%', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRequestGroups.map((group) => {
                      const latestRequest = group.requests.reduce((latest, request) =>
                        new Date(request.submittedAt) > new Date(latest.submittedAt) ? request : latest,
                      );
                      const pendingCount = group.requests.filter((req) => req.status === 'Pending Review').length;
                      const rejectedCount = group.requests.filter((req) => req.status === 'Rejected').length;
                      const groupStatus = pendingCount
                        ? 'Pending Review'
                        : rejectedCount
                          ? 'Rejected'
                          : 'Approved';
                      return (
                        <tr key={group.id} style={styles.tr}>
                          <td style={styles.td}>
                            <div style={styles.dateCell}>
                              <span style={styles.dateText}>{latestRequest.date}</span>
                              <span style={styles.dateSeparator} />
                              <span style={styles.timeText}>{latestRequest.time}</span>
                            </div>
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                                {latestRequest.patient.name}
                              </span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>
                                {latestRequest.patient.age} years · {latestRequest.patient.gender}
                              </span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>
                                Admitted {latestRequest.patient.admissionDate}
                              </span>
                            </div>
                          </td>
                          <td style={styles.td}>
                            <StatusBadge
                              showDot
                              status={
                                groupStatus === 'Pending Review'
                                  ? 'pending'
                                  : groupStatus === 'Approved'
                                    ? 'approved'
                                    : 'rejected'
                              }
                              label={groupStatus}
                            />
                          </td>
                          <td style={{ ...styles.td, ...styles.requestActionCell }}>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setReviewStay(group.requests)}
                            >
                              Review
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div style={styles.paginationRow}>
                  <span style={styles.paginationText}>
                    Showing {groupedRequests.length ? requestStart + 1 : 0} to {Math.min(requestStart + requestPageSize, groupedRequests.length)} of {groupedRequests.length} patients
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

          {reviewStay && reviewStay.length > 0 && (
            <ReviewRequestModal
              requests={reviewStay}
              onClose={() => setReviewStay(null)}
              onRequestRevisions={async (message) => {
                const pending = reviewStay.filter((request) => request.status === 'Pending Review');
                const targets = pending.length ? pending : reviewStay;
                await Promise.all(targets.map((request) => claimsApi.notifyPhysician(request.id, message)));
                setReviewStay(null);
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
                      onClick={() => goToExportSubView('new-cf4')}
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
                      onClick={() => goToExportSubView('existing-cf4')}
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
                      onClick={() => goToExportSubView('selection')}
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
                      onChange: (value) => { setPatientStatus(value as PatientStatus); setPatientPage(1); setExportPatientPage(1); },
                      extra: (
                        <>
                          <span className="ui-menu__heading">Admission date</span>
                          <input type="date" value={admissionFrom} onChange={(e) => { setAdmissionFrom(e.target.value); setPatientPage(1); setExportPatientPage(1); }} aria-label="Admission date from" />
                          <input type="date" value={admissionTo} onChange={(e) => { setAdmissionTo(e.target.value); setPatientPage(1); setExportPatientPage(1); }} aria-label="Admission date to" />
                        </>
                      ),
                    }}
                    sortProps={{
                      title: 'Sort patients by',
                      options: [
                        { value: 'admissionDate', label: 'Admission date' },
                        { value: 'daysInCare', label: 'Days in care' },
                        { value: 'age', label: 'Age' },
                        { value: 'name', label: 'Patient name' },
                      ],
                      value: patientSortField,
                      onChange: (value) => { setPatientSortField(value as PatientSortField); setPatientPage(1); setExportPatientPage(1); },
                      direction: sortDirection,
                      onDirectionChange: (direction) => { setSortDirection(direction); setPatientPage(1); setExportPatientPage(1); },
                    }}
                  />

                  <div style={styles.patientTableWrapper}>
                    <table style={{ ...styles.table, tableLayout: 'auto' }}>
                      <thead>
                        <tr style={styles.thRow}>
                          <th style={styles.th}>Patient</th>
                          <th style={styles.th}>Sex</th>
                          <th style={styles.th}>Age</th>
                          <th style={styles.th}>Admitted</th>
                          <th style={styles.th}>Days in care</th>
                          <th style={styles.th}>Status</th>
                          <th style={{ ...styles.th, textAlign: 'right' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleExportPatients.map((p) => (
                          <tr
                            key={p.id}
                            style={selectedExportPatientIds.includes(p.id) ? { ...styles.tr, ...patientTableStyles.rowSelected } : styles.tr}
                          >
                            <td style={styles.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ ...patientTableStyles.dot, backgroundColor: p.color }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <span style={patientTableStyles.name}>{p.name}</span>
                                  <span style={{ fontSize: 11, color: '#64748b' }}>
                                    {p.claimIds.length} {p.claimIds.length === 1 ? 'daily summary' : 'daily summaries'} · {p.coveragePeriod}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td style={{ ...styles.td, ...patientTableStyles.cell }}>
                              {p.gender}
                            </td>
                            <td style={{ ...styles.td, ...patientTableStyles.cell }}>
                              {p.age ?? '—'}
                            </td>
                            <td style={{ ...styles.td, ...patientTableStyles.cell }}>
                              {p.admissionDate}
                            </td>
                            <td style={{ ...styles.td, ...patientTableStyles.cell }}>
                              {p.daysInCare} {p.daysInCare === 1 ? 'day' : 'days'}
                            </td>
                            <td style={styles.td}>
                              <StatusBadge status={p.status} showDot />
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <button
                                style={selectedExportPatientIds.includes(p.id) ? patientTableStyles.deselectBtn : patientTableStyles.viewBtn}
                                aria-pressed={selectedExportPatientIds.includes(p.id)}
                                onClick={() => toggleSelectExportPatient(p.id)}
                              >
                                {selectedExportPatientIds.includes(p.id) ? 'Deselect' : 'Select'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!visibleExportPatients.length && (
                          <tr>
                            <td style={{ ...styles.td, ...patientTableStyles.cell }} colSpan={7}>
                              No approved patients match the current filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={styles.paginationRow}>
                    <span style={styles.paginationText}>
                      Showing {sortedExportPatients.length ? exportPatientStart + 1 : 0} to{' '}
                      {Math.min(exportPatientStart + patientPageSize, sortedExportPatients.length)} of{' '}
                      {sortedExportPatients.length} approved patients
                    </span>
                    <div style={styles.paginationControls}>
                      <button type="button" style={styles.pageArrowBtn} disabled={safeExportPatientPage === 1} onClick={() => setExportPatientPage((page) => Math.max(1, page - 1))}>‹</button>
                      {exportPatientPages.map((page) => (
                        <button type="button" key={page} style={{ ...styles.pageNumberBtn, ...(page === safeExportPatientPage ? styles.pageActive : {}) }} onClick={() => setExportPatientPage(page)}>{page}</button>
                      ))}
                      <button type="button" style={styles.pageArrowBtn} disabled={safeExportPatientPage === exportPatientPageCount} onClick={() => setExportPatientPage((page) => Math.min(exportPatientPageCount, page + 1))}>›</button>
                    </div>
                  </div>

                  {exportError && (
                    <p style={styles.exportErrorBanner} role="alert">
                      {exportError}
                    </p>
                  )}

                  <div style={styles.newCf4FooterRowSpread}>
                    <span style={styles.selectionCount}>
                      {selectedPatientCount
                        ? `${selectedPatientCount} patient${selectedPatientCount === 1 ? '' : 's'} selected`
                        : 'No patients selected yet'}
                    </span>
                    <div style={styles.newCf4FooterActions}>
                      <button
                        style={styles.cancelBtn}
                        onClick={() => goToExportSubView('selection')}
                      >
                        Cancel
                      </button>
                      <button
                        style={styles.proceedBtn}
                        onClick={() => handleProceedToSummary('new-cf4')}
                      >
                        Proceed to Summary
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBVIEW 3: EXISTING CF4 (UPLOAD FILE) */}
              {exportSubView === 'existing-cf4' && (
                <div style={styles.exportContainerCard}>
                  <div style={styles.newCf4HeaderRow}>
                    <button
                      style={styles.backButton}
                      onClick={() => goToExportSubView('selection')}
                    >
                      &lt; Back to Selection
                    </button>
                    <h3 style={styles.newCf4Title}>Modify Existing CF4</h3>
                    <div style={{ width: '120px' }} />
                  </div>

                  <div style={styles.exportPatientPicker}>
                    <label style={styles.exportPatientLabel} htmlFor="existing-cf4-patient">
                      Patient
                    </label>
                    <select
                      id="existing-cf4-patient"
                      style={styles.exportPatientSelect}
                      value={existingPatientId}
                      onChange={(event) => {
                        setExistingPatientId(event.target.value);
                        setExportError('');
                      }}
                    >
                      <option value="">Select the patient this CF4 belongs to…</option>
                      {eligibleExportPatients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.name} · {patient.patientId} · {patient.claimIds.length} day{patient.claimIds.length === 1 ? '' : 's'} · {patient.coveragePeriod}
                        </option>
                      ))}
                    </select>
                    <span style={styles.exportPatientHint}>
                      A patient must be selected before a Course in the Ward Summary can be created.
                    </span>
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

                  <div
                    style={styles.dragDropZone}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const file = event.dataTransfer.files[0];
                      if (file) acceptTemplateFile(file);
                    }}
                  >
                    <p style={styles.dragDropTitle}>Choose a file or drag & drop it here</p>
                    <p style={styles.dragDropSubtitle}>PDF, up to 50MB</p>
                    <label style={styles.browseFileBtn}>
                      Browse File
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
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
                          {(uploadedFile.size / 1024).toFixed(0)} KB · Ready to populate
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

                  {exportError && (
                    <p style={{ ...styles.exportErrorBanner, marginTop: '20px' }} role="alert">
                      {exportError}
                    </p>
                  )}

                  <div style={{ ...styles.newCf4FooterRow, marginTop: 'auto' }}>
                    <button
                      style={styles.cancelBtn}
                      onClick={() => goToExportSubView('selection')}
                    >
                      Cancel
                    </button>
                    <button
                      style={styles.proceedBtn}
                      onClick={() => handleProceedToSummary('existing-cf4')}
                    >
                      Proceed to Summary
                    </button>
                  </div>
                </div>
              )}

              {/* SUBVIEW 4: COURSE IN THE WARD SUMMARY REVIEW */}
              {exportSubView === 'summary' && summaryDrafts.length > 0 && (
                <Cf4SummaryPreview
                  drafts={summaryDrafts}
                  index={summaryIndex}
                  onIndexChange={setSummaryIndex}
                  source={exportSource}
                  evaluator={evaluator}
                  sourceFileName={
                    exportSource === 'existing-cf4' ? uploadedFile?.name : undefined
                  }
                  sourceFile={exportSource === 'existing-cf4' ? uploadedFile ?? undefined : undefined}
                  error={exportError}
                  onBack={() => goToExportSubView(exportSource)}
                  onConfirm={() => void handleConfirmSummary()}
                  confirming={confirmingSummary}
                />
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
                    onChange: (value) => { setPatientStatus(value as PatientStatus); setPatientPage(1); setExportPatientPage(1); },
                    extra: (
                      <>
                        <span className="ui-menu__heading">Admission date</span>
                        <input type="date" value={admissionFrom} onChange={(e) => { setAdmissionFrom(e.target.value); setPatientPage(1); setExportPatientPage(1); }} aria-label="Admission date from" />
                        <input type="date" value={admissionTo} onChange={(e) => { setAdmissionTo(e.target.value); setPatientPage(1); setExportPatientPage(1); }} aria-label="Admission date to" />
                      </>
                    ),
                  }}
                  sortProps={{
                    title: 'Sort patients by',
                    options: [
                      { value: 'admissionDate', label: 'Admission date' },
                      { value: 'daysInCare', label: 'Days in care' },
                      { value: 'age', label: 'Age' },
                      { value: 'name', label: 'Patient name' },
                    ],
                    value: patientSortField,
                    onChange: (value) => { setPatientSortField(value as PatientSortField); setPatientPage(1); setExportPatientPage(1); },
                    direction: sortDirection,
                    onDirectionChange: (direction) => { setSortDirection(direction); setPatientPage(1); setExportPatientPage(1); },
                  }}
                />

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ ...styles.table, tableLayout: 'auto' }}>
                    <thead>
                      <tr style={styles.thRow}>
                        <th style={styles.th}>Patient</th>
                        <th style={styles.th}>Sex</th>
                        <th style={styles.th}>Age</th>
                        <th style={styles.th}>Admitted</th>
                        <th style={styles.th}>Days in care</th>
                        <th style={styles.th}>Status</th>
                        <th style={{ ...styles.th, textAlign: 'right' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCf4Patients.map((p) => (
                        <tr key={p.id} style={styles.tr}>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ ...patientTableStyles.dot, backgroundColor: p.color }} />
                              <span style={patientTableStyles.name}>{p.name}</span>
                            </div>
                          </td>
                          <td style={{ ...styles.td, ...patientTableStyles.cell }}>{p.gender}</td>
                          <td style={{ ...styles.td, ...patientTableStyles.cell }}>{p.age ?? '—'}</td>
                          <td style={{ ...styles.td, ...patientTableStyles.cell }}>{p.admissionDate}</td>
                          <td style={{ ...styles.td, ...patientTableStyles.cell }}>
                            {p.daysInCare} {p.daysInCare === 1 ? 'day' : 'days'}
                          </td>
                          <td style={styles.td}>
                            <StatusBadge status={p.status} showDot />
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>
                            <button
                              style={patientTableStyles.viewBtn}
                                onClick={() => handleViewPatient(p)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!visibleCf4Patients.length && (
                        <tr>
                          <td style={{ ...styles.td, ...patientTableStyles.cell }} colSpan={7}>
                            No patients match the current filters.
                          </td>
                        </tr>
                      )}
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
                <SubmittedOrdersTimeline
                  dateValue={activeOrderDate}
                  onDateChange={setSelectedOrderDate}
                  onPrev={() => shiftOrderDate(-1)}
                  onNext={() => shiftOrderDate(1)}
                  prevDisabled={!hasPrevOrderDate}
                  nextDisabled={!hasNextOrderDate}
                  availableDays={orderDates}
                  onClear={() => setSelectedOrderDate('')}
                  clearLabel="Show all"
                  /*
                   * Key on the order's own id. Building the key from the claim
                   * id + `dateCreated` collides whenever two orders of the same
                   * claim share a timestamp (orders written together do), and
                   * duplicate keys leave the previous patient's orders rendered
                   * in the timeline.
                   */
                  orders={stayOrders
                    .filter(
                      (order) =>
                        !activeOrderDate ||
                        toDateKey(order.dateCreated) === activeOrderDate,
                    )
                    .map((order) => ({
                      id: order.id,
                      dateCreated: order.dateCreated,
                      doctor: order.doctor,
                      content: order.content,
                    }))}
                  renderContent={(entry) => {
                    const order = stayOrders.find((item) => item.id === entry.id);
                    // Same read-only execution state the physician's card shows:
                    // status badge, order type and the nurse's note.
                    return (
                      <>
                        <div style={ORDER_TEXT_STYLE}>{entry.content}</div>
                        {order && <OrderStatusSummary order={order} />}
                      </>
                    );
                  }}
                  emptyMessage={
                    previewPatient
                      ? 'No physician orders are available for this stay.'
                      : 'Select a patient to see the orders from their stay.'
                  }
                />
                <AiSummaryCard
                  badgeLabel={
                    stayRequests.some((request) => request.status === 'Pending Review')
                      ? 'Pending Review'
                      : stayRequests[0]?.status
                  }
                  emptyMessage="Select a patient to see the Course in the Ward for their stay."
                >
                  {stayRequests.length > 0 ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      {stayRequests.map((request) => (
                        <div key={request.id}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                            {formatDateMedium(request.summaryDate)} · {request.status}
                          </div>
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {request.summaryText || 'No summary text for this day.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : undefined}
                </AiSummaryCard>
              </div>
            </div>
          )}
    </Layout>
  );
}
