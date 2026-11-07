/**
 * A summary's text with the order terms it uses highlighted, plus a panel with
 * the timeline of the orders it was composed from: when, who ordered, who
 * carried it out, and which of its keywords made it into the summary.
 */
import type { CSSProperties } from 'react';
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

export function CompositionPanel({ text, orders }: { text: string; orders: SummarySourceOrder[] }) {
  if (orders.length === 0)
    return <p style={styles.empty}>No finished orders yet, so there is no composition to show.</p>;
  const rows = [...orders]
    .sort((a, b) => (a.dateCreated ?? '').localeCompare(b.dateCreated ?? ''))
    .map((order) => ({ order, terms: termsInSummary(order.orderContent, text) }));
  const reflected = rows.filter((row) => row.terms.length > 0).length;

  return (
    <div style={styles.panel}>
      <div style={styles.head}>
        {orders.length} finished order{orders.length === 1 ? '' : 's'}
        <span style={{ ...styles.pill, ...(reflected === rows.length ? styles.pillAll : styles.pillSome) }}>
          {reflected} of {rows.length} reflected
        </span>
      </div>
      <ol style={styles.timeline} aria-label="Orders this summary was composed from">
        {rows.map(({ order, terms }, index) => {
          const used = terms.length > 0;
          const orderedBy = name(order.orderedBy);
          const doneBy = name(order.executedBy);
          return (
            <li key={order.id} style={styles.item}>
              {index < rows.length - 1 && <span style={styles.rail} aria-hidden="true" />}
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
