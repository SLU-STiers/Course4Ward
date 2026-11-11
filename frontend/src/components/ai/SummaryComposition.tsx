/**
 * A summary's text with the order terms it uses highlighted, plus a panel with
 * the timeline of the orders it was composed from: when, who ordered, who
 * carried it out, and which of its keywords made it into the summary.
 */
import { useState, type CSSProperties } from 'react';
import { formatDateMedium, formatTimeMedium } from '../../lib/format';
import { orderTypeLabel } from '../orders/orderType';
import { splitOnTerms, termsInSummary, type SummarySourceOrder } from './summaryKeywords';

const TEAL = '#0f766e';
const AMBER = '#d97706';

const styles: Record<string, CSSProperties> = {
  // Teal, so it never reads as the yellow "changed" mark of Compare versions.
  mark: { backgroundColor: '#ccfbf1', color: 'inherit', borderRadius: '3px', padding: '0 2px' },
  panel: { fontSize: '12px', color: '#334155' },
  head: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontWeight: 700, color: '#6b21a8' },
  empty: { margin: 0, fontSize: '12px', color: '#94a3b8' },
  pill: {
    fontSize: '10px',
    fontWeight: 800,
    padding: '1px 8px',
    borderRadius: '999px',
    whiteSpace: 'nowrap',
  },
  pillAll: { backgroundColor: '#ccfbf1', color: '#115e59' },
  pillSome: { backgroundColor: '#fef3c7', color: '#92400e' },
  timeline: { listStyle: 'none', margin: '10px 0 0', padding: 0 },
  item: { position: 'relative', paddingLeft: '18px', paddingBottom: '12px' },
  /** The rail between two dots; the last item has none. */
  rail: { position: 'absolute', left: '4px', top: '12px', bottom: 0, width: '2px', backgroundColor: '#e9e3f5' },
  dot: {
    position: 'absolute',
    left: 0,
    top: '3px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
  },
  when: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#475569' },
  typeTag: {
    fontSize: '9px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#6d28d9',
    backgroundColor: '#ede9fe',
    borderRadius: '999px',
    padding: '1px 6px',
  },
  card: {
    marginTop: '4px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    padding: '8px 10px',
  },
  content: { fontSize: '12.5px', lineHeight: 1.45, color: '#0f172a', overflowWrap: 'anywhere' },
  people: { marginTop: '6px', display: 'grid', gap: '2px', fontSize: '11px', color: '#64748b' },
  person: { fontWeight: 700, color: '#334155' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' },
  chip: {
    backgroundColor: '#ccfbf1',
    color: '#115e59',
    border: '1px solid #99f6e4',
    borderRadius: '999px',
    padding: '0 8px',
    fontSize: '11px',
    fontWeight: 700,
  },
  missing: { marginTop: '6px', fontSize: '11px', fontWeight: 600, color: '#92400e' },
  filterRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginTop: '8px' },
  filterLabel: { fontSize: '11px', fontWeight: 700, color: '#64748b', marginRight: '2px' },
  filterChip: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '999px',
    border: '1px solid #ddd6fe',
    backgroundColor: '#ffffff',
    color: '#5b21b6',
    cursor: 'pointer',
  },
  filterChipActive: { backgroundColor: '#6d28d9', borderColor: '#6d28d9', color: '#ffffff' },
  filterCount: { opacity: 0.75, fontWeight: 600 },
};

const name = (person?: { firstName: string; lastName: string } | null) =>
  person ? `${person.firstName} ${person.lastName}` : null;

export function HighlightedSummary({ text, orders }: { text: string; orders: SummarySourceOrder[] }) {
  return (
    <>
      {splitOnTerms(text, orders).map((piece, i) =>
        i % 2 ? (
          <mark key={i} style={styles.mark}>
            {piece}
          </mark>
        ) : (
          piece
        ),
      )}
    </>
  );
}

/** Filter value for orders with no ordering doctor recorded. */
const UNKNOWN_DOCTOR = '__unknown__';

