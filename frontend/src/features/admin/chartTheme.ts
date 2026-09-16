/**
 * Colour helpers for the admin reporting charts.
 *
 * Kept out of the component modules: a file that exports both components and
 * plain values breaks React Fast Refresh.
 */

/**
 * Distinct hues for categorical breakdowns. Starts with the theme tokens so a
 * chart reads as part of the dashboard, then falls back to accents for the
 * categories a clinical system has no semantic colour for.
 */
export const CHART_COLORS = [
  'var(--c4w-color-primary, #2563eb)',
  'var(--c4w-color-success, #15803d)',
  'var(--c4w-color-warning, #b45309)',
  'var(--c4w-color-danger, #b91c1c)',
  '#7c3aed',
  '#0891b2',
  '#65a30d',
  '#db2777',
];

export function segmentColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
