import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Unified button.
 *
 * Single control used by every role/view so hover, active, focus and
 * disabled states are identical everywhere.
 *
 * All interaction styling lives in `.ui-btn*` (index.css) and is driven by
 * the shared design tokens.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Visual emphasis. Defaults to `secondary`. */
  variant?: ButtonVariant;
  /** Control height/padding. Defaults to `md`. */
  size?: ButtonSize;
  /** Show an inline spinner and block interaction. */
  loading?: boolean;
  /** Stretch to the full width of the container. */
  block?: boolean;
  /** Square icon-only button (requires an `aria-label`). */
  iconOnly?: boolean;
  /** Rendered before the label. */
  leadingIcon?: ReactNode;
  /** Rendered after the label. */
  trailingIcon?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'ui-btn--primary',
  secondary: 'ui-btn--secondary',
  ghost: 'ui-btn--ghost',
  danger: 'ui-btn--danger',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  block = false,
  iconOnly = false,
  leadingIcon,
  trailingIcon,
  type = 'button',
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'ui-btn',
    VARIANT_CLASS[variant],
    `ui-btn--${size}`,
    block ? 'ui-btn--block' : '',
    iconOnly ? 'ui-btn--icon' : '',
    loading ? 'is-loading' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="ui-btn__spinner" aria-hidden="true" /> : leadingIcon}
      {children ? <span className="ui-btn__label">{children}</span> : null}
      {trailingIcon ? <span className="ui-btn__trailing">{trailingIcon}</span> : null}
    </button>
  );
}
