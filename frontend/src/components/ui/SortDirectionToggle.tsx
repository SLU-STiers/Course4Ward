import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react';

export type SortDirection = 'ascending' | 'descending';

export interface SortDirectionToggleProps {
  direction: SortDirection;
  onChange: (direction: SortDirection) => void;
}

/**
 * Standardized ascending/descending control used inside sort menus.
 * Shares `.ui-menu__option` styling with other menu items.
 */
export function SortDirectionToggle({ direction, onChange }: SortDirectionToggleProps) {
  return (
    <div className="ui-menu__direction" role="group" aria-label="Sort direction">
      <button
        type="button"
        className={`ui-menu__option${direction === 'ascending' ? ' is-active' : ''}`}
        onClick={() => onChange('ascending')}
      >
        <ArrowUpAZ size={15} aria-hidden="true" /> Ascending
      </button>
      <button
        type="button"
        className={`ui-menu__option${direction === 'descending' ? ' is-active' : ''}`}
        onClick={() => onChange('descending')}
      >
        <ArrowDownAZ size={15} aria-hidden="true" /> Descending
      </button>
    </div>
  );
}
