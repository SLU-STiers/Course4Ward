/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { overview } from './styles';

import { sameDay } from './calendar';

export function CalendarWidget() {
  const [cursor, setCursor] = useState(new Date(2026, 5, 1));
  const [selected, setSelected] = useState(new Date(2026, 5, 30));
  const [pickerOpen, setPickerOpen] = useState(false);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const label = cursor.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const monthNames = Array.from({ length: 12 }, (_, index) =>
    new Date(2026, index, 1).toLocaleString("en-US", { month: "short" }),
  );
  const pickerYears = Array.from({ length: 9 }, (_, index) => year - 4 + index);

  const chooseYear = (nextYear: number) => {
    setCursor(new Date(nextYear, month, 1));
  };

  return (
    <section style={overview.widget}>
      <div style={overview.calNav}>
        <button
          type="button"
          style={overview.calMonthButton}
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
        >
          {label} <span aria-hidden>{pickerOpen ? "⌃" : "⌄"}</span>
        </button>
      </div>
      {pickerOpen && (
        <div style={overview.calPicker} aria-label="Choose month and year">
          <div style={overview.calPickerColumn}>
            <div style={overview.calPickerLabel}>Month</div>
            <div style={overview.calPickerOptionsGrid}>
              {monthNames.map((monthName, monthIndex) => (
                <button
                  key={monthName}
                  type="button"
                  style={monthIndex === month ? overview.calPickerOptionActive : overview.calPickerOption}
                  onClick={() => setCursor(new Date(year, monthIndex, 1))}
                >
                  {monthName}
                </button>
              ))}
            </div>
          </div>
          <div style={overview.calPickerColumn}>
            <div style={overview.calPickerLabel}>Year</div>
            <div style={overview.calPickerOptionsGrid}>
              {pickerYears.map((pickerYear) => (
                <button
                  key={pickerYear}
                  type="button"
                  style={pickerYear === year ? overview.calPickerOptionActive : overview.calPickerOption}
                  onClick={() => chooseYear(pickerYear)}
                >
                  {pickerYear}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={overview.calGrid}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`${d}-${i}`} style={overview.calDow}>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const date = day ? new Date(year, month, day) : null;
          return (
            <button
              key={i}
              type="button"
              disabled={!date}
              aria-label={
                date
                  ? date.toLocaleDateString("en-US", { dateStyle: "long" })
                  : undefined
              }
              aria-pressed={Boolean(date && sameDay(date, selected))}
              onClick={() => date && setSelected(date)}
              style={{
                ...overview.calDay,
                ...(date && sameDay(date, selected)
                  ? overview.calDayActive
                  : {}),
                visibility: date ? "visible" : "hidden",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </section>
  );
}