export function CompositionPanel({ text, orders }: { text: string; orders: SummarySourceOrder[] }) {
  // The panel stays mounted while the physician switches versions, so the
  // chosen doctor carries over to every version.
  const [doctor, setDoctor] = useState<string | null>(null);

  const doctorCounts = new Map<string, number>();
  for (const order of orders) {
    const key = name(order.orderedBy) ?? UNKNOWN_DOCTOR;
    doctorCounts.set(key, (doctorCounts.get(key) ?? 0) + 1);
  }
  const doctors = [...doctorCounts.keys()].sort((a, b) =>
    a === UNKNOWN_DOCTOR ? 1 : b === UNKNOWN_DOCTOR ? -1 : a.localeCompare(b),
  );
  // A doctor who no longer has orders here (list reloaded) falls back to "All".
  const activeDoctor = doctor && doctorCounts.has(doctor) ? doctor : null;

  if (orders.length === 0)
    return <p style={styles.empty}>No accomplished orders yet, so there is no composition to show.</p>;
  const rows = [...orders]
    .sort((a, b) => (a.dateCreated ?? '').localeCompare(b.dateCreated ?? ''))
    .map((order) => ({ order, terms: termsInSummary(order.orderContent, text) }));
  const reflected = rows.filter((row) => row.terms.length > 0).length;
  const shown = activeDoctor
    ? rows.filter(({ order }) => (name(order.orderedBy) ?? UNKNOWN_DOCTOR) === activeDoctor)
    : rows;

  const filterChip = (key: string | null, label: string, count: number) => {
    const active = activeDoctor === key;
    return (
      <button
        key={key ?? 'all'}
        type="button"
        aria-pressed={active}
        onClick={() => setDoctor(key)}
        style={{ ...styles.filterChip, ...(active ? styles.filterChipActive : {}) }}
      >
        {label} <span style={styles.filterCount}>{count}</span>
      </button>
    );
  };

  return (
    <div style={styles.panel}>
      <div style={styles.head}>
        {orders.length} accomplished order{orders.length === 1 ? '' : 's'}
        <span style={{ ...styles.pill, ...(reflected === rows.length ? styles.pillAll : styles.pillSome) }}>
          {reflected} of {rows.length} reflected
        </span>
      </div>
      <div style={styles.filterRow} role="group" aria-label="Filter orders by ordering doctor">
        <span style={styles.filterLabel}>Ordered by:</span>
        {filterChip(null, 'All doctors', orders.length)}
        {doctors.map((key) =>
          filterChip(key, key === UNKNOWN_DOCTOR ? 'Unknown' : `Dr. ${key}`, doctorCounts.get(key) ?? 0),
        )}
      </div>
      <ol style={styles.timeline} aria-label="Orders this summary was composed from">
        {shown.map(({ order, terms }, index) => {
          const used = terms.length > 0;
          const orderedBy = name(order.orderedBy);
          const doneBy = name(order.executedBy);
          return (
            <li key={order.id} style={styles.item}>
              {index < shown.length - 1 && <span style={styles.rail} aria-hidden="true" />}
              <span
                style={{ ...styles.dot, border: `2px solid ${used ? TEAL : AMBER}` }}
                aria-hidden="true"
              />
              <div style={styles.when}>
                {order.dateCreated && (
                  <span>
                    {formatTimeMedium(order.dateCreated)} · {formatDateMedium(order.dateCreated)}
                  </span>
                )}
                {order.type && order.type !== 'DEFAULT' && (
                  <span style={styles.typeTag}>{orderTypeLabel(order.type)}</span>
                )}
              </div>
              <div style={styles.card}>
                <div style={styles.content}>{order.orderContent}</div>
                {(orderedBy || doneBy) && (
                  <div style={styles.people}>
                    {orderedBy && (
                      <span>
                        Ordered by <span style={styles.person}>Dr. {orderedBy}</span>
                      </span>
                    )}
                    {doneBy && (
                      <span>
                        Carried out by <span style={styles.person}>{doneBy}</span>
                        {order.executedAt ? ` · ${formatTimeMedium(order.executedAt)}` : ''}
                      </span>
                    )}
                  </div>
                )}
                {used ? (
                  <div style={styles.chips} aria-label="Keywords used in the summary">
                    {terms.map((term) => (
                      <span key={term} style={styles.chip}>
                        {term}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={styles.missing}>⚠ Not reflected in this summary</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
