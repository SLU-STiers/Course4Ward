/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useEffect, useMemo, useState } from 'react';
import { Check, History, Pencil, RefreshCw } from 'lucide-react';
import type { CourseInWard, PhysicianOrder, PhysicianRequest } from '../../types';
import { courseInWardApi, ordersApi } from '../../services/domainApi';
import { formatDateLongFromKey, formatDateMedium, toDateKey } from '../../lib/format';
import { apiErrorMessage } from '../../lib/apiError';
import { fullName } from '../../lib/patient';
import { Button, Modal } from '../../components/ui';
import { AiActionButton, AiModelToggle, AiSummaryCard } from '../../components/ai/AiSummaryCard';
import { OrderStatusSummary } from '../../components/orders/OrderStatusSummary';
import { useSummaryModel } from '../../hooks/useSummaryModel';
import { useAuthStore } from '../../store/authStore';
import { manage } from './styles';
import { SummaryHistory } from './SummaryHistory';
import { mergeSummaries, summariesPerDay, summaryDayKey } from './summaries';

const STATUS_LABEL: Record<CourseInWard['status'], string> = {
  DRAFT_AI: 'AI draft',
  DRAFT_EDITED: 'Edited draft',
  APPROVED: 'Approved',
};

/**
 * The orders a request covers, bucketed per calendar day. A request is scoped
 * to the admission(s) its summary was built from; when the summary has no
 * linked orders left, it falls back to the orders of the summary's own day.
 */
