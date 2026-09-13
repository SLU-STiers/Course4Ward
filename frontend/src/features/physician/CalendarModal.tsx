/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { toDateInputValue } from '../../lib/format';
import { manage } from './styles';

import { monthCells } from './calendar';

export function CalendarModal({
  onClose,
  focusDate,
  orderDays,
  onSelect,
}: {
  onClose: () => void;
  focusDate: Date;
  /** Order dates (`YYYY-MM-DD`) that may be picked; every other day is disabled. */
  orderDays: string[];
  onSelect: (date: Date) => void;
}) {
  const [cursor, setCursor] = useState(
    () => new Date(focusDate.getFullYear(), focusDate.getMonth(), 1),
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = monthCells(year, month);
  const label = cursor.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const orderDaySet = new Set(orderDays);
  const focusKey = toDateInputValue(focusDate);

  // A month may only be navigated to when it actually holds orders.
  const monthHasOrders = (targetYear: number, targetMonth: number) => {
    const prefix = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-`;
    return orderDays.some((day) => day.startsWith(prefix));
  };
  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const canGoPrev = monthHasOrders(
    prevMonth.getFullYear(),
    prevMonth.getMonth(),
  );
  const canGoNext = monthHasOrders(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
  );

  return (
    <div style={manage.calOverlay} onClick={onClose}>
      <div style={manage.calModal} onClick={(e) => e.stopPropagation()}>
        <div style={manage.calHeader}>
          <h3 style={manage.calTitle}>Calendar</h3>
          <button type="button" style={manage.calClose} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={manage.calNav}>
          <button
            type="button"
            style={canGoPrev ? manage.calNavBtn : manage.calNavBtnDisabled}
            disabled={!canGoPrev}
            aria-label="Previous month with orders"
            onClick={() => setCursor(prevMonth)}
          >
            ‹
          </button>
          <span style={manage.calMonth}>{label}</span>
          <button
            type="button"
            style={canGoNext ? manage.calNavBtn : manage.calNavBtnDisabled}
            disabled={!canGoNext}
            aria-label="Next month with orders"
            onClick={() => setCursor(nextMonth)}
          >
            ›
          </button>
        </div>
        <div style={manage.calGrid}>
          {weekdays.map((d) => (
            <div key={d} style={manage.calDow}>
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            const date = day ? new Date(year, month, day) : null;
            const dayValue = date ? toDateInputValue(date) : "";
            const hasOrders = Boolean(dayValue) && orderDaySet.has(dayValue);
            const isSelected = hasOrders && dayValue === focusKey;
            return (
              <button
                key={i}
                type="button"
                disabled={!hasOrders}
                aria-label={
                  date
                    ? `${date.toLocaleDateString("en-US", {
                        dateStyle: "long",
                      })}${hasOrders ? "" : " (no orders)"}`
                    : undefined
                }
                aria-pressed={isSelected}
                onClick={() => date && hasOrders && onSelect(date)}
                style={{
                  ...manage.calDay,
                  ...(hasOrders ? {} : manage.calDayDisabled),
                  ...(isSelected ? manage.calDaySelected : {}),
                  visibility: day ? "visible" : "hidden",
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
