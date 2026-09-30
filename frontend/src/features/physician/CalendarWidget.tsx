/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { overview } from './styles';

import { monthCells, sameDay } from './calendar';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '../../components/icons/NavIcons';

export function CalendarWidget() {
  const [cursor, setCursor] = useState(new Date(2026, 5, 1));
  const [selected, setSelected] = useState(new Date(2026, 5, 30));
  const [pickerOpen, setPickerOpen] = useState(false);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = monthCells(year, month);
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
      <div className="ui-calendar">
        <div className="ui-calendar__nav">
          <button
            type="button"
            className="ui-icon-btn"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeftIcon width={16} height={16} />
          </button>
          <button
            type="button"
            className="ui-calendar__month"
            onClick={() => setPickerOpen((open) => !open)}
            aria-expanded={pickerOpen}
            aria-label="Choose month and year"
          >
            {label}
            <ChevronDownIcon width={14} height={14} />
          </button>
          <button
            type="button"
            className="ui-icon-btn"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRightIcon width={16} height={16} />
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
        <div className="ui-calendar__weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <span key={d} className="ui-calendar__weekday">
              {d}
            </span>
          ))}
        </div>
        <div className="ui-calendar__grid">
          {cells.map((day, i) => {
            const date = day ? new Date(year, month, day) : null;
            const selectedDay = Boolean(date && sameDay(date, selected));
            return (
              <button
                key={date ? date.toISOString() : `blank-${i}`}
                type="button"
                disabled={!date}
                aria-label={
                  date
                    ? date.toLocaleDateString("en-US", { dateStyle: "long" })
                    : undefined
                }
                aria-pressed={selectedDay}
                onClick={() => date && setSelected(date)}
                className={[
                  "ui-calendar__day",
                  !day ? "is-empty" : "",
                  selectedDay ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
