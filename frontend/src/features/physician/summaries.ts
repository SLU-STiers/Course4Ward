/** Part of the physician dashboard — see index.tsx for the screen shell. */

import type { CourseInWard } from '../../types';
import { toDateKey } from '../../lib/format';

/**
 * The order day a Course in the Ward belongs to: the day of the orders it was
 * built from, falling back to its `summaryDate` when nothing is linked yet.
 */
export function summaryDayKey(summary: CourseInWard): string {
  const days = (summary.orders ?? [])
    .map((order) => toDateKey(order.dateCreated))
    .filter(Boolean)
    .sort();
  return days[0] ?? toDateKey(summary.summaryDate);
}

/**
 * One Course in the Ward per order day. For a day that has several, the live
 * draft wins over the approved record, so editing continues where the
 * physician left off.
 */
export function summariesPerDay(summaries: CourseInWard[]): Map<string, CourseInWard> {
  const map = new Map<string, CourseInWard>();
  for (const entry of summaries) {
    const day = summaryDayKey(entry);
    if (!day) continue;
    const current = map.get(day);
    if (!current) map.set(day, entry);
    else if (current.status === "APPROVED" && entry.status !== "APPROVED") {
      map.set(day, entry);
    }
  }
  return map;
}

/** Merge fresh summary rows into one newest-day-first list, replacing by id. */
export function mergeSummaries(existing: CourseInWard[] | undefined, incoming: CourseInWard[]) {
  const byId = new Map((existing ?? []).map((summary) => [summary.id, summary]));
  for (const summary of incoming) byId.set(summary.id, summary);
  return [...byId.values()].sort(
    (a, b) => new Date(b.summaryDate).getTime() - new Date(a.summaryDate).getTime(),
  );
}
