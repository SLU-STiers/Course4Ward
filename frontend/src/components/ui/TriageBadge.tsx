import { triageLevelInfo } from '../../lib/triage';

export interface TriageBadgeProps {
  /** Triage level 1-5; anything else renders as "Not triaged". */
  level: number | null | undefined;
  /** Show only "ESI 1" instead of "ESI 1 · Resuscitation" (full name stays in the tooltip). */
  compact?: boolean;
}

/** Colour-coded 5-level triage priority, in the shared `.ui-badge` shape. */
export function TriageBadge({ level, compact = false }: TriageBadgeProps) {
  const info = triageLevelInfo(level);
  if (!info) {
    return (
      <span className="ui-badge ui-badge--neutral" title="No ESI level recorded">
        <span className="ui-badge__label">Not triaged</span>
      </span>
    );
  }
  return (
    <span
      className="ui-badge"
      style={{ background: info.background, color: info.color, borderColor: info.color + '33' }}
      title={`ESI ${info.level} · ${info.name} (${info.tag}) — ${info.target}`}
    >
      <span className="ui-badge__dot" aria-hidden="true" />
      <span className="ui-badge__label">
        ESI {info.level}
        {compact ? '' : ` · ${info.name}`}
      </span>
    </span>
  );
}
