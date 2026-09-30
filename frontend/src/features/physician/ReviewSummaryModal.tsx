/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useEffect, useMemo, useState } from 'react';
import type { CourseInWard, PhysicianOrder, PhysicianRequest } from '../../types';
import { courseInWardApi, ordersApi } from '../../services/domainApi';
import { formatDateLongFromKey, toDateKey } from '../../lib/format';
import llamaIcon from '../../Img/llama.png';
import { review } from './styles';
import { mergeSummaries, summariesPerDay, summaryDayKey } from './summaries';

const STATUS_LABEL: Record<CourseInWard['status'], string> = {
  DRAFT_AI: 'AI Draft',
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
  onApprove: () => Promise<void>;
}) {
  const patientId = request.summary.patient.id;
  const requestDay = summaryDayKey(request.summary);

  const [showOrders, setShowOrders] = useState(true);
  const [patientOrders, setPatientOrders] = useState<PhysicianOrder[] | null>(null);
  const [summaries, setSummaries] = useState<CourseInWard[]>([request.summary]);
  const [selectedDay, setSelectedDay] = useState(requestDay);
  /** Working copy of a day's summary while it is being edited, keyed by day. */
  const [draft, setDraft] = useState<{ day: string; text: string } | null>(null);
  const [busy, setBusy] = useState<'saving' | 'generating' | 'approving' | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const missingDays = days.filter((day) => !summaryByDay.has(day));

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
  // from every order of that day.
  const generateDay = () => {
    setBusy('generating');
    setError(null);
    const call = daySummary
      ? courseInWardApi
          .regenerate(daySummary.id)
          .then(({ data }) => [{ ...daySummary, ...data }])
      : courseInWardApi.generate(patientId, activeDay).then(({ data }) => data);
    void call
      .then((updated) => {
        replaceSummary(updated);
        setDraft(null);
      })
      .catch(() =>
        setError('The AI summary could not be generated for this day. Try again or edit it manually.'),
      )
      .finally(() => setBusy(null));
  };

  // Approving the request signs off every day reviewed here: each other day's
  // summary is approved first, then the request's own summary.
  const approveAll = () => {
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
      .catch(() => setError('Approval failed. Please try again.'))
      .finally(() => setBusy(null));
  };

  return (
    <div style={review.overlay}>
      <div style={review.shell}>
        {showOrders && (
          <aside style={review.ordersPanel}>
            <h3 style={review.ordersTitle}>Physicians Orders:</h3>
            <div style={review.ordersDay}>{formatDateLongFromKey(activeDay)}</div>
            <div style={review.ordersScroll}>
              {dayOrders.length === 0 && (
                <div style={review.ordersEmpty}>No orders recorded on this day.</div>
              )}
              {dayOrders.map((order) => (
                <div key={order.id} style={review.orderCard}>
                  <div style={review.orderTime}>
                    {new Date(order.dateCreated).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div style={review.orderDoctor}>
                    Dr. {order.orderedBy?.firstName} {order.orderedBy?.lastName}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      margin: "6px 0 4px",
                    }}
                  >
                    Orders:
                  </div>
                  <ul style={review.orderList}>
                    <li>{order.orderContent}</li>
                  </ul>
                </div>
              ))}
            </div>
          </aside>
        )}

        {showOrders && (
          <button
            type="button"
            style={review.collapseBtn}
            onClick={() => setShowOrders(false)}
            title="Hide orders"
          >
            ›
          </button>
        )}

        <section style={review.mainPanel}>
          <header style={review.header}>
            <div>
              <h2 style={review.headerTitle}>AI Summary Review</h2>
            </div>
            <button type="button" style={review.headerClose} onClick={onClose}>
              ✕
            </button>
          </header>

          <div style={review.body}>
            <div style={review.infoBanner}>
              <span>ℹ️</span>
              <span>
                The Course in the Ward is summarized per day. Review each day's
                AI summary and let us know if it is accurate, needs changes, or
                is incorrect.
              </span>
            </div>

            <div style={review.sectionLabel}>Patient Information</div>
            <div style={review.patientGrid}>
              <label style={review.field}>
                <span style={review.fieldLabel}>Name</span>
                <input
                  readOnly
                  value={`${request.summary.patient.firstName} ${request.summary.patient.lastName}`}
                  style={review.fieldInput}
                />
              </label>
              <label style={review.field}>
                <span style={review.fieldLabel}>Patient ID</span>
                <input
                  readOnly
                  value={request.summary.patient.id}
                  style={review.fieldInput}
                />
              </label>
              <label style={review.field}>
                <span style={review.fieldLabel}>Days Covered</span>
                <input
                  readOnly
                  value={`${days.length} day${days.length === 1 ? "" : "s"}`}
                  style={review.fieldInput}
                />
              </label>
            </div>

            <div style={review.sectionLabel}>Submitted By</div>
            <div style={review.submittedCard}>
              <div>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>
                  {request.processor.firstName} {request.processor.lastName}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Claims Processor
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  Submitted on
                </div>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}
                >
                  {new Date(request.requestedAt).toLocaleString("en-GB")}
                </div>
              </div>
            </div>

            <div style={review.aiHeader}>
              <div style={review.sectionLabel}>AI Summarization per Day</div>
              <button
                type="button"
                style={review.hideOrdersBtn}
                onClick={() => setShowOrders((v) => !v)}
              >
                {showOrders ? "Hide Orders" : "Show Orders"}
              </button>
            </div>

            <div style={review.dayTabs} role="tablist" aria-label="Order days">
              {days.map((day, index) => {
                const entry = summaryByDay.get(day);
                const active = day === activeDay;
                return (
                  <button
                    key={day}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={busy !== null}
                    style={active ? review.dayTabActive : review.dayTab}
                    onClick={() => setSelectedDay(day)}
                    title={entry ? STATUS_LABEL[entry.status] : "No summary yet"}
                  >
                    <span style={{ fontWeight: 700 }}>Day {index + 1}</span>
                    <span style={{ fontSize: 11 }}>
                      {formatDateLongFromKey(day)}
                    </span>
                    <span
                      style={{
                        ...review.dayTabDot,
                        backgroundColor: !entry
                          ? "#cbd5e1"
                          : entry.status === "APPROVED"
                            ? "#16a34a"
                            : "#f59e0b",
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {editing ? (
              <textarea
                value={draft.text}
                onChange={(e) => setDraft({ day: activeDay, text: e.target.value })}
                rows={7}
                style={review.summaryEditor}
              />
            ) : daySummary ? (
              <div style={review.summaryBox}>
                <div style={review.summaryStatus}>{STATUS_LABEL[daySummary.status]}</div>
                {daySummary.summaryContent}
              </div>
            ) : (
              <div style={review.summaryEmpty}>
                No AI summary has been generated for this day yet.
              </div>
            )}

            {error && <div style={review.errorText}>{error}</div>}

            <div style={review.aiActions}>
              {daySummary && (
                <button
                  type="button"
                  style={review.outlineBtn}
                  disabled={busy !== null}
                  onClick={() => {
                    if (!editing) {
                      setDraft({ day: activeDay, text: daySummary.summaryContent });
                      return;
                    }
                    saveEdit();
                  }}
                >
                  ✎ {busy === "saving" ? "Saving..." : editing ? "Save Summary" : "Edit Summary"}
                </button>
              )}
              {editing && (
                <button
                  type="button"
                  style={review.outlineBtn}
                  disabled={busy !== null}
                  onClick={() => setDraft(null)}
                >
                  Discard
                </button>
              )}
              <button
                type="button"
                style={review.outlineBtn}
                disabled={busy !== null || dayOrders.length === 0}
                onClick={generateDay}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <img src={llamaIcon} alt="" style={{ width: 14, height: 14, display: 'block', objectFit: 'contain' }} />
                  {busy === "generating"
                    ? daySummary ? "Regenerating..." : "Generating..."
                    : daySummary ? "Regenerate" : "Generate"}
                </span>
              </button>
            </div>
          </div>

          <footer style={review.footer}>
            {missingDays.length > 0 && (
              <span style={review.footerHint}>
                {missingDays.length} day{missingDays.length === 1 ? " has" : "s have"} no summary yet
              </span>
            )}
            <button type="button" style={review.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              style={review.approveBtn}
              disabled={busy !== null || editing}
              onClick={approveAll}
            >
              {busy === "approving" ? "Approving..." : "Approve All Days"}
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
