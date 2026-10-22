/**
 * A summary's text with the order terms it uses highlighted, plus a timeline of
 * the orders it was composed from: when, who ordered, who carried it out, and
 * which of its keywords made it into the summary.
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
  details: { marginTop: '4px', fontSize: '12px', color: '#334155' },
  /** Reads as a button: bordered bar, chevron, pointer, hover tint. */
  summary: {
    cursor: 'pointer',
    userSelect: 'none',
    listStyle: 'none', // hides the native ▸ marker; ours rotates instead
    // Chevron pinned left on the first line; only the label beside it wraps.
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '7px 10px',
    lineHeight: '18px',
    border: '1px solid #d8c4f5',
    borderRadius: '8px',
    backgroundColor: '#faf5ff',
    fontWeight: 700,
    color: '#6b21a8',
    transition: 'background-color 120ms, border-color 120ms',
  },
  summaryActive: { backgroundColor: '#f1eaff', borderColor: '#a855f7' },
  chevron: { display: 'inline-block', flexShrink: 0, fontSize: '12px', transition: 'transform 150ms' },
  summaryLabel: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '2px 6px',
    flex: '1 1 0',
    minWidth: 0,
  },
  summaryHint: { fontSize: '11px', fontWeight: 600, color: '#7e6a99' },
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

export function SummaryComposition({
  text,
  orders,
  onToggle,
}: {
  text: string;
  orders: SummarySourceOrder[];
  /** Told when the composition is opened or closed, e.g. to highlight the text alongside. */
  onToggle?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  if (orders.length === 0) return null;
  const rows = [...orders]
    .sort((a, b) => (a.dateCreated ?? '').localeCompare(b.dateCreated ?? ''))
    .map((order) => ({ order, terms: termsInSummary(order.orderContent, text) }));
  const reflected = rows.filter((row) => row.terms.length > 0).length;

  return (
    <details
      style={styles.details}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
        onToggle?.(e.currentTarget.open);
      }}
    >
      <summary
        style={{ ...styles.summary, ...(hover || open ? styles.summaryActive : {}) }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <span style={{ ...styles.chevron, transform: open ? 'rotate(90deg)' : 'none' }} aria-hidden="true">
          ▸
        </span>
        <span style={styles.summaryLabel}>
          {open ? 'Hide composition' : 'Show composition'}
          <span style={styles.summaryHint}>
            {orders.length} finished order{orders.length === 1 ? '' : 's'}
          </span>
          <span style={{ ...styles.pill, ...(reflected === rows.length ? styles.pillAll : styles.pillSome) }}>
            {reflected} of {rows.length} reflected
          </span>
        </span>
      </summary>
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
    </details>
  );
}
