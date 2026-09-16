import type { CSSProperties, ReactNode } from 'react';
import { formatDateLongFromKey, formatDateMedium, formatTimeMedium, toDateInputValue, toDateKey } from '../../lib/format';
import { CalendarPanel, Popover } from '../ui';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  NotesIcon,
} from '../icons/NavIcons';

/** `YYYY-MM-DD` read as a local calendar date. */
function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

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
  /** Titles for the ‹ › arrows, e.g. "Previous day with orders". */
  prevLabel?: string;
  nextLabel?: string;
  /**
   * Days the calendar offers. Defaults to the days found in `orders`; pass the
   * full list when the timeline only renders a filtered slice of them.
   */
  availableDays?: string[];
  /** Adds a reset action beside the cluster (and in the calendar footer). */
  onClear?: () => void;
  clearLabel?: string;
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
  /** Monochrome mark of the card title — same line style as the nav icons. */
  titleIcon: {
    display: 'block',
    flexShrink: 0,
    color: 'var(--c4w-color-text-primary, #0f172a)',
  },
  title: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' },
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
  prevLabel = 'Earlier date',
  nextLabel = 'Later date',
  availableDays,
  onClear,
  clearLabel = 'Show all',
  controls,
  orders,
  emptyMessage,
  renderContent,
  footer,
  fill,
}: SubmittedOrdersTimelineProps) {
  /* Only days that actually carry an order can be picked from the calendar. */
  const days =
    availableDays ?? orders.map((order) => toDateKey(order.dateCreated)).filter(Boolean);
  const fieldLabel = dateValue ? formatDateLongFromKey(dateValue) : 'All dates';
  /* Opens on the selected day, else the most recent one that has orders. */
  const latestDay = days.reduce((latest, day) => (day > latest ? day : latest), '');
  const focusDate = dateFromKey(dateValue || latestDay || toDateInputValue(new Date()));

  const nav =
    controls ??
    (dateValue === undefined ? null : (
      <div className="ui-date-nav">
        <button
          type="button"
          className="ui-icon-btn"
          disabled={prevDisabled}
          onClick={onPrev}
          title={prevLabel}
          aria-label={prevLabel}
        >
          <ChevronLeftIcon width={16} height={16} />
        </button>
        <Popover
          align="end"
          trigger={
            <button
              type="button"
              className="ui-date-nav__field"
              aria-label={`${fieldLabel}. Open calendar`}
            >
              <CalendarIcon width={15} height={15} />
              {fieldLabel}
            </button>
          }
        >
          {({ close }) => (
            <CalendarPanel
              focusDate={focusDate}
              availableDays={days}
              onSelect={(date) => {
                onDateChange?.(toDateInputValue(date));
                close();
              }}
              onClear={
                onClear
                  ? () => {
                      onClear();
                      close();
                    }
                  : undefined
              }
              clearLabel={clearLabel}
              caption={
                onClear
                  ? dateValue
                    ? `Selected: ${formatDateLongFromKey(dateValue)}`
                    : 'Showing all order dates'
                  : undefined
              }
            />
          )}
        </Popover>
        <button
          type="button"
          className="ui-icon-btn"
          disabled={nextDisabled}
          onClick={onNext}
          title={nextLabel}
          aria-label={nextLabel}
        >
          <ChevronRightIcon width={16} height={16} />
        </button>
        {onClear && dateValue ? (
          <button type="button" className="ui-date-nav__reset" onClick={onClear}>
            {clearLabel}
          </button>
        ) : null}
      </div>
    ));

  return (
    <section style={fill ? { ...styles.card, ...styles.cardFill } : styles.card}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <NotesIcon width={20} height={20} style={styles.titleIcon} />
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