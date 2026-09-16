import type { CSSProperties } from 'react';

/*
 * Patient table design + measurements, copied 1:1 from the Claims Processor
 * "Patient Overview" card (`src/features/claims/styles.ts`: `styles.table`,
 * `thRow`, `th`, `tr`, `td` plus `overviewStyles.leftCard`, `cardTitle`,
 * `pagination`, `paginationText`, `paginationControls`, `pageButton`,
 * `pageActive`).
 *
 * The nurse Patient Overview and physician Patients List both render through
 * this module, so their sizes, type scale, and colors cannot drift away from
 * the Claims Processor screen again.
 */
export const patientTableStyles: Record<string, CSSProperties> = {
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 16px 0',
  },
  /** Title on the left, the card's primary action on the right. */
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  tableWrapper: { overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  thRow: {
    backgroundColor: 'var(--c4w-color-primary-soft)',
    borderBottom: '1px solid var(--c4w-color-border)',
  },
  th: {
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--c4w-color-primary)',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '14px 16px' },
  /** Status dot inside the Patient cell. */
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  /** Patient name — the one emphasised cell in a row. */
  name: { fontSize: '13px', fontWeight: 600, color: '#334155' },
  /** Every other cell. */
  cell: { fontSize: '12px', color: '#64748b' },
  viewBtn: {
    backgroundColor: 'var(--c4w-color-primary-active)',
    color: '#ffffff',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  /** Row action column — the Claims Processor card holds one button. */
  rowActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  /** Secondary row action: same box as `viewBtn`, outline instead of fill. */
  viewBtnSecondary: {
    backgroundColor: '#ffffff',
    color: 'var(--c4w-color-primary)',
    border: '1px solid var(--c4w-color-border)',
    padding: '6px 14px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '16px',
  },
  paginationText: { fontSize: '12px', color: '#64748b' },
  paginationControls: { display: 'flex', alignItems: 'center', gap: '4px' },
  pageButton: {
    minWidth: '32px',
    height: '32px',
    padding: '4px 8px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontSize: '12px',
    cursor: 'pointer',
  },
  pageActive: {
    backgroundColor: 'var(--c4w-color-primary)',
    borderColor: 'var(--c4w-color-primary)',
    color: '#ffffff',
    fontWeight: 700,
  },
};

/** The Claims Processor footer: "Showing X to Y of Z" + ‹ 1 2 › page buttons. */
export function PatientTablePagination({
  info,
  page,
  pageCount,
  onPageChange,
}: {
  info: string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <div style={patientTableStyles.pagination}>
      <span style={patientTableStyles.paginationText}>{info}</span>
      <div style={patientTableStyles.paginationControls}>
        <button
          type="button"
          style={patientTableStyles.pageButton}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        {pages.map((pageNumber) => (
          <button
            type="button"
            key={pageNumber}
            style={{
              ...patientTableStyles.pageButton,
              ...(pageNumber === page ? patientTableStyles.pageActive : {}),
            }}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          style={patientTableStyles.pageButton}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
