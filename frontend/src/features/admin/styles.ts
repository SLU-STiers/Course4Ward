/**
 * Inline style map for the admin dashboard.
 *
 * Grouped in reading order of the screen (shell → cards → reporting → charts →
 * activity log). States that need a pseudo-class (row hover, focus rings) live
 * as `.admin-log-table` / `.ui-*` rules in `src/index.css` instead — inline
 * styles cannot express them.
 *
 * Every value comes from the `--c4w-*` tokens in `src/theme/tokens.ts`; the
 * literal fallbacks exist only so the map still renders if the theme has not
 * been applied yet.
 */
import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  /* Modals */
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000,
  },
  confirmationModal: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 18px 48px rgba(15, 23, 42, 0.2)',
    padding: '24px',
  },
  confirmationHeader: {
    marginBottom: '8px',
  },
  confirmationTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '20px',
    fontWeight: 700,
  },
  confirmationMessage: {
    margin: 0,
    color: '#475569',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  confirmationActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
  },

  /* Metric cards (dashboard headline row) */
  dashboardStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '14px',
  },
  metricCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px 14px',
    backgroundColor: 'var(--c4w-color-surface, #ffffff)',
    border: '1px solid var(--c4w-color-border, #e2e8f0)',
    borderRadius: 'var(--c4w-radius-card, 12px)',
    boxShadow: 'var(--c4w-shadow-card, 0 1px 2px rgba(15, 23, 42, 0.04))',
  },
  metricHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },
  metricIcon: {
    width: '30px',
    height: '30px',
    flexShrink: 0,
    borderRadius: '8px',
    backgroundColor: 'var(--c4w-color-primary-soft, #eff6ff)',
    color: 'var(--c4w-color-primary, #2563eb)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--c4w-color-text-muted, #64748b)',
  },
  metricValue: {
    fontSize: '22px',
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
    color: 'var(--c4w-color-text-primary, #0f172a)',
  },
  metricTrend: {
    fontSize: '11px',
    color: 'var(--c4w-color-text-muted, #64748b)',
  },

  /* Cards + shared table (report cards reuse these) */
  cardContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'var(--c4w-color-surface, #ffffff)',
    border: '1px solid var(--c4w-color-border, #e2e8f0)',
    borderRadius: 'var(--c4w-radius-card, 12px)',
    boxShadow: 'var(--c4w-shadow-card, 0 1px 2px rgba(15, 23, 42, 0.04))',
  },
  activityHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '10px',
  },
  tableTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--c4w-color-text-primary, #0f172a)',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '10px 16px',
    color: 'var(--c4w-color-text-muted, #64748b)',
    backgroundColor: 'transparent',
    fontWeight: 600,
    fontSize: '11px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--c4w-color-border, #e2e8f0)',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid var(--c4w-color-divider, #f1f5f9)',
  },
  td: {
    padding: '12px 16px',
    color: 'var(--c4w-color-text-secondary, #475569)',
    verticalAlign: 'middle',
  },

  /* Forms */
  formInput: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
  },
  primaryButton: {
    padding: '10px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--c4w-color-primary)',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
  },

  /* Requests Section Styles */
  actionButton: {
    backgroundColor: 'var(--c4w-color-primary)',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontWeight: 700,
    cursor: 'pointer',
  },
  resetResult: {
    marginBottom: '16px',
    padding: '12px 14px',
    borderRadius: '8px',
    backgroundColor: '#ecfdf5',
    color: '#166534',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  dismissButton: {
    marginLeft: '10px',
    border: 0,
    background: 'transparent',
    color: '#166534',
    fontWeight: 700,
    cursor: 'pointer',
  },

  /* Pagination */
  paginationContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
  },
  activityPagination: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  paginationInfo: {
    fontSize: '11px',
    color: 'var(--c4w-color-text-muted, #64748b)',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  pageNumberButton: {
    width: '28px',
    height: '28px',
    padding: 0,
    borderRadius: 'var(--c4w-radius-control, 8px)',
    border: '1px solid var(--c4w-color-border, #e2e8f0)',
    backgroundColor: 'var(--c4w-color-surface, #ffffff)',
    color: 'var(--c4w-color-text-secondary, #475569)',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberActive: {
    backgroundColor: 'var(--c4w-color-primary, #2563eb)',
    border: '1px solid var(--c4w-color-primary, #2563eb)',
    color: 'var(--c4w-color-on-primary, #ffffff)',
  },
  pageArrowButton: {
    width: '28px',
    height: '28px',
    padding: 0,
    borderRadius: 'var(--c4w-radius-control, 8px)',
    border: '1px solid var(--c4w-color-border, #e2e8f0)',
    backgroundColor: 'var(--c4w-color-surface, #ffffff)',
    color: 'var(--c4w-color-text-muted, #64748b)',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  navIconImage: {
  width: '26px',
  height: '26px',
  marginRight: '10px',
  objectFit: 'contain',
},

  /* Reporting section */
  // The panel lives in the dashboard's narrow right column: a heading, a
  // compact KPI grid, a tab bar and one screenful of cards. Tabs are what keep
  // the whole dashboard inside a single viewport instead of an eleven-card
  // column. Cards share one visual language (surface + hairline border + soft
  // shadow) with the headline metric cards above.
  reportSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  reportHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  reportTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: 'var(--c4w-color-text-primary, #0f172a)',
  },
  reportSubtitle: {
    margin: '2px 0 0',
    fontSize: '12px',
    color: 'var(--c4w-color-text-muted, #64748b)',
  },
  rangeGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px',
    borderRadius: '10px',
    backgroundColor: 'var(--c4w-color-surface-muted, #f1f5f9)',
  },
  rangeButton: {
    padding: '5px 9px',
    borderRadius: '8px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--c4w-color-text-secondary, #475569)',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  rangeButtonActive: {
    backgroundColor: 'var(--c4w-color-surface, #ffffff)',
    border: '1px solid var(--c4w-color-border, #e2e8f0)',
    color: 'var(--c4w-color-primary, #2563eb)',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
  },
  /* Tabs: the reporting cards are grouped so only one group is on screen.
     Wrapping beats a scrollbar here — a clipped tab reads as a broken tab. */
  tabBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '3px',
    padding: '3px',
    borderRadius: '10px',
    backgroundColor: 'var(--c4w-color-surface-muted, #f1f5f9)',
  },
  tabButton: {
    flex: '1 1 auto',
    padding: '5px 7px',
    borderRadius: '8px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--c4w-color-text-secondary, #475569)',
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabButtonActive: {
    backgroundColor: 'var(--c4w-color-surface, #ffffff)',
    border: '1px solid var(--c4w-color-border, #e2e8f0)',
    color: 'var(--c4w-color-primary, #2563eb)',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
  },
  // Columns come from `.admin-kpi-grid` in `src/index.css` — a media-query
  // column count is the only way to keep six tiles in balanced rows.
  kpiGrid: {
    display: 'grid',
    gap: '8px',
  },
  kpiTile: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px 10px',
    backgroundColor: 'var(--c4w-color-surface, #ffffff)',
    border: '1px solid var(--c4w-color-border, #e2e8f0)',
    borderRadius: 'var(--c4w-radius-card, 12px)',
    boxShadow: 'var(--c4w-shadow-card, 0 1px 2px rgba(15, 23, 42, 0.04))',
  },
  kpiLabel: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--c4w-color-text-muted, #64748b)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  kpiValue: {
    fontSize: '18px',
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: '-0.02em',
    color: 'var(--c4w-color-text-primary, #0f172a)',
  },
  kpiHint: {
    fontSize: '10px',
    lineHeight: 1.3,
    color: 'var(--c4w-color-text-muted, #64748b)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  reportGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '12px',
    alignItems: 'start',
  },
  reportCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minWidth: 0,
    padding: '14px',
    backgroundColor: 'var(--c4w-color-surface, #ffffff)',
    border: '1px solid var(--c4w-color-border, #e2e8f0)',
    borderRadius: 'var(--c4w-radius-card, 12px)',
    boxShadow: 'var(--c4w-shadow-card, 0 1px 2px rgba(15, 23, 42, 0.04))',
  },
  reportCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  reportCardIcon: {
    width: '26px',
    height: '26px',
    flexShrink: 0,
    borderRadius: '7px',
    backgroundColor: 'var(--c4w-color-primary-soft, #eff6ff)',
    color: 'var(--c4w-color-primary, #2563eb)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCardHeading: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  reportCardTitle: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--c4w-color-text-primary, #0f172a)',
  },
  reportCardHint: {
    fontSize: '11px',
    color: 'var(--c4w-color-text-muted, #64748b)',
  },
  reportEmpty: {
    margin: 0,
    padding: '4px 0',
    fontSize: '12px',
    color: 'var(--c4w-color-text-muted, #64748b)',
  },

  /* Chart primitives */
  chartWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  chartSvg: {
    width: '100%',
    height: 'auto',
  },
  chartLegend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '14px',
    fontSize: '11px',
    color: 'var(--c4w-color-text-secondary, #475569)',
  },
  chartLegendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  chartLegendSwatch: {
    width: '10px',
    height: '10px',
    borderRadius: '3px',
    flexShrink: 0,
  },
  chartLegendValue: {
    color: 'var(--c4w-color-text-primary, #0f172a)',
  },
  barListRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(130px, 1.9fr) minmax(50px, 1fr) 66px',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
    fontSize: '12px',
  },
  barListLabel: {
    color: 'var(--c4w-color-text-secondary, #475569)',
    lineHeight: 1.3,
    // Wrap instead of truncating: these lists sit in narrow reporting columns,
    // and "Summary generated (AI" tells the reader nothing.
    overflowWrap: 'anywhere',
  },
  barListTrack: {
    height: '7px',
    borderRadius: '9999px',
    backgroundColor: 'var(--c4w-color-surface-muted, #f1f5f9)',
    overflow: 'hidden',
  },
  barListFill: {
    display: 'block',
    height: '100%',
    borderRadius: '9999px',
  },
  barListValue: {
    textAlign: 'right',
    fontWeight: 700,
    color: 'var(--c4w-color-text-primary, #0f172a)',
    whiteSpace: 'nowrap',
  },
  barListShare: {
    fontWeight: 500,
    color: 'var(--c4w-color-text-subtle, #94a3b8)',
  },
  donutWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  donutSvg: {
    width: '124px',
    height: '124px',
    flexShrink: 0,
  },
  donutLegend: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '12px',
    color: 'var(--c4w-color-text-secondary, #475569)',
    minWidth: 0,
    flex: '1 1 120px',
  },
  funnelRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(110px, 1fr) minmax(70px, 1.8fr) 118px',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
    fontSize: '12px',
  },
  funnelLabel: {
    color: 'var(--c4w-color-text-secondary, #475569)',
  },
  funnelTrack: {
    height: '12px',
    borderRadius: '9999px',
    backgroundColor: 'var(--c4w-color-surface-muted, #f1f5f9)',
    overflow: 'hidden',
  },
  funnelBar: {
    display: 'block',
    height: '100%',
    borderRadius: '9999px',
  },
  funnelValue: {
    textAlign: 'right',
    fontWeight: 700,
    color: 'var(--c4w-color-text-primary, #0f172a)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  funnelConversion: {
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--c4w-color-text-subtle, #94a3b8)',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '4px 0',
    borderBottom: '1px solid var(--c4w-color-divider, #f1f5f9)',
    fontSize: '12px',
  },
  statusRowLabel: {
    color: 'var(--c4w-color-text-secondary, #475569)',
  },
  statusRowValue: {
    fontWeight: 700,
    color: 'var(--c4w-color-text-primary, #0f172a)',
  },

  /* Activity log table */
  activityTitleRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  graphWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  graphHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  graphSummary: {
    fontSize: '13px',
    color: 'var(--c4w-color-text-muted, #64748b)',
  },
  graphNote: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--c4w-color-text-subtle, #94a3b8)',
  },
  tableScroll: {
    overflowX: 'auto',
    // Bleed by the card's own padding so a hovered log row spans the full card
    // width while its first column still lines up with the text above it.
    margin: '0 -20px',
  },
  // The table needs row hover + edge-aligned cells, which inline styles cannot
  // express; those live under `.admin-log-table` in `src/index.css`.
  logIdChip: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: 'var(--c4w-color-surface-muted, #f1f5f9)',
    color: 'var(--c4w-color-text-muted, #64748b)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '11px',
    fontWeight: 600,
  },
  logActorCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },
  logAvatar: {
    width: '26px',
    height: '26px',
    flexShrink: 0,
    borderRadius: '50%',
    backgroundColor: 'var(--c4w-color-primary-soft, #eff6ff)',
    color: 'var(--c4w-color-primary, #2563eb)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  cellStack: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  userNameCell: {
    color: 'var(--c4w-color-text-primary, #0f172a)',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  userLoginCell: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 500,
    lineHeight: 1.25,
    color: 'var(--c4w-color-text-subtle, #94a3b8)',
  },
  emptyCell: {
    padding: '28px 16px',
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--c4w-color-text-muted, #64748b)',
  },
  filterExtra: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
  },
  filterExtraLabel: {
    fontSize: '12px',
    color: 'var(--c4w-color-text-muted, #64748b)',
  },
  dateInput: {
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid var(--c4w-color-border-strong, #cbd5e1)',
    fontSize: '12px',
    fontFamily: 'inherit',
    color: 'var(--c4w-color-text-primary, #0f172a)',
  },
  clearFiltersButton: {
    padding: '8px 12px',
    borderRadius: 'var(--c4w-radius-control, 8px)',
    border: '1px solid var(--c4w-color-border, #e2e8f0)',
    backgroundColor: 'var(--c4w-color-surface, #ffffff)',
    color: 'var(--c4w-color-text-secondary, #475569)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
