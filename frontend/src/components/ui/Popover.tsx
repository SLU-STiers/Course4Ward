import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Unified portal-based popover.
 *
 * Every dropdown/filter/sort menu in the app renders through this so the
 * micro-interactions (open/close, outside-click, Escape, repositioning on
 * scroll/resize, stacking order) are identical across all pages.
 *
 * The `trigger` node should be a plain control (e.g. `<Button>`); this
 * component owns toggling, so the trigger must not manage `onClick` itself.
 */
export interface PopoverRenderArgs {
  close: () => void;
}

export interface PopoverProps {
  /** Controlled open state. Omit for uncontrolled usage. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The anchor control rendered in normal document flow. */
  trigger: ReactNode;
  /** Portal content, or a render function receiving `{ close }`. */
  children: ReactNode | ((args: PopoverRenderArgs) => ReactNode);
  align?: 'start' | 'end';
  /** Accessible label for the anchor. */
  ariaLabel?: string;
  anchorClassName?: string;
  contentClassName?: string;
}

interface Position {
  top: number;
  left: number;
}

const GAP = 8;
const VIEWPORT_MARGIN = 8;

export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = 'end',
  ariaLabel,
  anchorClassName,
  contentClassName,
}: PopoverProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const close = useCallback(() => setOpen(false), [setOpen]);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const width = contentRef.current?.offsetWidth ?? 224;
    const height = contentRef.current?.offsetHeight ?? 0;

    let left = align === 'end' ? rect.right - width : rect.left;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN));

    let top = rect.bottom + GAP;
    if (height && top + height > window.innerHeight - VIEWPORT_MARGIN) {
      top = Math.max(VIEWPORT_MARGIN, rect.top - GAP - height);
    }

    setPosition({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (isOpen) reposition();
  }, [isOpen, reposition]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (contentRef.current?.contains(target)) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen, close, reposition]);

  return (
    <>
      <div
        ref={anchorRef}
        className={['ui-popover__anchor', anchorClassName ?? ''].filter(Boolean).join(' ')}
        onClick={() => setOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        {trigger}
      </div>
      {isOpen
        ? createPortal(
            <div
              ref={contentRef}
              role="menu"
              className={['ui-popover', contentClassName ?? ''].filter(Boolean).join(' ')}
              style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? 'visible' : 'hidden',
              }}
            >
              {typeof children === 'function' ? children({ close }) : children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
