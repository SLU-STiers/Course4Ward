/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/domainApi';
import { DataTableToolbar, PageHeader, StatusBadge } from '../../components/ui';
import { pageItems } from '../../lib/pagination';
import { styles } from './styles';
import type { PasswordResetApproval, PasswordResetQuery } from '../../types';

import { ConfirmationDialog } from './ConfirmationDialog';

const PAGE_SIZE_OPTIONS = [5, 10, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

export function RequestsView() {
  const qc = useQueryClient();
  // `searchInput` follows the field; `searchTerm` is the debounced value sent to the API.
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimer = useRef<number | undefined>(undefined);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all');
  const [sortField, setSortField] = useState<'name' | 'date'>('date');
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('descending');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const query = useMemo<PasswordResetQuery>(
    () => ({
      skip: (currentPage - 1) * itemsPerPage,
      take: itemsPerPage,
      ...(statusFilter === 'all' ? {} : { status: statusFilter }),
      ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
      sort: sortField,
      direction: sortDirection === 'ascending' ? 'asc' : 'desc',
    }),
    [currentPage, itemsPerPage, statusFilter, searchTerm, sortField, sortDirection],
  );

  // Only the visible page is fetched; search, filter and sort run server-side.
  const { data: requestsPage, isPlaceholderData } = useQuery({
    queryKey: ['reset-requests', query],
    queryFn: () => adminApi.getResetRequests(query).then((r) => r.data),
    // Keep the current rows on screen while the next page loads.
    placeholderData: keepPreviousData,
    // New requests show up without a manual reload, as before.
    refetchInterval: 5000,
  });

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setSearchTerm(value);
      setCurrentPage(1);
    }, 300);
  };

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  // Handle approving/resetting password request
  const handleResetPassword = useMutation({
    mutationFn: (requestId: string) => adminApi.approveResetRequest(requestId),
    onSuccess: (response: { data: PasswordResetApproval }) => {
      setTemporaryPassword(response.data.temporaryPassword);
      qc.invalidateQueries({ queryKey: ['reset-requests'] });
    },
  });

  const handleRejectPassword = useMutation({
    mutationFn: (requestId: string) => adminApi.rejectResetRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reset-requests'] });
    },
  });

  const currentData = (requestsPage?.items ?? []).map((request) => ({
    ...request,
    name: `${request.user.firstName} ${request.user.lastName}`,
    role: request.user.role,
    userId: request.user.userId,
    date: new Date(request.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: new Date(request.requestedAt).toLocaleTimeString(),
    status: request.status,
  }));

  // Pagination calculations
  const totalItems = requestsPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  // Step back when the current page empties, e.g. after resolving its last request.
  if (requestsPage && !isPlaceholderData && currentPage > totalPages) {
    setCurrentPage(totalPages);
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={styles.cardContainer}>
        {temporaryPassword && (
          <div style={styles.resetResult}>
            Temporary password for the user: <strong>{temporaryPassword}</strong>. Share it securely; it is only shown here once.
            <button type="button" style={styles.dismissButton} onClick={() => setTemporaryPassword(null)}>Dismiss</button>
          </div>
        )}
        {/* Header Bar with Search */}
        <PageHeader
          title="Password Reset Requests"
          description="Review and manage user password reset requests."
        />

        <DataTableToolbar
          searchProps={{
            value: searchInput,
            onChange: handleSearchChange,
            placeholder: 'Search requests...',
            ariaLabel: 'Search password reset requests',
          }}
          filterProps={{
            title: 'Request status',
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'PENDING', label: 'PENDING' },
              { value: 'APPROVED', label: 'APPROVED' },
              { value: 'REJECTED', label: 'REJECTED' },
            ],
            value: statusFilter,
            onChange: (value) => { setStatusFilter(value as typeof statusFilter); setCurrentPage(1); },
          }}
          sortProps={{
            title: 'Sort requests by',
            options: [
              { value: 'date', label: 'Requested date' },
              { value: 'name', label: 'User name' },
            ],
            value: sortField,
            onChange: (value) => { setSortField(value as typeof sortField); setCurrentPage(1); },
            direction: sortDirection,
            onDirectionChange: (direction) => { setSortDirection(direction); setCurrentPage(1); },
          }}
        />

        {/* Requests Table */}
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Request ID</th>
              <th style={styles.th}>User</th>
              <th style={styles.th}>User ID</th>
              <th style={styles.th}>Requester IP</th>
              <th style={styles.th}>Requested On</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((item) => (
              <tr key={item.id} style={styles.tr}>
                <td style={{ ...styles.td, fontWeight: 700, color: 'var(--c4w-color-primary)' }}>
                  {item.id}
                </td>
                <td style={styles.td}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{item.role}</div>
                </td>
                <td style={{ ...styles.td, color: '#475569' }}>{item.userId}</td>
                <td style={{ ...styles.td, color: '#475569', fontFamily: 'monospace' }}>
                  {item.ipAddress ?? 'Unavailable'}
                </td>
                <td style={styles.td}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.date}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{item.time}</div>
                </td>
                <td style={styles.td}>
                  <StatusBadge
                    showDot
                    status={
                      item.status === 'PENDING'
                        ? 'pending'
                        : item.status === 'APPROVED'
                          ? 'approved'
                          : item.status === 'REJECTED'
                            ? 'rejected'
                            : 'neutral'
                    }
                    label={item.status}
                  />
                </td>
                <td style={styles.td}>
                  {item.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        style={styles.actionButton}
                        onClick={() => {
                          setConfirmation({
                            title: 'Approve reset request',
                            message: `Are you sure you want to approve the password reset request for ${item.name}?`,
                            confirmLabel: 'Approve Reset',
                            onConfirm: () => {
                              setConfirmation(null);
                              handleResetPassword.mutate(item.id);
                            },
                          });
                        }}
                      >
                        Approve reset
                      </button>
                      <button
                        style={{ ...styles.actionButton, background: 'var(--c4w-color-danger, #dc2626)', borderColor: 'var(--c4w-color-danger, #dc2626)' }}
                        onClick={() => {
                          setConfirmation({
                            title: 'Reject reset request',
                            message: `Are you sure you want to reject the password reset request for ${item.name}?`,
                            confirmLabel: 'Reject Reset',
                            onConfirm: () => {
                              setConfirmation(null);
                              handleRejectPassword.mutate(item.id);
                            },
                          });
                        }}
                      >
                        Reject reset
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {requestsPage && currentData.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#64748b' }}>
                  No password reset requests match.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        <div style={styles.paginationContainer}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <label style={{ ...styles.paginationInfo, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Rows per page
              <select
                style={{ ...styles.formInput, padding: '4px 8px', fontSize: '12px' }}
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <span style={styles.paginationInfo}>
              Showing {totalItems === 0 ? 0 : startIndex + 1}–{endIndex} of {totalItems.toLocaleString()} requests
            </span>
          </div>

          <div style={styles.paginationControls} role="group" aria-label="Password reset request pages">
            <button
              type="button"
              style={styles.pageArrowButton}
              aria-label="Previous page"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ‹
            </button>

            {pageItems(currentPage, totalPages).map((page, index) =>
              page === 'gap' ? (
                <span key={`gap-${index}`} style={{ ...styles.paginationInfo, padding: '0 4px' }} aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  key={page}
                  style={{
                    ...styles.pageNumberButton,
                    // Wide enough for 4–5 digit page numbers.
                    width: 'auto',
                    minWidth: '28px',
                    padding: '0 6px',
                    ...(currentPage === page ? styles.pageNumberActive : {}),
                  }}
                  aria-current={currentPage === page ? 'page' : undefined}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ),
            )}

            <button
              type="button"
              style={styles.pageArrowButton}
              aria-label="Next page"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </div>
        </div>
      </div>
      {confirmation && (
        <ConfirmationDialog
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmation.onConfirm}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   STYLES (Tailored to match UI mock design)
   ========================================================================== */
