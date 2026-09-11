/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/domainApi';
import { styles } from './styles';

import { ConfirmationDialog } from './ConfirmationDialog';

export function AccountsPanel() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers().then((r) => r.data),
  });

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    role: 'NURSE',
    temporaryPassword: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', role: 'NURSE', isActive: true });
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const createUser = useMutation({
    mutationFn: () => adminApi.createUser(form),
    onSuccess: () => {
      setForm({ firstName: '', lastName: '', role: 'NURSE', temporaryPassword: '' });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const updateUser = useMutation({
    mutationFn: () => adminApi.updateUser(editingId as string, editForm),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const beginEdit = (user: any) => {
    setEditingId(user.id);
    setEditForm({ firstName: user.firstName, lastName: user.lastName, role: user.role, isActive: user.isActive });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px' }}>
      <div style={styles.cardContainer}>
        <h4 style={{ marginTop: 0, color: '#0f172a' }}>Add Account</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            style={styles.formInput}
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            style={styles.formInput}
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
          <select
            style={styles.formInput}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="PHYSICIAN">Physician</option>
            <option value="NURSE">Nurse</option>
            <option value="CLAIMS_PROCESSOR">Claims Processor</option>
            <option value="ADMIN">Admin</option>
          </select>
          <input
            style={styles.formInput}
            placeholder="Temporary password"
            type="password"
            value={form.temporaryPassword}
            onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
          />
          <button
            style={styles.primaryButton}
            onClick={() => {
              const fullName = `${form.firstName || 'New'} ${form.lastName || 'User'}`.trim();
              setConfirmation({
                title: 'Create account',
                message: `Are you sure you want to create an account for ${fullName}?`,
                confirmLabel: 'Create Account',
                onConfirm: () => {
                  setConfirmation(null);
                  createUser.mutate();
                },
              });
            }}
          >
            Create Account
          </button>
        </div>
      </div>

      <div style={styles.cardContainer}>
        <h4 style={{ marginTop: 0, color: '#0f172a' }}>Staff Accounts</h4>
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
            {users?.map((u: any) => (
              <tr key={u.id} style={styles.tr}>
                <td style={styles.td}>{u.userId}</td>
                <td style={styles.td}>
                  {u.firstName} {u.lastName}
                </td>
                <td style={styles.td}>{u.role}</td>
                <td style={styles.td}>{u.isActive ? 'Active' : 'Deactivated'}</td>
                <td style={styles.td}>
                  <button onClick={() => beginEdit(u)} style={styles.actionButton}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {editingId && (
          <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px', color: '#0f172a' }}>Edit Account</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input style={styles.formInput} value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              <input style={styles.formInput} value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              <select style={styles.formInput} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="PHYSICIAN">Physician</option>
                <option value="NURSE">Nurse</option>
                <option value="CLAIMS_PROCESSOR">Claims Processor</option>
                <option value="ADMIN">Admin</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Active
              </label>
              <button
                style={styles.primaryButton}
                onClick={() => {
                  const fullName = `${editForm.firstName || 'User'} ${editForm.lastName || ''}`.trim();
                  setConfirmation({
                    title: 'Save account changes',
                    message: `Are you sure you want to save changes for ${fullName}?`,
                    confirmLabel: 'Save Changes',
                    onConfirm: () => {
                      setConfirmation(null);
                      updateUser.mutate();
                    },
                  });
                }}
              >
                Save
              </button>
              <button style={styles.secondaryButton} onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          </div>
        )}
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
    </div>
  );
}

/* ==========================================================================
   REQUESTS VIEW (Password Reset Requests with Functional Pagination)
   ========================================================================== */
