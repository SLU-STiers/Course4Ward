/**
 * The "AI Summarized" card.
 *
 * Copied 1:1 from the physician's Manage panel (📝 header, purple tint, day
 * strip, 13px body, outline action buttons) so the nurse and claims screens show
 * the same card — the numbers live here once and can no longer drift.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { CSSProperties } from 'react';
import llamaIcon from '../../Img/llama.png';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons/NavIcons';

const styles: Record<string, CSSProperties> = {
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  /** Fills the resizable panel it sits in; the body scrolls instead. */
  cardFill: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#f1eaff',
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  llama: { width: '16px', height: '16px', display: 'block', objectFit: 'contain' },
  title: { margin: 0, fontSize: '15px', fontWeight: 800, color: '#7c00b8' },
  badge: {
    backgroundColor: '#d3a0f5',
    color: '#7c00b8',
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 14px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
  },
  /** Nothing has been generated for this day yet. */
  badgeMuted: {
    backgroundColor: '#e2e8f0',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 14px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
  },
  dayBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '4px',
    padding: '2px 10px',
    backgroundColor: '#f7f2ff',
    borderBottom: '1px solid #ede4fb',
    flexShrink: 0,
  },
  day: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 800,
    color: '#6b21a8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dayCount: {
    flexShrink: 0,
    fontSize: '12px',
    fontWeight: 700,
    color: '#475569',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd9e4',
    borderRadius: '999px',
    padding: '1px 8px',
  },
  body: {
    padding: '14px 16px 18px',
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    minHeight: 0,
  },
  text: {
    margin: '0 0 14px',
    fontSize: '13px',
    lineHeight: 1.55,
    color: '#1e293b',
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    paddingRight: '4px',
  },
  empty: {
    margin: '0 0 14px',
    fontSize: '13px',
    lineHeight: 1.55,
    color: '#94a3b8',
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },
  actions: { display: 'flex', gap: '10px', flexShrink: 0 },
};

export interface AiSummaryCardProps {
  /** Badge text, e.g. "AI Draft ready" / "No summary yet". */
  badgeLabel?: string;
  /** Greys the badge — nothing generated for the day on screen. */
  badgeMuted?: boolean;
  /** Day strip: the order day the summary on screen belongs to. */
  dayLabel?: string;
  /** Counter pill beside the day, e.g. "2 of 5". */
  dayPosition?: string;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  prevDayDisabled?: boolean;
  nextDayDisabled?: boolean;
  /** Body text; ignored when `children` are supplied. */
  text?: string | null;
  /** Shown instead of `text` when there is nothing to render. */
  emptyMessage?: string;
  /** Custom body — e.g. the physician's editor. */
  children?: ReactNode;
  /** Footer actions. */
  actions?: ReactNode;
  /** Fill a resizable panel and scroll the body internally. */
  fill?: boolean;
}

export function AiSummaryCard({
  badgeLabel,
  badgeMuted,
  dayLabel,
  dayPosition,
  onPrevDay,
  onNextDay,
  prevDayDisabled,
  nextDayDisabled,
  text,
  emptyMessage,
  children,
  actions,
  fill,
}: AiSummaryCardProps) {
  return (
    <section style={fill ? { ...styles.card, ...styles.cardFill } : styles.card}>
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <img src={llamaIcon} alt="" style={styles.llama} />
          <h3 style={styles.title}>AI Summarized</h3>
        </div>
        {badgeLabel ? (
          <span style={badgeMuted ? styles.badgeMuted : styles.badge}>{badgeLabel}</span>
        ) : null}
      </div>

      {dayLabel !== undefined ? (
        <div style={styles.dayBar}>
          <button
            type="button"
            className="ui-icon-btn"
            disabled={prevDayDisabled}
            title="Previous day's summary"
            aria-label="Previous day's summary"
            onClick={onPrevDay}
          >
            <ChevronLeftIcon width={16} height={16} />
          </button>
          <span style={styles.day}>
            {dayLabel}
            {dayPosition ? <span style={styles.dayCount}>{dayPosition}</span> : null}
          </span>
          <button
            type="button"
            className="ui-icon-btn"
            disabled={nextDayDisabled}
            title="Next day's summary"
            aria-label="Next day's summary"
            onClick={onNextDay}
          >
            <ChevronRightIcon width={16} height={16} />
          </button>
        </div>
      ) : null}

      <div style={styles.body}>
        {children ??
          (text ? (
            <p style={styles.text}>{text}</p>
          ) : (
            <p style={styles.empty}>{emptyMessage}</p>
          ))}
        {actions ? <div style={styles.actions}>{actions}</div> : null}
      </div>
    </section>
  );
}

/** Action button of the AI card (Generate / Regenerate / Submit). */
export function AiActionButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={['ui-ai-btn', className ?? ''].filter(Boolean).join(' ')}
      {...props}
    />
  );
}
