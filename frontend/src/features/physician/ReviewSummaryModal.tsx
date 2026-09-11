/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useEffect, useState } from 'react';
import type { PhysicianRequest } from '../../types';
import llamaIcon from '../../Img/llama.png';
import { review } from './styles';

export function ReviewSummaryModal({
  request,
  onClose,
  onApprove,
}: {
  request: PhysicianRequest;
  onClose: () => void;
  onApprove: () => void;
}) {
  const [showOrders, setShowOrders] = useState(true);
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(request.summary.summaryContent);
  const admissionDate = new Date(
    request.summary.summaryDate,
  ).toLocaleDateString("en-GB");

  useEffect(() => {
    setSummary(request.summary.summaryContent);
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
              {request.summary.orders.map((order) => (
                <div key={order.id} style={review.orderCard}>
                  <div style={review.orderWhen}>
                    {new Date(order.dateCreated).toLocaleDateString("en-GB")}
                  </div>
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
                Please review the AI summary and let us know if it is accurate,
                needs changes, or is incorrect.
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
                <span style={review.fieldLabel}>Admission Date</span>
                <input
                  readOnly
                  value={admissionDate}
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
              <div style={review.sectionLabel}>AI Summarization</div>
              <button
                type="button"
                style={review.hideOrdersBtn}
                onClick={() => setShowOrders((v) => !v)}
              >
                {showOrders ? "Hide Orders" : "Show Orders"}
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
              <button
                type="button"
                style={review.outlineBtn}
                onClick={() => setEditing((v) => !v)}
              >
                ✎ {editing ? "Save Summary" : "Edit Summary"}
              </button>
              <button
                type="button"
                style={review.outlineBtn}
                onClick={() => {
                  setSummary(request.summary.summaryContent);
                  setEditing(false);
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <img src={llamaIcon} alt="" style={{ width: 14, height: 14, display: 'block', objectFit: 'contain' }} />
                  Regenerate
                </span>
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
