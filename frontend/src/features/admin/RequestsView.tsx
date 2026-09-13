/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/domainApi';
import { DataTableToolbar, PageHeader, StatusBadge } from '../../components/ui';
import { styles } from './styles';

import { ConfirmationDialog } from './ConfirmationDialog';

export function RequestsView() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
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
  const itemsPerPage = 5;

  // Fetch password reset requests from backend
  const { data: requestsData } = useQuery({
    queryKey: ['reset-requests'],
    queryFn: () => adminApi.getResetRequests().then((r) => r.data),
  });

  // Handle approving/resetting password request
  const handleResetPassword = useMutation({
    mutationFn: (requestId: string) => adminApi.approveResetRequest(requestId),
    onSuccess: (response: any) => {
      setTemporaryPassword(response.data.temporaryPassword);
      qc.invalidateQueries({ queryKey: ['reset-requests'] });
    },
  });

  const list = (requestsData ?? []).map((request: any) => ({
    ...request,
    name: `${request.user.firstName} ${request.user.lastName}`,
    role: request.user.role,
    userId: request.user.userId,
    date: new Date(request.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: new Date(request.requestedAt).toLocaleTimeString(),
    status: request.status,
  }));

  // Search filter
  const filteredList = list
    .filter((req: any) =>
      req.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.ipAddress ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.id.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((req: any) => statusFilter === 'all' || req.status === statusFilter)
    .sort((a: any, b: any) => {
      const comparison = String(a[sortField]).localeCompare(String(b[sortField]), undefined, { numeric: true });
      return sortDirection === 'ascending' ? comparison : -comparison;
    });

  // Pagination calculations
  const totalItems = filteredList.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredList.slice(startIndex, startIndex + itemsPerPage);

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
            value: searchTerm,
            onChange: (value) => { setSearchTerm(value); setCurrentPage(1); },
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
            {currentData.map((item: any) => (
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
                    status={item.status === 'PENDING' ? 'pending' : item.status === 'APPROVED' ? 'approved' : 'neutral'}
                    label={item.status}
                  />
                </td>
                <td style={styles.td}>
                  {item.status === 'PENDING' && (
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
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Controls */}
        <div style={styles.paginationContainer}>
          <span style={styles.paginationInfo}>
            Showing {totalItems === 0 ? 0 : startIndex + 1} to {endIndex} of {totalItems} requests
          </span>

          <div style={styles.paginationControls}>
            <button
              style={styles.pageArrowButton}
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                style={{
                  ...styles.pageNumberButton,
                  ...(currentPage === page ? styles.pageNumberActive : {}),
                }}
                onClick={() => handlePageChange(page)}
              >
                {page}
              </button>
            ))}

            <button
              style={styles.pageArrowButton}
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
