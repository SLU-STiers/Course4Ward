/**
 * Course4Ward — Unified Design Tokens
 * ------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for the entire frontend design system.
 *
 * Everything visual (colors, typography, spacing, radii, shadows,
 * motion, z-index, breakpoints) is defined here exactly once. The
 * tokens are projected onto the document as `--c4w-*` CSS custom
 * properties at runtime by {@link applyThemeTokens}, and the global
 * stylesheet (`index.css`) maps the legacy `--dashboard-*` variables
 * onto these canonical values.
 *
 * Rules:
 *  - Never hard-code colors/sizes in components. Import from here.
 *  - Components consume tokens through CSS variables (`var(--c4w-*)`)
 *    so themes can change without a re-render.
 *  - This is the only file that should contain raw design values.
 */

/** Semantic color palette. */
export const colors = {
  // Surfaces
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  surfaceHover: '#F8FAFC',
  overlay: 'rgba(15, 23, 42, 0.48)',

  // Brand / primary action
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  primaryActive: '#1E40AF',
  primarySoft: '#EFF6FF',
  primarySoftBorder: '#BFDBFE',
  onPrimary: '#FFFFFF',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  textInverse: '#FFFFFF',

  // Borders / dividers
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  divider: '#F1F5F9',

  // Status — base + soft background
  success: '#15803D',
  successSoft: '#DCFCE7',
  successBorder: '#BBF7D0',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  warningBorder: '#FDE68A',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  dangerBorder: '#FECDD3',
  info: '#2563EB',
  infoSoft: '#DBEAFE',
  infoBorder: '#BFDBFE',
  neutral: '#475569',
  neutralSoft: '#F1F5F9',
  neutralBorder: '#E2E8F0',
  flagged: '#7C3AED',
  flaggedSoft: '#EDE9FE',
  flaggedBorder: '#DDD6FE',

  // Focus
  focusRing: 'rgba(37, 99, 235, 0.28)',
} as const;

/** Typography scale (per design spec). */
export const typography = {
  fontFamily:
    "'Plus Jakarta Sans', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  title: { size: '1.5rem', weight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' },
  sectionHeader: { size: '1.125rem', weight: 500, lineHeight: 1.4 },
  body: { size: '0.875rem', weight: 400, lineHeight: 1.5 },
  caption: { size: '0.75rem', weight: 500, lineHeight: 1.4, letterSpacing: '0.01em' },
} as const;

/** Spacing scale. `container` is the standard `p-6` page padding. */
export const spacing = {
  xxs: '0.25rem',
  xs: '0.5rem',
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  xxl: '3rem',
  container: '1.5rem',
} as const;

/** Corner radii. */
export const radii = {
  card: '12px',
  control: '8px',
  badge: '9999px',
  sm: '6px',
  pill: '9999px',
} as const;

/** Elevation. */
export const shadows = {
  card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)',
  cardHover: '0 2px 4px rgba(15, 23, 42, 0.05), 0 12px 28px rgba(15, 23, 42, 0.1)',
  popover: '0 12px 32px rgba(15, 23, 42, 0.16)',
  button: '0 1px 2px rgba(15, 23, 42, 0.08)',
  buttonHover: '0 4px 12px rgba(37, 99, 235, 0.24)',
  focus: '0 0 0 3px rgba(37, 99, 235, 0.28)',
} as const;

/** Motion timings + easing. */
export const motion = {
  fast: '120ms',
  base: '150ms',
  slow: '240ms',
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** Ready-to-use transition for hover/active interactions. */
  interaction:
    'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

/** Stacking order for the fixed/portal layers. */
export const zIndex = {
  base: 0,
  sidebar: 20,
  popover: 1000,
  modal: 1100,
  toast: 1200,
} as const;

/** Layout dimensions shared by the shell. */
export const layout = {
  sidebarWidth: '232px',
  sidebarCollapsedWidth: '0px',
  headerHeight: '72px',
  tableMinWidth: '680px',
} as const;

/** Breakpoints (for reference / JS media queries). */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

export const tokens = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  motion,
  zIndex,
  layout,
  breakpoints,
} as const;

export type Tokens = typeof tokens;

/**
 * Flattened `--c4w-*` CSS variable map derived from {@link tokens}.
 * This is the projection consumed by `index.css` / component classes.
 */
