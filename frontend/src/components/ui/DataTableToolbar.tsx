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
  /** Accessible label for the trigger. Defaults to `Filter`. */
  label?: string;
  /** Heading shown inside the menu. */
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
