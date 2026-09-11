import type { ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from './Button';
import { Popover } from './Popover';
import { SearchField } from './SearchField';
import { StatusBadge as UnifiedStatusBadge, type StatusValue } from './StatusBadge';
import { SortDirectionToggle as UnifiedSortDirectionToggle, type SortDirection } from './SortDirectionToggle';

/**
 * @deprecated Compatibility shim.
 *
 * This module now delegates to the unified primitives in
 * `src/components/ui` (Button, Popover, SearchField, StatusBadge,
 * SortDirectionToggle). Prefer importing those directly in new code.
 */

export type { SortDirection };
export { SearchField };

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
    <Button
      variant="secondary"
      className={active ? 'is-active' : undefined}
      leadingIcon={icon}
      trailingIcon={<ChevronDown size={14} aria-hidden="true" />}
      onClick={onClick}
      aria-expanded={ariaExpanded}
    >
      {label}
    </Button>
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
    <Popover
      ariaLabel={label}
      open={open}
      onOpenChange={onToggle}
      trigger={
        <Button
          variant="secondary"
          className={open ? 'is-active' : undefined}
          leadingIcon={<Filter size={16} aria-hidden="true" />}
          trailingIcon={<ChevronDown size={14} aria-hidden="true" />}
        >
          {label}
        </Button>
      }
    >
      <div className="ui-menu">{children}</div>
    </Popover>
  );
}

export function SortDirectionToggle({
  direction,
  onChange,
}: {
  direction: SortDirection;
  onChange: (direction: SortDirection) => void;
}) {
  return <UnifiedSortDirectionToggle direction={direction} onChange={onChange} />;
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
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      type={type}
      className={className}
    >
      {children}
    </Button>
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

const TONE_TO_STATUS: Record<'neutral' | 'pending' | 'success' | 'danger', StatusValue> = {
  neutral: 'neutral',
  pending: 'pending',
  success: 'completed',
  danger: 'rejected',
};

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children?: ReactNode;
  tone?: 'neutral' | 'pending' | 'success' | 'danger';
}) {
  return (
    <UnifiedStatusBadge status={TONE_TO_STATUS[tone]} showDot>
      {children}
    </UnifiedStatusBadge>
  );
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