export const cssVariables: Record<string, string> = {
  // colors
  '--c4w-color-background': colors.background,
  '--c4w-color-surface': colors.surface,
  '--c4w-color-surface-muted': colors.surfaceMuted,
  '--c4w-color-surface-hover': colors.surfaceHover,
  '--c4w-color-overlay': colors.overlay,
  '--c4w-color-primary': colors.primary,
  '--c4w-color-primary-hover': colors.primaryHover,
  '--c4w-color-primary-active': colors.primaryActive,
  '--c4w-color-primary-soft': colors.primarySoft,
  '--c4w-color-primary-soft-border': colors.primarySoftBorder,
  '--c4w-color-on-primary': colors.onPrimary,
  '--c4w-color-text-primary': colors.textPrimary,
  '--c4w-color-text-secondary': colors.textSecondary,
  '--c4w-color-text-muted': colors.textMuted,
  '--c4w-color-text-subtle': colors.textSubtle,
  '--c4w-color-text-inverse': colors.textInverse,
  '--c4w-color-border': colors.border,
  '--c4w-color-border-strong': colors.borderStrong,
  '--c4w-color-divider': colors.divider,
  '--c4w-color-success': colors.success,
  '--c4w-color-success-soft': colors.successSoft,
  '--c4w-color-success-border': colors.successBorder,
  '--c4w-color-warning': colors.warning,
  '--c4w-color-warning-soft': colors.warningSoft,
  '--c4w-color-warning-border': colors.warningBorder,
  '--c4w-color-danger': colors.danger,
  '--c4w-color-danger-soft': colors.dangerSoft,
  '--c4w-color-danger-border': colors.dangerBorder,
  '--c4w-color-info': colors.info,
  '--c4w-color-info-soft': colors.infoSoft,
  '--c4w-color-info-border': colors.infoBorder,
  '--c4w-color-neutral': colors.neutral,
  '--c4w-color-neutral-soft': colors.neutralSoft,
  '--c4w-color-neutral-border': colors.neutralBorder,
  '--c4w-color-flagged': colors.flagged,
  '--c4w-color-flagged-soft': colors.flaggedSoft,
  '--c4w-color-flagged-border': colors.flaggedBorder,
  '--c4w-color-focus-ring': colors.focusRing,

  // typography
  '--c4w-font-family': typography.fontFamily,
  '--c4w-font-title-size': typography.title.size,
  '--c4w-font-title-weight': String(typography.title.weight),
  '--c4w-font-title-line': String(typography.title.lineHeight),
  '--c4w-font-section-size': typography.sectionHeader.size,
  '--c4w-font-section-weight': String(typography.sectionHeader.weight),
  '--c4w-font-body-size': typography.body.size,
  '--c4w-font-body-weight': String(typography.body.weight),
  '--c4w-font-body-line': String(typography.body.lineHeight),
  '--c4w-font-caption-size': typography.caption.size,
  '--c4w-font-caption-weight': String(typography.caption.weight),

  // spacing
  '--c4w-space-xxs': spacing.xxs,
  '--c4w-space-xs': spacing.xs,
  '--c4w-space-sm': spacing.sm,
  '--c4w-space-md': spacing.md,
  '--c4w-space-lg': spacing.lg,
  '--c4w-space-xl': spacing.xl,
  '--c4w-space-xxl': spacing.xxl,
  '--c4w-space-container': spacing.container,

  // radii
  '--c4w-radius-card': radii.card,
  '--c4w-radius-control': radii.control,
  '--c4w-radius-badge': radii.badge,
  '--c4w-radius-sm': radii.sm,

  // shadows
  '--c4w-shadow-card': shadows.card,
  '--c4w-shadow-card-hover': shadows.cardHover,
  '--c4w-shadow-popover': shadows.popover,
  '--c4w-shadow-button': shadows.button,
  '--c4w-shadow-button-hover': shadows.buttonHover,
  '--c4w-shadow-focus': shadows.focus,

  // motion
  '--c4w-motion-fast': motion.fast,
  '--c4w-motion-base': motion.base,
  '--c4w-motion-slow': motion.slow,
  '--c4w-motion-easing': motion.easing,
  '--c4w-transition-interaction': motion.interaction,

  // z-index
  '--c4w-z-sidebar': String(zIndex.sidebar),
  '--c4w-z-popover': String(zIndex.popover),
  '--c4w-z-modal': String(zIndex.modal),

  // layout
  '--c4w-layout-sidebar-width': layout.sidebarWidth,
  '--c4w-layout-sidebar-collapsed': layout.sidebarCollapsedWidth,
  '--c4w-layout-header-height': layout.headerHeight,
};

/**
 * Apply the canonical tokens to a root element as CSS custom properties.
 * Called once at app bootstrap (see `main.tsx`).
 */
export function applyThemeTokens(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(cssVariables)) {
    root.style.setProperty(name, value);
  }
}
