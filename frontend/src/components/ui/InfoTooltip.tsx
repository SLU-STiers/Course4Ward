import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Info } from 'lucide-react';

const styles: Record<string, CSSProperties> = {
  wrap: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
  /** 28px hit area, muted until hovered or open. No fill, so it sits cleanly on any tinted header. */
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    padding: 0,
    border: 'none',
    borderRadius: 999,
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
  },
  buttonOn: { color: '#7c00b8' },
  /** Fades in under the ⓘ; never blocks the pointer while hidden. */
  tooltip: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    zIndex: 20,
    width: 'min(300px, calc(100vw - 48px))',
    padding: '10px 12px',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    border: '1px solid #ede4fb',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)',
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.5,
    color: '#334155',
    textAlign: 'left',
    whiteSpace: 'normal',
    // visibility flips after the fade, and keeps the hidden text out of screen readers.
    transition: 'opacity 120ms ease, transform 120ms ease, visibility 120ms',
  },
  hidden: { opacity: 0, transform: 'translateY(-4px)', visibility: 'hidden' },
};

/** An ⓘ button that explains something on hover or keyboard focus. */
export function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span style={styles.wrap}>
      <button
        type="button"
        style={{ ...styles.button, ...(open ? styles.buttonOn : null) }}
        aria-label={label}
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Info size={16} aria-hidden="true" />
      </button>
      {/* Always rendered so aria-describedby resolves; hidden until hover or focus. */}
      <span id={id} role="tooltip" style={{ ...styles.tooltip, ...(open ? null : styles.hidden) }}>
        {children}
      </span>
    </span>
  );
}
