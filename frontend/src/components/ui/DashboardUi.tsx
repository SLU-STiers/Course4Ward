import type { ReactNode } from 'react';
import { ArrowDownAZ, ArrowUpAZ, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react';

export type SortDirection = 'ascending' | 'descending';

export function SearchField({
  value,
  onChange,
  placeholder = 'Search...',
  ariaLabel = 'Search',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <label className="dashboard-search" aria-label={ariaLabel}>
      <Search size={17} strokeWidth={2} aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </label>
  );
}

export function ControlButton({
  label,
  icon,
  active = false,
  onClick,
  'aria-expanded': ariaExpanded,
}: {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  'aria-expanded'?: boolean;
}) {
  return (
    <button
      type="button"
      className={`dashboard-control-button${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-expanded={ariaExpanded}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function FilterSortMenu({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="dashboard-menu-wrap">
      <ControlButton
        label={label}
        icon={label === 'Sort' ? <ArrowUpAZ size={16} /> : <Filter size={16} />}
        active={open}
        onClick={onToggle}
        aria-expanded={open}
      />
      {open ? <div className="dashboard-menu">{children}</div> : null}
    </div>
  );
}

export function SortDirectionToggle({
  direction,
  onChange,
}: {
  direction: SortDirection;
  onChange: (direction: SortDirection) => void;
}) {
  return (
    <div className="dashboard-direction-toggle" role="group" aria-label="Sort direction">
      <button
        type="button"
        className={direction === 'ascending' ? 'is-active' : ''}
        onClick={() => onChange('ascending')}
      >
        <ArrowUpAZ size={15} /> Ascending
      </button>
      <button
        type="button"
        className={direction === 'descending' ? 'is-active' : ''}
        onClick={() => onChange('descending')}
      >
        <ArrowDownAZ size={15} /> Descending
      </button>
    </div>
  );
}

export function ActionButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  loading = false,
  type = 'button',
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`dashboard-action-button ${variant}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? <Spinner size={15} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ size = 28 }: { size?: number }) {
  return <span className="dashboard-spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="dashboard-loading-state" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  icon = '📄',
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="dashboard-empty-state">
      <span className="dashboard-empty-icon" aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'pending' | 'success' | 'danger' }) {
  return <span className={`dashboard-status-badge ${tone}`}>{children}</span>;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <div className="dashboard-pagination">
      <span>Page {page} of {pageCount}</span>
      <div className="dashboard-pagination-controls">
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} />
        </button>
        <div className="dashboard-page-numbers">
          {pages.map((pageNumber) => (
            <button
              type="button"
              key={pageNumber}
              className={pageNumber === page ? 'is-active' : ''}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
        </div>
        <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function TableFrame({ children }: { children: ReactNode }) {
  return <div className="dashboard-table-frame">{children}</div>;
}
