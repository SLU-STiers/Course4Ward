import type { ReactNode } from 'react';
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, Filter } from 'lucide-react';
import { Button } from './Button';
import { Popover } from './Popover';
import { SearchField, type SearchFieldProps } from './SearchField';

export type SortDirection = 'ascending' | 'descending';

export interface ToolbarOption {
  value: string;
  label: ReactNode;
}

export interface FilterProps {
  /**
   * Short name of the criterion. Used as the trigger label for a standalone
   * filter, and as the group heading when several filters share one button.
   */
  label?: string;
  /** Heading shown inside the menu. Falls back to {@link label}. */
  title?: ReactNode;
  options: ToolbarOption[];
  value: string;
  onChange: (value: string) => void;
  /** Optional extra content below the options (e.g. date range inputs). */
  extra?: ReactNode;
}

export interface SortProps {
  label?: string;
  title?: ReactNode;
  options: ToolbarOption[];
  value: string;
  onChange: (value: string) => void;
  direction: SortDirection;
  onDirectionChange: (direction: SortDirection) => void;
}

export interface DataTableToolbarProps {
  searchProps?: SearchFieldProps;
  filterProps?: FilterProps;
  /**
   * Several filters collapsed into a single `Filter` button. Each entry becomes
   * a group inside one menu, so every criterion can still be combined at once.
   */
  filters?: FilterProps[];
  /** Active-filter count shown on the combined filter button. */
  activeFilterCount?: number;
  sortProps?: SortProps;
  /** Additional right-aligned controls (buttons, export, etc.). */
  children?: ReactNode;
  className?: string;
}

/**
 * Standardized data-table controls.
 * Search sits on the left; filter/sort (and any extra actions) on the right.
 * Menus render through the shared {@link Popover} portal.
 */
export function DataTableToolbar({
  searchProps,
  filterProps,
  filters,
  activeFilterCount,
  sortProps,
  children,
  className,
}: DataTableToolbarProps) {
  return (
    <div className={['ui-toolbar', className ?? ''].filter(Boolean).join(' ')}>
      {searchProps ? (
        <div className="ui-toolbar__search">
          <SearchField {...searchProps} />
        </div>
      ) : (
        <div className="ui-toolbar__search" />
      )}

      <div className="ui-toolbar__controls">
        {filterProps ? <FilterMenu {...filterProps} /> : null}
        {filters?.length ? (
          <FilterGroupMenu filters={filters} activeCount={activeFilterCount ?? 0} />
        ) : null}
        {sortProps ? <SortMenu {...sortProps} /> : null}
        {children}
      </div>
    </div>
  );
}

function FilterMenu({ label = 'Filter', title, options, value, onChange, extra }: FilterProps) {
  return (
    <Popover
      ariaLabel={label}
      trigger={
        <Button variant="secondary" leadingIcon={<Filter size={15} aria-hidden="true" />} trailingIcon={<ChevronDown size={14} aria-hidden="true" />}>
          {label}
        </Button>
      }
    >
      {({ close }) => (
        <>
          <div className="ui-menu__heading">{title ?? 'Filter'}</div>
          <div className="ui-menu__options" role="group">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={option.value === value}
                className={`ui-menu__option${option.value === value ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          {extra ? <div className="ui-menu__extra">{extra}</div> : null}
        </>
      )}
    </Popover>
  );
}

/**
 * One `Filter` button holding every filter group.
 *
 * Picking an option keeps the menu open so criteria from different groups can
 * be combined in a single visit; the page's own "Clear filters" control (passed
 * as `children`) resets them all.
 */
function FilterGroupMenu({
  filters,
  activeCount = 0,
}: {
  filters: FilterProps[];
  activeCount?: number;
}) {
  return (
    <Popover
      ariaLabel="Filter"
      contentClassName="ui-popover--filters"
      trigger={
        <Button variant="secondary" leadingIcon={<Filter size={15} aria-hidden="true" />} trailingIcon={<ChevronDown size={14} aria-hidden="true" />}>
          {activeCount > 0 ? `Filter (${activeCount})` : 'Filter'}
        </Button>
      }
    >
      {({ close }) => (
        <>
          {filters.map((filter, index) => {
            const heading = filter.title ?? filter.label ?? `Filter ${index + 1}`;
            return (
              <div key={filter.label ?? `filter-${index}`} className="ui-menu__group">
                {index > 0 ? <div className="ui-menu__divider" /> : null}
                <div className="ui-menu__heading">{heading}</div>
                <div
                  className="ui-menu__options"
                  role="group"
                  aria-label={typeof heading === 'string' ? heading : undefined}
                >
                  {filter.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={option.value === filter.value}
                      className={`ui-menu__option${option.value === filter.value ? ' is-active' : ''}`}
                      // Deliberately does not close: filters from other groups
                      // stay reachable so several criteria apply at once.
                      onClick={() => filter.onChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {filter.extra ? <div className="ui-menu__extra">{filter.extra}</div> : null}
              </div>
            );
          })}
          <div className="ui-menu__divider" />
          <div className="ui-menu__options">
            <button type="button" className="ui-menu__option" onClick={close}>
              Done
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}

function SortMenu({
  label = 'Sort',
  title,
  options,
  value,
  onChange,
  direction,
  onDirectionChange,
}: SortProps) {
  return (
    <Popover
      ariaLabel={label}
      trigger={
        <Button variant="secondary" leadingIcon={<ArrowUpAZ size={15} aria-hidden="true" />} trailingIcon={<ChevronDown size={14} aria-hidden="true" />}>
          {label}
        </Button>
      }
    >
      <div className="ui-menu__heading">{title ?? 'Sort by'}</div>
      <div className="ui-menu__options" role="group">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="menuitemradio"
            aria-checked={option.value === value}
            className={`ui-menu__option${option.value === value ? ' is-active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="ui-menu__divider" />
      <div className="ui-menu__direction" role="group" aria-label="Sort direction">
        <button
          type="button"
          className={`ui-menu__option${direction === 'ascending' ? ' is-active' : ''}`}
          onClick={() => onDirectionChange('ascending')}
        >
          <ArrowUpAZ size={15} aria-hidden="true" /> Ascending
        </button>
        <button
          type="button"
          className={`ui-menu__option${direction === 'descending' ? ' is-active' : ''}`}
          onClick={() => onDirectionChange('descending')}
        >
          <ArrowDownAZ size={15} aria-hidden="true" /> Descending
        </button>
      </div>
    </Popover>
  );
}

/**
 * Small popover menu that only exposes a filter choice — useful for custom
 * triggers. Kept separate so non-table menus can reuse the same mechanics.
 */
export function MenuPopover({
  label,
  title,
  children,
  trigger,
}: {
  label?: string;
  title?: ReactNode;
  children: ReactNode | ((args: { close: () => void }) => ReactNode);
  trigger?: ReactNode;
}) {
  return (
    <Popover
      ariaLabel={label}
      trigger={
        trigger ?? (
          <Button variant="secondary" leadingIcon={<Filter size={15} aria-hidden="true" />} trailingIcon={<ChevronDown size={14} aria-hidden="true" />}>
            {label ?? 'Menu'}
          </Button>
        )
      }
    >
      {({ close }) => (
        <>
          {title ? <div className="ui-menu__heading">{title}</div> : null}
          {typeof children === 'function' ? children({ close }) : children}
        </>
      )}
    </Popover>
  );
}
