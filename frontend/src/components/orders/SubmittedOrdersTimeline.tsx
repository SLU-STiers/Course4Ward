import type { CSSProperties, ReactNode } from 'react';
import { formatDateMedium, formatTimeMedium } from '../../lib/format';

export type SubmittedOrderTimelineEntry = {
  id: string;
  dateCreated: string;
  dateLabel?: string;
  timeLabel?: string;
  doctor: string;
  content: string;
};

type SubmittedOrdersTimelineProps = {
  title?: string;
  /** Renders the standard prev / date / next cluster, identical to Claims. */
  dateValue?: string;
  onDateChange?: (value: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** Replaces the standard cluster when a screen needs extra controls. */
  controls?: ReactNode;
  orders: SubmittedOrderTimelineEntry[];
  emptyMessage: string;
  renderContent?: (order: SubmittedOrderTimelineEntry) => ReactNode;
  /** Sits below the timeline, inside the same card. */
  footer?: ReactNode;
  /** Fills a resizable panel and scrolls the timeline internally. */
  fill?: boolean;
};

/*
 * Copied 1:1 from the Claims Processor "Submitted Physician Orders" card —
 * same paddings, timeline offsets, and type scale. Keeping these numbers in one
 * place is what stops the physician and nurse views from drifting larger again.
 */
const styles: Record<string, CSSProperties> = {
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
  },
  cardFill: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexShrink: 0,
  },
  titleGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  icon: { fontSize: '20px' },
  title: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' },
  dateNav: { display: 'flex', alignItems: 'center', gap: '6px' },
  arrowNavBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#64748b',
  },
  dateInput: {
    width: '112px',
    padding: '5px 6px',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    color: '#0f172a',
    fontSize: '10px',
  },
  timelineScroll: {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },
  timelineContainer: { position: 'relative', paddingLeft: '120px' },
  timelineLine: {
    position: 'absolute',
    left: '110px',
    top: 0,
    bottom: 0,
    width: '2px',
    backgroundColor: '#e2e8f0',
  },
  timelineItem: { position: 'relative', marginBottom: '20px' },
  timelineMeta: {
    position: 'absolute',
    left: '-120px',
    width: '100px',
    textAlign: 'right',
    fontSize: '11px',
  },
  timelineDate: { fontWeight: 700, color: '#0f172a' },
  timelineTime: { color: '#64748b' },
  timelineDot: {
    position: 'absolute',
    left: '-14px',
    top: '4px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--c4w-color-primary)',
  },
  orderBox: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #e2e8f0',
  },
  orderDoctor: {
    fontWeight: 700,
    fontSize: '14px',
    color: '#0f172a',
    marginBottom: '6px',
  },
  orderContent: { fontSize: '12px', color: '#334155', lineHeight: '1.4' },
  empty: { padding: '24px', color: '#64748b', fontSize: '13px' },
  footer: { marginTop: '12px', flexShrink: 0 },
};

export function SubmittedOrdersTimeline({
  title = 'Submitted Physician Orders',
  dateValue,
  onDateChange,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  controls,
  orders,
  emptyMessage,
  renderContent,
  footer,
  fill,
}: SubmittedOrdersTimelineProps) {
  const nav =
    controls ??
    (dateValue === undefined ? null : (
      <div style={styles.dateNav}>
        <button
          type="button"
          style={styles.arrowNavBtn}
          disabled={prevDisabled}
          onClick={onPrev}
          title="Older date"
        >
          ‹
        </button>
        <input
          type="date"
          value={dateValue}
          onChange={(event) => onDateChange?.(event.target.value)}
          style={styles.dateInput}
          aria-label="Order date"
        />
        <button
          type="button"
          style={styles.arrowNavBtn}
          disabled={nextDisabled}
          onClick={onNext}
          title="Newer date"
        >
          ›
        </button>
      </div>
    ));

  return (
    <section style={fill ? { ...styles.card, ...styles.cardFill } : styles.card}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <span style={styles.icon}>📝</span>
          <h3 style={styles.title}>{title}</h3>
        </div>
        {nav}
      </div>

      <div style={fill ? styles.timelineScroll : undefined}>
        <div style={styles.timelineContainer}>
          <div style={styles.timelineLine} />
          {orders.length ? (
            orders.map((order) => (
              <div style={styles.timelineItem} key={order.id}>
                <div style={styles.timelineMeta}>
                  <div style={styles.timelineDate}>
                    {order.dateLabel ?? formatDateMedium(order.dateCreated)}
                  </div>
                  <div style={styles.timelineTime}>
                    {order.timeLabel ?? formatTimeMedium(order.dateCreated)}
                  </div>
                </div>
                <div style={styles.timelineDot} />
                <div style={styles.orderBox}>
                  <div style={styles.orderDoctor}>{order.doctor}</div>
                  {renderContent ? (
                    renderContent(order)
                  ) : (
                    <div style={styles.orderContent}>{order.content}</div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={styles.empty}>{emptyMessage}</div>
          )}
        </div>
      </div>

      {footer ? <div style={styles.footer}>{footer}</div> : null}
    </section>
  );
}