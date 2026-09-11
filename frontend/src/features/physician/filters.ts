/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { daysAgoValue, toDateKey, todayValue } from '../../lib/format';

import type { DashboardPatient } from './types';

/** Admission-date filter presets. `custom:<from>:<to>` is also accepted. */
export const ADMISSION_FILTER_PRESETS: { value: string; label: string }[] = [
  { value: "all", label: "Any admission date" },
  { value: "today", label: "Admitted today" },
  { value: "last7", label: "Admitted in the last 7 days" },
  { value: "last30", label: "Admitted in the last 30 days" },
  { value: "custom", label: "Custom range (use dates below)" },
];
export const AGE_BANDS: { value: string; label: string; test: (age: number) => boolean }[] = [
  { value: "all", label: "All ages", test: () => true },
  { value: "pediatric", label: "Under 18", test: (age) => age < 18 },
  { value: "young", label: "18 – 39", test: (age) => age >= 18 && age <= 39 },
  { value: "middle", label: "40 – 59", test: (age) => age >= 40 && age <= 59 },
  { value: "senior", label: "60 and above", test: (age) => age >= 60 },
];
export const DAYS_IN_CARE_BANDS: {
  value: string;
  label: string;
  test: (days: number) => boolean;
}[] = [
  { value: "all", label: "Any length of stay", test: () => true },
  { value: "short", label: "0 – 3 days", test: (days) => days <= 3 },
  { value: "medium", label: "4 – 7 days", test: (days) => days >= 4 && days <= 7 },
  { value: "long", label: "8+ days", test: (days) => days >= 8 },
];
export const MANAGE_FILTER_KEYS = ["gender", "age", "days", "admitted"];
export function parseCustomRange(value: string) {
  if (!value.startsWith("custom:")) return { from: "", to: "" };
  const [, from = "", to = ""] = value.split(":");
  return { from, to };
}
export function customRangeValue(from: string, to: string) {
  return `custom:${from}:${to}`;
}
export function admissionMatches(patient: DashboardPatient, value: string) {
  if (!value || value === "all") return true;
  const day = patient.admissionDateRaw;
  if (!day) return false;
  if (value === "today") return day === todayValue();
  if (value === "last7") return day >= daysAgoValue(6) && day <= todayValue();
  if (value === "last30") return day >= daysAgoValue(29) && day <= todayValue();
  if (value.startsWith("custom:")) {
    const { from, to } = parseCustomRange(value);
    if (!from && !to) return true;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  }
  return true;
}
/** Local calendar date of an order timestamp, matching how it is displayed. */
export function orderDayValue(iso: string) {
  return toDateKey(iso);
}
