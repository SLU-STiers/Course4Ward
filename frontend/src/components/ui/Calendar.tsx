/**
 * Shared month calendar.
 *
 * Used by the physician's order-date dialog, the nurse's date popover and the
 * physician overview widget, so every calendar in the app draws the same cells,
 * markers and hover/selected states (see `.ui-calendar*` in index.css).
 */
import { useState } from 'react';
import { toDateInputValue } from '../../lib/format';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons/NavIcons';

/** The days of a month padded to whole weeks, `null` for the blanks. */
export function monthCells(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: firstDow }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface CalendarPanelProps {
  /** Any date inside the month the panel should open on. */
  focusDate: Date;
  /** `YYYY-MM-DD` days that can be picked. Omit to allow every day of the month. */
  availableDays?: string[];
  onSelect: (date: Date) => void;
  /** Adds a reset action to the footer, e.g. "show every date again". */
  onClear?: () => void;
  clearLabel?: string;
  /** Footer note describing the current selection. */
  caption?: string;
}

export function CalendarPanel({
  focusDate,
  availableDays,
  onSelect,
  onClear,
  clearLabel = 'Show all dates',
  caption,
}: CalendarPanelProps) {
  const [cursor, setCursor] = useState(
    () => new Date(focusDate.getFullYear(), focusDate.getMonth(), 1),
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const label = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const daySet = availableDays ? new Set(availableDays) : null;
  const focusKey = toDateInputValue(focusDate);

  // With a filtered set of days, a month may only be reached when it holds one.
  const monthHasDays = (targetYear: number, targetMonth: number) => {
    if (!availableDays) return true;
    const prefix = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-`;
    return availableDays.some((day) => day.startsWith(prefix));
  };
  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const canGoPrev = monthHasDays(prevMonth.getFullYear(), prevMonth.getMonth());
  const canGoNext = monthHasDays(nextMonth.getFullYear(), nextMonth.getMonth());

  return (
    <div className="ui-calendar">
      <div className="ui-calendar__nav">
        <button
          type="button"
          className="ui-icon-btn"
          disabled={!canGoPrev}
          aria-label="Previous month"
          onClick={() => setCursor(prevMonth)}
        >
          <ChevronLeftIcon width={16} height={16} />
        </button>
        <span className="ui-calendar__month">{label}</span>
        <button
          type="button"
          className="ui-icon-btn"
          disabled={!canGoNext}
          aria-label="Next month"
          onClick={() => setCursor(nextMonth)}
        >
          <ChevronRightIcon width={16} height={16} />
        </button>
      </div>

      <div className="ui-calendar__weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day} className="ui-calendar__weekday">
            {day}
          </span>
        ))}
      </div>

      <div className="ui-calendar__grid">
        {monthCells(year, month).map((day, index) => {
          const date = day ? new Date(year, month, day) : null;
          const dayValue = date ? toDateInputValue(date) : '';
          const selectable = Boolean(date) && (!daySet || daySet.has(dayValue));
          const selected = Boolean(dayValue) && dayValue === focusKey;
          return (
            <button
              key={day ? dayValue : `blank-${index}`}
              type="button"
              disabled={!selectable}
              aria-label={
                date
                  ? `${date.toLocaleDateString('en-US', { dateStyle: 'long' })}${
                      selectable ? '' : ' (nothing recorded)'
                    }`
                  : undefined
              }
              aria-pressed={selected}
              onClick={() => date && selectable && onSelect(date)}
              className={[
                'ui-calendar__day',
                !day ? 'is-empty' : '',
                daySet?.has(dayValue) ? 'has-data' : '',
                selected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>

      {caption || onClear ? (
        <div className="ui-calendar__footer">
          <span className="ui-calendar__caption">{caption}</span>
          {onClear ? (
            <button type="button" className="ui-calendar__clear" onClick={onClear}>
              {clearLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
