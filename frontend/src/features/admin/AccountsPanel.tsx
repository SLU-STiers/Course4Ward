/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/domainApi';
import { styles } from './styles';
import type { StaffAccount } from '../../types';

import { AccountFormModal } from './AccountFormModal';

export function AccountsPanel() {
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers().then((r) => r.data),
  });

  // null = closed, 'new' = Add User pop-up, otherwise the account being edited.
  const [formTarget, setFormTarget] = useState<StaffAccount | 'new' | null>(null);

  return (
    <div style={styles.cardContainer}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: '#0f172a' }}>Staff Accounts</h4>
        <button style={styles.primaryButton} onClick={() => setFormTarget('new')}>
          + Add User
        </button>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>User ID</th>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Role</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} style={styles.tr}>
              <td style={styles.td}>{u.userId}</td>
              <td style={styles.td}>
                {u.firstName} {u.lastName}
              </td>
              <td style={styles.td}>{u.role}</td>
              <td style={styles.td}>{u.isActive ? 'Active' : 'Deactivated'}</td>
              <td style={styles.td}>
                <button onClick={() => setFormTarget(u)} style={styles.actionButton}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {formTarget && (
        <AccountFormModal
          key={formTarget === 'new' ? 'new' : formTarget.id}
          account={formTarget === 'new' ? undefined : formTarget}
          onClose={() => setFormTarget(null)}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   REQUESTS VIEW (Password Reset Requests with Functional Pagination)
   ========================================================================== */
