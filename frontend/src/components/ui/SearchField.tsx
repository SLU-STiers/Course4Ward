import { Search } from 'lucide-react';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Single search input used by every toolbar across all roles.
 * Styling is token-driven via `.ui-search`.
 */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search...',
  ariaLabel = 'Search',
  className,
}: SearchFieldProps) {
  return (
    <label className={['ui-search', className ?? ''].filter(Boolean).join(' ')} aria-label={ariaLabel}>
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
