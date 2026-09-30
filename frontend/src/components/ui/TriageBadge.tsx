import { triageLevelInfo } from '../../lib/triage';

export interface TriageBadgeProps {
  /** Triage level 1-5; anything else renders as "Not triaged". */
  level: number | null | undefined;
  /** Show only "L1" instead of "L1 · Resuscitation" (full name stays in the tooltip). */
  compact?: boolean;
}

/** Colour-coded 5-level triage priority, in the shared `.ui-badge` shape. */
export function TriageBadge({ level, compact = false }: TriageBadgeProps) {
  const info = triageLevelInfo(level);
  if (!info) {
    return (
      <span className="ui-badge ui-badge--neutral" title="No triage level recorded">
        <span className="ui-badge__label">Not triaged</span>
      </span>
    );
  }
  return (
    <span
      className="ui-badge"
      style={{ background: info.background, color: info.color, borderColor: info.color + '33' }}
      title={`Level ${info.level} · ${info.name} (${info.tag}) — ${info.target}`}
    >
      <span className="ui-badge__dot" aria-hidden="true" />
      <span className="ui-badge__label">
        L{info.level}
        {compact ? '' : ` · ${info.name}`}
      </span>
    </span>
  );
}
