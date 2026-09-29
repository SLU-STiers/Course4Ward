/** Part of the nurse dashboard — click-to-open 12-hour time picker that stores a 24h `HH:mm` value. */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Clock } from 'lucide-react';
import { Popover } from '../../components/ui/Popover';
import { addPatient as s } from './styles';

type Period = 'AM' | 'PM';
type Parts = { hour: number; minute: number; period: Period };

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (n: number) => String(n).padStart(2, '0');

function toParts(value: string): Parts | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h24 = Number(match[1]);
  return { hour: h24 % 12 || 12, minute: Number(match[2]), period: h24 < 12 ? 'AM' : 'PM' };
}

function toValue({ hour, minute, period }: Parts) {
  const h24 = (hour % 12) + (period === 'PM' ? 12 : 0);
  return `${pad(h24)}:${pad(minute)}`;
}

function nowParts(): Parts {
  const now = new Date();
  return toParts(`${pad(now.getHours())}:${pad(now.getMinutes())}`)!;
}

/** Styled like the triage vital boxes (e.g. Heart Rate); clicking opens the picker. */
export function TimePickerField({
  label = 'Time',
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const parts = toParts(value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Triage is usually recorded as it happens, so an empty field starts at the current time.
        if (next && !parts) onChange(toValue(nowParts()));
        setOpen(next);
      }}
      align="start"
      ariaLabel={`Choose ${label.toLowerCase()}`}
      anchorClassName="ui-popover__anchor--block"
      trigger={
        <button
          type="button"
          style={{
            ...s.vital,
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: 'inherit',
            border: `1px solid ${open ? '#2563eb' : '#e2e8f0'}`,
            boxShadow: open ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
          }}
        >
          <span style={s.vitalLabel}>{label}</span>
          <span style={{ ...s.vitalRow, alignItems: 'center' }}>
            <span style={{ ...s.vitalValue, color: parts ? '#0f172a' : '#94a3b8' }}>
              {parts ? `${parts.hour}:${pad(parts.minute)}` : '—'}
            </span>
            {parts ? (
              <span style={s.vitalUnit}>{parts.period}</span>
            ) : (
              <Clock size={13} color="#94a3b8" aria-hidden="true" />
            )}
          </span>
        </button>
      }
    >
      {({ close }) => (
        <TimePickerPanel
          parts={parts}
          onChange={onChange}
          onDone={close}
        />
      )}
    </Popover>
  );
}

function TimePickerPanel({
  parts,
  onChange,
  onDone,
}: {
  parts: Parts | null;
  onChange: (value: string) => void;
  onDone: () => void;
}) {
  const hourCol = useRef<HTMLDivElement>(null);
  const minuteCol = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<Parts>) => onChange(toValue({ ...(parts ?? nowParts()), ...patch }));

  // Centre the selected hour and minute on open and after "Now"; not on every click.
  const [jump, setJump] = useState(0);
  useEffect(() => {
    for (const col of [hourCol.current, minuteCol.current]) {
      const selected = col?.querySelector<HTMLElement>('[data-selected="true"]');
      if (col && selected) {
        col.scrollTop = selected.offsetTop - col.clientHeight / 2 + selected.offsetHeight / 2;
      }
    }
  }, [jump]);

  return (
    <div style={{ width: 236 }}>
      <div style={styles.preview}>
        <span style={{ color: parts ? '#0f172a' : '#94a3b8' }}>
          {parts ? `${parts.hour}:${pad(parts.minute)}` : '--:--'}
        </span>
        <span style={styles.previewPeriod}>{parts?.period ?? ''}</span>
      </div>

      <div style={styles.columns}>
        <Column label="Hour" refEl={hourCol}>
          {HOURS.map((h) => (
            <Cell key={h} selected={parts?.hour === h} onClick={() => update({ hour: h })}>
              {h}
            </Cell>
          ))}
        </Column>
        <Column label="Min" refEl={minuteCol}>
          {MINUTES.map((m) => (
            <Cell key={m} selected={parts?.minute === m} onClick={() => update({ minute: m })}>
              {pad(m)}
            </Cell>
          ))}
        </Column>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 22 }}>
          {(['AM', 'PM'] as const).map((p) => (
            <Cell key={p} selected={parts?.period === p} onClick={() => update({ period: p })}>
              {p}
            </Cell>
          ))}
        </div>
      </div>

      <div style={styles.footer}>
        <button
          type="button"
          style={styles.linkBtn}
          onClick={() => {
            onChange(toValue(nowParts()));
            setJump((n) => n + 1);
          }}
        >
          Now
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {parts && (
            <button
              type="button"
              style={{ ...styles.linkBtn, color: '#64748b' }}
              onClick={() => {
                onChange('');
                onDone();
              }}
            >
              Clear
            </button>
          )}
          <button type="button" style={styles.doneBtn} onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Column({
  label,
  refEl,
  children,
}: {
  label: string;
  refEl: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={styles.columnLabel}>{label}</div>
      <div ref={refEl} style={styles.column}>
        {children}
      </div>
    </div>
  );
}

function Cell({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-selected={selected}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...styles.cell,
        ...(selected ? styles.cellSelected : hover ? styles.cellHover : null),
      }}
    >
      {children}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  preview: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    padding: '6px 0 12px',
    fontSize: 28,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid #e2e8f0',
    marginBottom: 10,
  },
  previewPeriod: { fontSize: 14, fontWeight: 700, color: '#2563eb', minWidth: 24 },
  columns: { display: 'flex', gap: 8 },
  columnLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  column: {
    position: 'relative',
    height: 180,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingRight: 2,
    scrollbarWidth: 'thin',
  },
  cell: {
    flex: 'none',
    height: 32,
    minWidth: 52,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    fontSize: 14,
    fontWeight: 600,
    color: '#334155',
    cursor: 'pointer',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'inherit',
  },
  cellHover: { background: '#f1f5f9' },
  cellSelected: { background: '#2563eb', color: '#ffffff' },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: '1px solid #e2e8f0',
    marginTop: 10,
    paddingTop: 10,
  },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: '#2563eb',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '6px 8px',
    borderRadius: 8,
    fontFamily: 'inherit',
  },
  doneBtn: {
    border: 'none',
    background: '#2563eb',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '6px 14px',
    borderRadius: 8,
    fontFamily: 'inherit',
  },
};
