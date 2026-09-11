import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {

  /* Sidebar */

  /* Header & Main Layout */

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

  /* Metric Cards */
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
  },
  metricCard: {
    backgroundColor: 'var(--c4w-color-primary)',
    borderRadius: '12px',
    padding: '20px',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  metricHeader: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
  },
  metricIcon: {
    width: '52px',
    height: '52px',
    flexShrink: 0,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    color: 'var(--c4w-color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCopy: {
    minWidth: 0,
  },
  metricTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#ffffff',
  },
  metricValue: {
    marginTop: '2px',
    fontSize: '32px',
    fontWeight: 800,
    lineHeight: 1.1,
  },
  metricTrend: {
    marginTop: '12px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },

  /* Card Containers & Tables */
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '24px',
  },
  activityHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '12px',
    marginBottom: '16px',
  },
  tableTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    color: 'var(--c4w-color-primary)',
    backgroundColor: 'var(--c4w-color-primary-soft)',
    fontWeight: 700,
    fontSize: '12px',
    borderBottom: '1px solid var(--c4w-color-border)',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #f8fafc',
  },
  td: {
    padding: '14px 16px',
    color: '#334155',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #f1f5f9',
  },
  paginationInfo: {
    fontSize: '13px',
    color: '#64748b',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  pageNumberButton: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberActive: {
    backgroundColor: 'var(--c4w-color-primary)',
    color: '#ffffff',
    borderColor: 'var(--c4w-color-primary)',
  },
  pageArrowButton: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#64748b',
    fontSize: '14px',
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
}
};