function requestOrdersByDay(request: PhysicianRequest, patientOrders: PhysicianOrder[]) {
  const admissionIds = new Set(request.summary.orders.map((order) => order.admissionId));
  const summaryDay = toDateKey(request.summary.summaryDate);
  const scoped = admissionIds.size
    ? patientOrders.filter((order) => admissionIds.has(order.admissionId))
    : patientOrders.filter((order) => toDateKey(order.dateCreated) === summaryDay);

  const byDay = new Map<string, PhysicianOrder[]>();
  for (const order of scoped) {
    const day = toDateKey(order.dateCreated);
    if (!day) continue;
    const bucket = byDay.get(day);
    if (bucket) bucket.push(order);
    else byDay.set(day, [order]);
  }
  for (const bucket of byDay.values()) {
    bucket.sort(
      (a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime(),
    );
  }
  return byDay;
}

export function ReviewSummaryModal({
  request,
  onClose,
  onApprove,
}: {
  request: PhysicianRequest;
  onClose: () => void;
  onApprove: () => Promise<CourseInWard>;
}) {
  const patientId = request.summary.patient.id;
  const requestDay = summaryDayKey(request.summary);

  const [patientOrders, setPatientOrders] = useState<PhysicianOrder[] | null>(null);
  const [summaries, setSummaries] = useState<CourseInWard[]>([request.summary]);
  const [selectedDay, setSelectedDay] = useState(requestDay);
  /** Working copy of a day's summary while it is being edited, keyed by day. */
  const [draft, setDraft] = useState<{ day: string; text: string } | null>(null);
  const [busy, setBusy] = useState<'saving' | 'generating' | 'approving' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenInstructions, setRegenInstructions] = useState('');
  const [showingHistory, setShowingHistory] = useState(false);
  const [summaryModel, setSummaryModel] = useSummaryModel();
  const currentUserId = useAuthStore((state) => state.user?.id);

  // State starts fresh per request: RequestsView keys this modal by request id.
  useEffect(() => {
    let cancelled = false;
    Promise.all([ordersApi.forPatient(patientId), courseInWardApi.forPatient(patientId)])
      .then(([ordersResponse, summariesResponse]) => {
        if (cancelled) return;
        setPatientOrders(ordersResponse.data);
        setSummaries(mergeSummaries(summariesResponse.data, []));
      })
      .catch(() => {
        if (cancelled) return;
        // Still reviewable: fall back to what the request itself carries.
        setPatientOrders(request.summary.orders);
        setError('Could not load every order day for this patient.');
      });
    return () => {
      cancelled = true;
    };
  }, [request, patientId]);

  const ordersByDay = useMemo(
    () => requestOrdersByDay(request, patientOrders ?? request.summary.orders),
    [request, patientOrders],
  );

  const days = useMemo(() => {
    const keys = new Set(ordersByDay.keys());
    keys.add(requestDay);
    return [...keys].sort();
  }, [ordersByDay, requestDay]);

  // The request's own summary always represents its day; every other day shows
  // that day's Course in the Ward.
  const summaryByDay = useMemo(() => {
    const map = summariesPerDay(summaries);
    const own = summaries.find((entry) => entry.id === request.summary.id);
    if (own) map.set(requestDay, own);
    return map;
  }, [summaries, request.summary.id, requestDay]);

  const activeDay = days.includes(selectedDay) ? selectedDay : requestDay;
  const dayOrders = ordersByDay.get(activeDay) ?? [];
  const daySummary = summaryByDay.get(activeDay);
  const editing = draft?.day === activeDay;
  const summaryText = editing ? draft.text : (daySummary?.summaryContent ?? '');
  const canApproveDay = Boolean(
    daySummary &&
      daySummary.status !== 'APPROVED' &&
      !editing &&
      (!daySummary.attendingPhysicianId || daySummary.attendingPhysicianId === currentUserId),
  );
  const hasPrevDay = days.some((day) => day < activeDay);
  const hasNextDay = days.some((day) => day > activeDay);

  useEffect(() => {
    setDraft(null);
    setShowingHistory(false);
  }, [activeDay]);
  const missingDays = days.filter((day) => {
    const summary = summaryByDay.get(day);
    return !summary || !summary.summaryContent.trim();
  });
  const approvalBlocked = busy !== null || editing || missingDays.length > 0;

  const replaceSummary = (updated: CourseInWard[]) =>
    setSummaries((previous) => mergeSummaries(previous, updated));

  const saveEdit = () => {
    if (!daySummary || !draft) return;
    setBusy('saving');
    setError(null);
    void courseInWardApi
      .edit(daySummary.id, draft.text)
      .then(({ data }) => {
        replaceSummary([{ ...daySummary, ...data }]);
        setDraft(null);
      })
      .catch(() => setError('The summary could not be saved.'))
      .finally(() => setBusy(null));
  };

  // Generate a day that has no summary yet, or regenerate the day's summary
  // from every order of that day. The instructions are FORMATTING only: the API
  // rejects any that ask for clinical content the orders do not contain.
  const generateDay = () => {
    setBusy('generating');
    setError(null);
    const call = daySummary
      ? courseInWardApi
          .regenerate(daySummary.id, regenInstructions, summaryModel)
          .then(({ data }) => [{ ...daySummary, ...data }])
      : courseInWardApi
          .generate(patientId, activeDay, summaryModel, regenInstructions)
          .then(({ data }) => data);
    void call
      .then((updated) => {
        replaceSummary(updated);
        setDraft(null);
        setRegenInstructions('');
      })
      .catch((err) =>
        setError(
          apiErrorMessage(err, 'The AI summary could not be generated for this day. Try again or edit it manually.'),
        ),
      )
      .finally(() => setBusy(null));
  };

  const goToDay = (direction: -1 | 1) => {
    const candidates = days.filter((day) => (direction < 0 ? day < activeDay : day > activeDay));
    if (!candidates.length) return;
    setSelectedDay(direction < 0 ? candidates[candidates.length - 1] : candidates[0]);
  };

  // Approving the requested day completes its claim but keeps this stay review
  // open so the physician can continue through the remaining days.
  const approveDay = () => {
    if (!daySummary || !canApproveDay || busy) return;
    if (daySummary.id === request.summary.id) {
      setBusy('approving');
      setError(null);
      void onApprove()
        .then((updated) => replaceSummary([updated]))
        .catch(() => setError('Approval failed. Please try again.'))
        .finally(() => setBusy(null));
      return;
    }
    setBusy('approving');
    setError(null);
    void courseInWardApi
      .approve(daySummary.id)
      .then(({ data }) => replaceSummary([{ ...daySummary, ...data }]))
      .catch(() => setError('Approval failed. Please try again.'))
      .finally(() => setBusy(null));
  };

  // Approving the request signs off every day reviewed here: each other day's
  // summary is approved first, then the request's own summary.
  const approveAll = () => {
    if (approvalBlocked) return;
    setBusy('approving');
    setError(null);
    const others = days
      .filter((day) => day !== requestDay)
      .map((day) => summaryByDay.get(day))
      .filter(
        (entry): entry is CourseInWard =>
          Boolean(entry) && entry!.status !== 'APPROVED' && entry!.id !== request.summary.id,
      );
    void Promise.all(others.map((entry) => courseInWardApi.approve(entry.id)))
      .then(() => onApprove())
      .then(() => onClose())
      .catch(() => setError('Approval failed. Please try again.'))
      .finally(() => setBusy(null));
  };

  const requestedOn = new Date(request.requestedAt).toLocaleString('en-GB');
  const patientName = fullName(request.summary.patient);

  return (
    <>
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="AI Summary Review"
      description={`${patientName} · Requested by ${request.processor.firstName} ${request.processor.lastName} · ${requestedOn}`}
      closeOnBackdrop={busy === null}
      footer={
        <>
          {missingDays.length > 0 && (
            <span style={{ marginRight: 'auto', fontSize: 12, color: '#64748b' }}>
              Some days have no AI summarization yet.
            </span>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy !== null}>
            Close
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={approvalBlocked}
            loading={busy === 'approving'}
            onClick={approveAll}
          >
            Approve request
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#334155' }}>
            Physician orders · {formatDateLongFromKey(activeDay)}
          </h3>
          {dayOrders.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>No orders recorded on this day.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {dayOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    display: 'grid',
                    gap: 6,
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {formatDateMedium(order.dateCreated)}
                    {order.orderedBy
                      ? ` · Dr. ${order.orderedBy.firstName} ${order.orderedBy.lastName}`
                      : ''}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: '#0f172a', whiteSpace: 'pre-wrap' }}>
                    {order.orderContent}
                  </div>
                  <OrderStatusSummary order={order} />
                </div>
              ))}
            </div>
          )}
        </section>

        <AiSummaryCard
          badgeLabel={daySummary ? STATUS_LABEL[daySummary.status] : 'No summary yet'}
          badgeMuted={!daySummary}
          dayLabel={formatDateLongFromKey(activeDay)}
          dayPosition={days.length > 1 ? `${days.indexOf(activeDay) + 1} of ${days.length}` : undefined}
          onPrevDay={() => goToDay(-1)}
          onNextDay={() => goToDay(1)}
          prevDayDisabled={!hasPrevDay || busy !== null}
          nextDayDisabled={!hasNextDay || busy !== null}
          text={summaryText}
          emptyMessage={`No Course in the Ward for ${formatDateLongFromKey(activeDay)} yet.`}
          titleExtra={
            <AiModelToggle
              value={summaryModel}
              onChange={setSummaryModel}
              disabled={busy !== null || editing}
            />
          }
          actions={
            !daySummary ? (
              <>
                {!editing && (
                  <div style={manage.aiRegenRow}>
                    <input
                      type="text"
                      placeholder="Formatting only, e.g. mention the IV fluids first"
                      aria-label="Formatting instructions for Generate (optional)"
                      title="Formatting instructions only: wording, order, grouping, length. The AI never adds orders, medications, doses or results that are not already in the orders."
                      maxLength={1000}
                      value={regenInstructions}
                      disabled={busy !== null}
                      onChange={(e) => setRegenInstructions(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') generateDay();
                      }}
                      style={manage.aiRegenInput}
                    />
                  </div>
                )}
                <AiActionButton disabled={busy !== null || dayOrders.length === 0} aria-busy={busy === 'generating'} onClick={generateDay}>
                  {busy === 'generating' ? <span className="ui-btn__spinner" aria-hidden="true" /> : null}
                  {busy === 'generating' ? 'Generating...' : 'Generate'}
                </AiActionButton>
              </>
            ) : (
              <>
                {!editing && (
                  <div style={manage.aiRegenRow}>
                    <input
                      type="text"
                      placeholder="Formatting only, e.g. mention the IV fluids first"
                      aria-label="Formatting instructions for Regenerate (optional)"
                      title="Formatting instructions only: wording, order, grouping, length. The AI never adds orders, medications, doses or results that are not already in the orders."
                      maxLength={1000}
                      value={regenInstructions}
                      disabled={busy !== null}
                      onChange={(e) => setRegenInstructions(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') generateDay();
                      }}
                      style={manage.aiRegenInput}
                    />
                    <AiActionButton disabled={busy !== null || dayOrders.length === 0} aria-busy={busy === 'generating'} onClick={generateDay}>
                      {busy === 'generating' ? (
                        <span className="ui-btn__spinner" aria-hidden="true" />
                      ) : (
                        <RefreshCw size={14} aria-hidden="true" />
                      )}
                      {busy === 'generating' ? 'Regenerating...' : 'Regenerate'}
                    </AiActionButton>
                  </div>
                )}
                <div style={manage.aiActionRow}>
                  {editing ? (
                    <>
                      <span style={manage.aiActionSpacer} />
                      <AiActionButton disabled={busy !== null} onClick={() => setDraft(null)}>
                        Cancel
                      </AiActionButton>
                      <AiActionButton
                        className="ui-ai-btn--primary"
                        disabled={busy !== null || !summaryText.trim()}
                        aria-busy={busy === 'saving'}
                        onClick={saveEdit}
                      >
                        <Check size={14} aria-hidden="true" />
                        {busy === 'saving' ? 'Saving...' : 'Save Summary'}
                      </AiActionButton>
                    </>
                  ) : (
                    <>
                      <AiActionButton
                        disabled={busy !== null}
                        onClick={() => {
                          setShowingHistory(false);
                          setDraft({ day: activeDay, text: daySummary.summaryContent });
                        }}
                      >
                        <Pencil size={14} aria-hidden="true" />
                        Edit
                      </AiActionButton>
                      <AiActionButton disabled={busy !== null} onClick={() => setShowingHistory(true)}>
                        <History size={14} aria-hidden="true" />
                        Compare Versions
                      </AiActionButton>
                      <span style={manage.aiActionSpacer} />
                      {daySummary.status !== 'APPROVED' &&
                        daySummary.attendingPhysicianId &&
                        daySummary.attendingPhysicianId !== currentUserId && (
                          <span style={manage.approveNote}>Only the attending physician can approve</span>
                        )}
                      {canApproveDay && (
                        <AiActionButton
                          className="ui-ai-btn--primary"
                          disabled={busy !== null}
                          aria-busy={busy === 'approving'}
                          onClick={approveDay}
                        >
                          <Check size={14} aria-hidden="true" />
                          {busy === 'approving' ? 'Approving...' : 'Approve'}
                        </AiActionButton>
                      )}
                    </>
                  )}
                </div>
              </>
            )
          }
        >
          {editing && daySummary ? (
            <textarea
              value={summaryText}
              onChange={(e) => setDraft({ day: activeDay, text: e.target.value })}
              rows={6}
              style={manage.aiEditor}
            />
          ) : null}
        </AiSummaryCard>
        {error && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>
            {error}
          </div>
        )}
      </div>
    </Modal>
    {showingHistory && daySummary ? (
      <SummaryHistory
        summary={daySummary}
        onRestored={(updated) => replaceSummary([updated])}
        onClose={() => setShowingHistory(false)}
      />
    ) : null}
    </>
  );
}
