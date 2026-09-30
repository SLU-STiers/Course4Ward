/**
 * The 5-level triage system: how soon a patient must be seen. Level 1 is the
 * most urgent. The nurse picks the level at registration; nurse and physician
 * patient lists show it so the most urgent patients are seen first.
 */

import type { TriageLevel } from '../types';

/**
 * Triage colour tags: Red = critical / life-threatening, needs immediate
 * attention; Yellow = serious, needs prompt care; Green = minor,
 * non-life-threatening, can wait.
 */
export type TriageTag = 'Red' | 'Yellow' | 'Green';

const TAG_COLORS: Record<TriageTag, { color: string; background: string }> = {
  Red: { color: '#b91c1c', background: '#fee2e2' },
  Yellow: { color: '#a16207', background: '#fef9c3' },
  Green: { color: '#15803d', background: '#dcfce7' },
};

export type TriageLevelInfo = {
  level: TriageLevel;
  name: string;
  /** Colour tag of the level: L1-2 Red, L3 Yellow, L4-5 Green. */
  tag: TriageTag;
  /** How soon the patient should be assessed. */
  target: string;
  description: string;
  examples: string;
  /** Badge text / border colour. */
  color: string;
  /** Badge fill. */
  background: string;
};

export const TRIAGE_LEVELS: TriageLevelInfo[] = [
  {
    level: 1,
    name: 'Resuscitation',
    target: 'Immediate',
    description: 'Immediately life-threatening; needs instant, life-saving intervention.',
    examples: 'Cardiac arrest, major trauma, severe respiratory distress',
    tag: 'Red',
    ...TAG_COLORS.Red,
  },
  {
    level: 2,
    name: 'Emergent',
    target: 'Within 10–15 min',
    description: 'High-risk or could quickly become life-threatening.',
    examples: 'Stroke, chest pain with cardiac suspicion, severe allergic reaction',
    tag: 'Red',
    ...TAG_COLORS.Red,
  },
  {
    level: 3,
    name: 'Urgent',
    target: 'Within 30–60 min',
    description: 'Serious and needs quick attention, though vital signs are stable.',
    examples: 'Moderate pain, mild respiratory distress, deep cuts',
    tag: 'Yellow',
    ...TAG_COLORS.Yellow,
  },
  {
    level: 4,
    name: 'Less Urgent',
    target: 'Within 1–2 h',
    description: 'Stable and non-life-threatening.',
    examples: 'Simple sprains, mild bleeding',
    tag: 'Green',
    ...TAG_COLORS.Green,
  },
  {
    level: 5,
    name: 'Non-Urgent',
    target: 'Up to 4 h',
    description: 'Minor or chronic complaint.',
    examples: 'Sore throat, minor rash, prescription refill',
    tag: 'Green',
    ...TAG_COLORS.Green,
  },
];

/** Details of a level, or null when none was recorded. */
export function triageLevelInfo(level: number | null | undefined): TriageLevelInfo | null {
  return TRIAGE_LEVELS.find((info) => info.level === level) ?? null;
}

/**
 * Urgency sort key: 5 for Level 1 down to 1 for Level 5, 0 when never triaged.
 * A descending sort therefore lists the most urgent patients first and the
 * untriaged last.
 */
export function triageUrgency(level: number | null | undefined): number {
  const info = triageLevelInfo(level);
  return info ? TRIAGE_LEVELS.length + 1 - info.level : 0;
}

/**
 * Queue sort key for a descending sort: most urgent level first, and within a
 * level the patient who arrived earliest (waited longest) first. Urgency is
 * scaled past any epoch-ms timestamp so it always outranks arrival time.
 * A missing arrival counts as just now, i.e. the shortest wait.
 */
export function triageQueueKey(level: number | null | undefined, arrivedAt?: string | null): number {
  const arrived = arrivedAt ? new Date(arrivedAt).getTime() : NaN;
  return triageUrgency(level) * 1e13 - (Number.isFinite(arrived) ? arrived : Date.now());
}
