import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Unified portal-based modal overlay.
 *
 * Handles the shared behaviors every dialog needs: body scroll lock,
 * Escape-to-close, backdrop click, focus management and stacking order.
 * Content styling (width, padding) is controlled via `size` + tokens.
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Dialog title — also used to label the dialog for assistive tech. */
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action row rendered at the bottom. */
  footer?: ReactNode;
  size?: ModalSize;
  /** Allow closing by clicking the backdrop. Defaults to `true`. */
  closeOnBackdrop?: boolean;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="ui-modal__backdrop"
      onMouseDown={() => {
        if (closeOnBackdrop) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={['ui-modal', `ui-modal--${size}`, className ?? ''].filter(Boolean).join(' ')}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {title || description ? (
          <header className="ui-modal__header">
            <div className="ui-modal__heading">
              {title ? <h2 className="ui-modal__title">{title}</h2> : null}
              {description ? <p className="ui-modal__description">{description}</p> : null}
            </div>
            <button type="button" className="ui-modal__close" aria-label="Close dialog" onClick={onClose}>
              ✕
            </button>
          </header>
        ) : null}
        {children ? <div className="ui-modal__body">{children}</div> : null}
        {footer ? <footer className="ui-modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
