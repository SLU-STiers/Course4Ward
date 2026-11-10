/** Part of the claims dashboard — see index.tsx for the screen shell. */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ClipboardCheck } from 'lucide-react';
import { Layout } from '../../components/layout/Layout';
import { NotificationBell } from '../../components/layout/NotificationBell';
import { SidebarProfile } from '../../components/layout/SidebarProfile';
import { Button, DataTableToolbar, PageHeader, Popover, StatusBadge } from '../../components/ui';
import { patientTableStyles } from '../../components/patientList/PatientTable';
import { DashboardIcon, ExportIcon, RequestsIcon } from '../../components/icons/NavIcons';
import { AiSummaryCard } from '../../components/ai/AiSummaryCard';
import { ORDER_TEXT_STYLE, SubmittedOrdersTimeline } from '../../components/orders/SubmittedOrdersTimeline';
import { OrderStatusSummary } from '../../components/orders/OrderStatusSummary';
import { signOut } from '../../services/signOut';
import { useAuthStore } from '../../store/authStore';
import { claimsApi } from '../../services/domainApi';
import { ORDER_POLL_MS, usePolling } from '../../hooks/usePolling';
import { formatDateLongFromKey, formatDateMedium, toDateKey } from '../../lib/format';
import { styles, overviewStyles } from './styles';

import { buildStayDraft, groupApprovedPatients, groupGeneratedPatients, groupStayPatients, mapClaimToPatient, mapClaimToRequest, stayKey } from './mappers';
import { ReviewRequestModal } from './ReviewRequestModal';
import { EligibleSummariesCard } from './EligibleSummariesCard';
import { Cf4SummaryPreview } from './Cf4SummaryPreview';
import { buildCf4Document, cf4FileName, saveFile } from './cf4Document';
import { apiErrorMessage } from '../../lib/apiError';
import type { CF4Patient, Cf4SummaryDraft, ExportSubView, PatientSortField, PatientStatus, RequestSortField, SortDirection, SummarizationRequest, TabType } from './types';

/** The stay (admission) a request belongs to. */
const requestStay = (request: SummarizationRequest) =>
  stayKey({ admissionId: request.admissionId, patientId: request.patient.patientId });

/** `2026-11-03, 2026-11-05` → `Nov 3, 2026, Nov 5, 2026`. */
const dayList = (days: string[]) =>
  days.map((day) => formatDateMedium(new Date(`${day}T12:00:00`))).join(', ');

/** Why a stay cannot get its CF4 yet, or `''` when every day is covered. */
function stayGaps(patient: CF4Patient): string {
  return [
    patient.missingDays.length ? `No summary: ${dayList(patient.missingDays)}` : '',
    patient.unapprovedDays.length ? `Awaiting physician approval: ${dayList(patient.unapprovedDays)}` : '',
    patient.unrequestedDays.length ? `Not yet requested: ${dayList(patient.unrequestedDays)}` : '',
  ].filter(Boolean).join(' · ');
}

/** The physician dashboard's "N days to approve" chip, read-only here: drafts and days with no summary yet. */
function ApproveChip({ patient }: { patient: CF4Patient }) {
  const days = [
    ...patient.unapprovedDays.map((day) => ({ day, label: 'Awaiting approval' })),
    ...patient.missingDays.map((day) => ({ day, label: 'No summary yet' })),
  ].sort((a, b) => a.day.localeCompare(b.day));
  if (!days.length) return null;
  const label = days.length === 1 ? '1 day to approve' : `${days.length} days to approve`;
  return (
    <span onClick={(event) => event.stopPropagation()}>
      <Popover
        align="start"
        ariaLabel={`${label} by the physician`}
        trigger={
          <button type="button" className="ui-approve-chip">
            <ClipboardCheck size={11} aria-hidden="true" />
            {label}
          </button>
        }
      >
        <div className="ui-menu ui-approve-days">
          <strong className="ui-menu__heading">Awaiting physician approval</strong>
          {days.map(({ day, label: meta }) => (
            <div key={day} className="ui-menu__option ui-approve-days__option">
              {formatDateLongFromKey(day)}
              <span className="ui-approve-days__meta">{meta}</span>
            </div>
          ))}
        </div>
      </Popover>
    </span>
  );
}

