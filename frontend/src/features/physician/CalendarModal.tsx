/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { formatDateLongFromKey, toDateInputValue } from '../../lib/format';
import { CalendarPanel } from '../../components/ui';
import { manage } from './styles';

export function CalendarModal({
  onClose,
  focusDate,
  orderDays,
  onSelect,
  onClear,
}: {
  onClose: () => void;
  focusDate: Date;
  /** Order dates (`YYYY-MM-DD`) that may be picked; every other day is disabled. */
  orderDays: string[];
  onSelect: (date: Date) => void;
  onClear: () => void;
}) {
  const focusKey = toDateInputValue(focusDate);

  return (
    <div style={manage.calOverlay} onClick={onClose}>
      <div style={manage.calModal} onClick={(e) => e.stopPropagation()}>
        <div style={manage.calHeader}>
          <div>
            <h3 style={manage.calTitle}>Select order date</h3>
            <p style={manage.calSubtitle}>Filter the order list by a day</p>
          </div>
          <button
            type="button"
            className="ui-icon-btn"
            aria-label="Close calendar"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <CalendarPanel
          focusDate={focusDate}
          availableDays={orderDays}
          onSelect={onSelect}
          onClear={onClear}
          clearLabel="Show all dates"
          caption={
            focusKey && orderDays.includes(focusKey)
              ? `Selected: ${formatDateLongFromKey(focusKey)}`
              : 'Showing all order dates'
          }
        />
      </div>
    </div>
  );
}