/** Sort key for a patient-list column (numbers compare numerically). */
function patientSortValue(patient: CF4Patient, field: PatientSortField): string | number {
  if (field === 'age') return patient.age ?? 0;
  if (field === 'daysInCare') return patient.daysInCare;
  if (field === 'admissionDate') return patient.admissionDateRaw;
  if (field === 'dischargeDate') return patient.dischargeDateRaw ?? '9999-12-31';
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
  const [requestStatus, setRequestStatus] = useState<'all' | SummarizationRequest['status']>('Pending Review');

  // CF4 Export State
  const [cf4Patients, setCf4Patients] = useState<CF4Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientPage, setPatientPage] = useState(1);
  const [exportPatientPage, setExportPatientPage] = useState(1);
  const [patientSortField, setPatientSortField] = useState<PatientSortField>('dischargeDate');
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
  /** Every patient queued for CF4 generation, in the order it was shown. */
  const [summaryDrafts, setSummaryDrafts] = useState<Cf4SummaryDraft[]>([]);
  const [summaryIndex, setSummaryIndex] = useState(0);
  const [exportError, setExportError] = useState('');
  const [confirmingSummary, setConfirmingSummary] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [generatedPage, setGeneratedPage] = useState(1);
  /** Patient whose generated CF4 is being rebuilt for download. */
  const [redownloadingId, setRedownloadingId] = useState<string | null>(null);
  const stayRequests = previewPatient
    ? requests
        .filter((request) => previewPatient.claimIds.includes(request.id))
        .sort((a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime())
    : [];

  const navigate = useNavigate();

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
    setReviewStay(requests.filter((request) => requestStay(request) === requestStay(match)));
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
    const key = requestStay(request);
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

  /* A stay leaves the dashboard once its CF4 is generated; it lives on under Export → Generated CF4. */
  const filteredCf4Patients = groupStayPatients(cf4Patients).filter(
    (p) =>
      !p.cf4Generated &&
      (p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.patientId.includes(patientSearch)),
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
  const dashboardOrderKey = sortedCf4Patients
    .map((patient) => `${patient.id}:${patient.claimIds.join('.')}`)
    .join('|');
  useEffect(() => {
    const first = sortedCf4Patients[0] ?? null;
    setPreviewPatient((current) => {
      if (!first) return null;
      const fresh = current ? sortedCf4Patients.find((patient) => patient.id === current.id) : undefined;
      return fresh ?? first;
    });
  }, [dashboardOrderKey]);
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
  const generatedPatients = groupGeneratedPatients(cf4Patients);
  const sortedGeneratedPatients = generatedPatients
    .filter(
      (patient) =>
        patient.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
        patient.patientId.toLowerCase().includes(patientSearch.toLowerCase()),
    )
    .sort((a, b) => {
      const valueA = patientSortValue(a, patientSortField);
      const valueB = patientSortValue(b, patientSortField);
      const comparison =
        typeof valueA === 'number' && typeof valueB === 'number'
          ? valueA - valueB
          : String(valueA).localeCompare(String(valueB), undefined, { numeric: true });
      return sortDirection === 'ascending' ? comparison : -comparison;
    });
  const generatedPageCount = Math.max(1, Math.ceil(sortedGeneratedPatients.length / patientPageSize));
  const safeGeneratedPage = Math.min(generatedPage, generatedPageCount);
  const generatedStart = (safeGeneratedPage - 1) * patientPageSize;
  const visibleGeneratedPatients = sortedGeneratedPatients.slice(
    generatedStart,
    generatedStart + patientPageSize,
  );
  const generatedPages = Array.from({ length: generatedPageCount }, (_, index) => index + 1);
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
    setGeneratedPage(1);
  };

  const handleRedownload = async (patient: CF4Patient) => {
    setRedownloadingId(patient.id);
    setExportError('');
    try {
      const draft = buildStayDraft(
        patient,
        requests.filter((request) => patient.claimIds.includes(request.id)),
      );
      const { blob } = await buildCf4Document(draft, evaluator);
      saveFile(blob, cf4FileName(draft));
    } catch (cause) {
      setExportError(
        `Could not download the CF4 for ${patient.name}: ${cause instanceof Error ? cause.message : 'please try again'}.`,
      );
    } finally {
      setRedownloadingId(null);
    }
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

  const goToExportSubView = (view: ExportSubView) => {
    setExportError('');
    if (view !== 'selection') setExportNotice('');
    setExportSubView(view);
  };

  /* Each export draft covers one patient and all approved daily summaries. */
  const handleProceedToSummary = () => {
    const queued = sortedExportPatients.filter((candidate) =>
      selectedExportPatientIds.includes(candidate.id),
    );

    if (!queued.length) {
      setExportError('Select at least one approved patient first.');
      return;
    }

    setExportError('');
    setSummaryDrafts(
      queued.map((patient) => buildStayDraft(
        patient,
        requests.filter((request) => patient.claimIds.includes(request.id)),
      )),
    );
    setSummaryIndex(0);
    setExportSubView('summary');
  };

  /* Each patient's PDF is built before any claim is marked, so a document that
     cannot be produced never leaves claims flagged as CF4 generated. */
  /* Taking a patient out of the batch also deselects them in the table. */
  const handleRemoveDraft = (patientId: string) => {
    const remaining = summaryDrafts.filter((draft) => draft.patient.id !== patientId);
    setSelectedExportPatientIds((prev) => prev.filter((id) => id !== patientId));
    setExportError('');
    if (!remaining.length) {
      setSummaryDrafts([]);
      setSummaryIndex(0);
      goToExportSubView('new-cf4');
      return;
    }
    const removedIndex = summaryDrafts.findIndex((draft) => draft.patient.id === patientId);
    setSummaryDrafts(remaining);
    setSummaryIndex((index) =>
      Math.min(index > removedIndex ? index - 1 : index, remaining.length - 1),
    );
  };

  const handleConfirmSummary = async (patientIds: string[]) => {
    const chosenDrafts = summaryDrafts.filter((draft) => patientIds.includes(draft.patient.id));
    if (!chosenDrafts.length || confirmingSummary) return;
    setConfirmingSummary(true);
    setExportError('');
    setExportNotice('');

    const generated: Cf4SummaryDraft[] = [];
    const failures: string[] = [];
    const generatedClaimIds: string[] = [];
    const downloadFailed: string[] = [];

    for (const draft of chosenDrafts) {
      let pdf: Awaited<ReturnType<typeof buildCf4Document>>;
      try {
        pdf = await buildCf4Document(draft, evaluator);
      } catch (cause) {
        failures.push(`${draft.patient.name}: ${cause instanceof Error ? cause.message : 'the PDF could not be built'}`);
        continue;
      }

      let failure = '';
      for (const claimId of draft.patient.claimIds) {
        try {
          await claimsApi.generateCf4(claimId);
          generatedClaimIds.push(claimId);
        } catch (cause) {
          failure = apiErrorMessage(cause, 'the Course in the Ward summary must be physician-approved');
          break;
        }
      }
      if (failure) {
        failures.push(`${draft.patient.name}: ${failure}`);
        continue;
      }

      generated.push(draft);
      try {
        saveFile(pdf.blob, cf4FileName(draft));
      } catch {
        downloadFailed.push(draft.patient.name);
      }
      /* Browsers drop rapid back-to-back downloads. */
      if (chosenDrafts.length > 1) await new Promise((resolve) => window.setTimeout(resolve, 400));
    }

    if (generatedClaimIds.length) {
      setRequests((prev) => prev.map((request) => (
        generatedClaimIds.includes(request.id) ? { ...request, status: 'Approved' } : request
      )));
      setCf4Patients((prev) => prev.map((patient) => (
        generatedClaimIds.includes(patient.claimId) ? { ...patient, cf4Generated: true } : patient
      )));
    }
    setSelectedExportPatientIds((prev) =>
      prev.filter((id) => !generated.some((draft) => draft.patient.id === id)),
    );
    setConfirmingSummary(false);

    const names = generated.map((draft) => draft.patient.name);
    const notice = !generated.length
      ? ''
      : `CF4 generated and downloaded for ${names.length === 1 ? names[0] : `${names.length} patients`}.${
        downloadFailed.length
          ? ` The download did not start for ${downloadFailed.join(', ')}; use Download PDF in the summary to save it again.`
          : ''
      }`;

    /* Failed and unchosen patients stay in the batch for another try. */
    const remaining = summaryDrafts.filter((draft) => !generated.includes(draft));
    if (remaining.length) {
      setSummaryDrafts(remaining);
      setSummaryIndex(0);
      setExportNotice(notice);
      if (failures.length) setExportError(`Could not generate the CF4 for ${failures.join('; ')}.`);
      return;
    }

    setPreviewPatient(null);
    setSummaryDrafts([]);
    setSummaryIndex(0);
    setExportSubView('selection');
    setExportNotice(notice);
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
        profile: (
          <SidebarProfile
            initials={`${user?.firstName?.[0] ?? 'C'}${user?.lastName?.[0] ?? 'P'}`}
            name={user ? `${user.firstName} ${user.lastName}` : 'Claims Processor'}
            subtitle={user?.userId ?? 'Claims Processor account'}
            accountId={user?.userId}
            roleLabel="Claims Processor"
            onLogout={handleLogout}
          />
        ),
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
                              onClick={() => setReviewStay(
                                requests.filter((request) => requestStay(request) === group.id),
                              )}
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
                  {exportNotice && (
                    <p style={styles.exportSuccessBanner} role="status">
                      <span>{exportNotice}</span>
                      <span style={styles.newCf4FooterActions}>
                        <Button size="sm" variant="secondary" onClick={() => goToExportSubView('generated')}>
                          View generated CF4s
                        </Button>
                        <button
                          type="button"
                          className="ui-icon-btn"
                          aria-label="Dismiss"
                          onClick={() => setExportNotice('')}
                        >
                          ×
                        </button>
                      </span>
                    </p>
                  )}
                  <p style={styles.exportInstruction}>
                    Generate a new CF4 from approved Course in the Ward summaries, or download one that was already generated.
                  </p>
                  <div style={styles.exportOptionsGrid}>
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
                        Generate a fresh form from approved ward summaries.
                      </div>
                    </div>

                    <div
                      style={styles.exportOptionCard}
                      onClick={() => goToExportSubView('generated')}
                    >
                      <div style={styles.exportCardHeader}>Generated CF4</div>
                      <div style={styles.exportCardIconArea}>
                        <div style={styles.docIconBox}>
                          <span style={{ fontSize: '32px' }}>📄</span>
                          <span style={{ ...styles.plusIconBadge, ...styles.doneIconBadge }}>
                            <Check size={10} strokeWidth={3} aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                      <div style={styles.exportCardFooter}>
                        Patients whose CF4 is done. Download them again anytime.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBVIEW: GENERATED CF4 */}
              {exportSubView === 'generated' && (
                <div style={styles.exportContainerCard}>
                  <div style={styles.newCf4HeaderRow}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => goToExportSubView('selection')}
                      leadingIcon={<ArrowLeft size={15} aria-hidden="true" />}
                      style={{ justifySelf: 'start' }}
                    >
                      Back
                    </Button>
                    <h3 style={styles.newCf4Title}>Generated CF4</h3>
                    <span />
                  </div>

                  <DataTableToolbar
                    className="ui-toolbar--wrap"
                    searchProps={{
                      value: patientSearch,
                      onChange: setPatientSearchAndResetPage,
                      placeholder: 'Search patient',
                      ariaLabel: 'Search generated patients',
                    }}
                    sortProps={{
                      title: 'Sort patients by',
                      options: [
                        { value: 'dischargeDate', label: 'Discharge date' },
                        { value: 'admissionDate', label: 'Admission date' },
                        { value: 'daysInCare', label: 'Days in care' },
                        { value: 'name', label: 'Patient name' },
                      ],
                      value: patientSortField,
                      onChange: (value) => { setPatientSortField(value as PatientSortField); setGeneratedPage(1); },
                      direction: sortDirection,
                      onDirectionChange: (direction) => { setSortDirection(direction); setGeneratedPage(1); },
                    }}
                  />

                  <div style={styles.patientTableWrapper}>
                    <table style={{ ...styles.table, tableLayout: 'auto' }}>
                      <thead>
                        <tr style={styles.thRow}>
                          <th style={styles.th}>Patient</th>
                          <th style={styles.th}>Admitted</th>
                          <th style={styles.th}>Discharged</th>
                          <th style={styles.th}>Days in care</th>
                          <th style={styles.th}>CF4</th>
                          <th style={{ ...styles.th, textAlign: 'right' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleGeneratedPatients.map((p) => (
                          <tr key={p.id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ ...patientTableStyles.dot, backgroundColor: p.color }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <span style={patientTableStyles.name}>{p.name}</span>
                                  <span style={{ fontSize: 11, color: '#64748b' }}>
                                    {p.gender} · {p.age ?? '—'} yrs · {p.claimIds.length} {p.claimIds.length === 1 ? 'daily summary' : 'daily summaries'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td style={{ ...styles.td, ...patientTableStyles.cell }}>
                              {p.admissionDate}
                            </td>
                            <td style={{ ...styles.td, ...patientTableStyles.cell }}>
                              {p.dischargeDateRaw
                                ? formatDateMedium(new Date(`${p.dischargeDateRaw}T12:00:00`))
                                : '—'}
                            </td>
                            <td style={{ ...styles.td, ...patientTableStyles.cell }}>
                              {p.daysInCare} {p.daysInCare === 1 ? 'day' : 'days'}
                            </td>
                            <td style={styles.td}>
                              <span style={styles.generatedBadge}>CF4 Generated</span>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={redownloadingId === p.id}
                                disabled={Boolean(redownloadingId)}
                                onClick={() => void handleRedownload(p)}
                              >
                                Download PDF
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {!visibleGeneratedPatients.length && (
                          <tr>
                            <td style={{ ...styles.td, ...patientTableStyles.cell }} colSpan={6}>
                              {generatedPatients.length
                                ? 'No generated CF4 matches your search.'
                                : 'No CF4 has been generated yet.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={styles.paginationRow}>
                    <span style={styles.paginationText}>
                      Showing {sortedGeneratedPatients.length ? generatedStart + 1 : 0} to{' '}
                      {Math.min(generatedStart + patientPageSize, sortedGeneratedPatients.length)} of{' '}
                      {sortedGeneratedPatients.length} generated patients
                    </span>
                    <div style={styles.paginationControls}>
                      <button type="button" style={styles.pageArrowBtn} disabled={safeGeneratedPage === 1} onClick={() => setGeneratedPage((page) => Math.max(1, page - 1))}>‹</button>
                      {generatedPages.map((page) => (
                        <button type="button" key={page} style={{ ...styles.pageNumberBtn, ...(page === safeGeneratedPage ? styles.pageActive : {}) }} onClick={() => setGeneratedPage(page)}>{page}</button>
                      ))}
                      <button type="button" style={styles.pageArrowBtn} disabled={safeGeneratedPage === generatedPageCount} onClick={() => setGeneratedPage((page) => Math.min(generatedPageCount, page + 1))}>›</button>
                    </div>
                  </div>

                  {exportError && (
                    <p style={styles.exportErrorBanner} role="alert">
                      {exportError}
                    </p>
                  )}
                </div>
              )}

              {/* SUBVIEW 2: NEW CF4 */}
              {exportSubView === 'new-cf4' && (
                <div style={styles.exportContainerCard}>
                  <div style={styles.newCf4HeaderRow}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => goToExportSubView('selection')}
                      leadingIcon={<ArrowLeft size={15} aria-hidden="true" />}
                      style={{ justifySelf: 'start' }}
                    >
                      Back
                    </Button>
                    <h3 style={styles.newCf4Title}>New CF4 Generation</h3>
                    <span />
                  </div>

                  <DataTableToolbar
                    className="ui-toolbar--wrap"
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
                        { value: 'dischargeDate', label: 'Discharge date' },
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
                          <th style={styles.th}>Discharged</th>
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
                              {p.dischargeDateRaw
                                ? formatDateMedium(new Date(`${p.dischargeDateRaw}T12:00:00`))
                                : '—'}
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
                            <td style={{ ...styles.td, ...patientTableStyles.cell }} colSpan={8}>
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
                        type="button"
                        style={styles.cancelBtn}
                        onClick={() => goToExportSubView('selection')}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        style={styles.proceedBtn}
                        onClick={handleProceedToSummary}
                      >
                        Proceed to Summary
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBVIEW: COURSE IN THE WARD SUMMARY REVIEW */}
              {exportSubView === 'summary' && summaryDrafts.length > 0 && (
                <Cf4SummaryPreview
                  drafts={summaryDrafts}
                  index={summaryIndex}
                  onIndexChange={setSummaryIndex}
                  evaluator={evaluator}
                  error={exportError}
                  notice={exportNotice}
                  onBack={() => goToExportSubView('new-cf4')}
                  onRemove={handleRemoveDraft}
                  onConfirm={(patientIds) => void handleConfirmSummary(patientIds)}
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
                  sortProps={{
                    title: 'Sort patients by',
                    options: [
                      { value: 'dischargeDate', label: 'Discharge date' },
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
                        <tr
                          key={p.id}
                          style={previewPatient?.id === p.id ? { ...styles.tr, ...patientTableStyles.rowSelected } : styles.tr}
                        >
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ ...patientTableStyles.dot, backgroundColor: p.color }} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <span style={patientTableStyles.name}>{p.name}</span>
                                <ApproveChip patient={p} />
                                {p.unrequestedDays.length > 0 && (
                                  <span style={{ fontSize: 11, color: '#64748b' }}>
                                    Not yet requested: {dayList(p.unrequestedDays)}
                                  </span>
                                )}
                              </div>
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
                      {previewPatient && stayGaps(previewPatient) && (
                        <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }} role="status">
                          CF4 is blocked until every day has an approved summary. {stayGaps(previewPatient)}
                        </p>
                      )}
                      {stayRequests.map((request) => (
                        <div key={request.id}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                            {formatDateMedium(request.summaryDate)} · {request.status}
                            <span style={{ marginLeft: 8, color: request.physicianApproved ? '#15803d' : '#b45309' }}>
                              {request.physicianApproved ? '✓ Physician approved' : 'Awaiting physician approval'}
                            </span>
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
