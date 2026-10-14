/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { adminApi } from '../../services/domainApi';
import { styles } from './styles';
import type { StaffAccount, Ward } from '../../types';

import { ConfirmationDialog } from './ConfirmationDialog';

export function AccountsPanel() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers().then((r) => r.data),
  });
  const { data: wards = [] } = useQuery({
    queryKey: ['admin-wards'],
    queryFn: () => adminApi.listWards().then((r) => r.data),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    role: '',
    temporaryPassword: '',
    wardIds: [] as string[],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    role: 'NURSE',
    isActive: true,
    wardIds: [] as string[],
  });
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const createUser = useMutation({
    // Only nurses have wards; the server refuses them for any other role.
    mutationFn: () => adminApi.createUser({ ...form, wardIds: form.role === 'NURSE' ? form.wardIds : undefined }),
    onSuccess: () => {
      setForm({ firstName: '', lastName: '', role: '', temporaryPassword: '', wardIds: [] });
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const updateUser = useMutation({
    mutationFn: () =>
      adminApi.updateUser(editingId as string, {
        ...editForm,
        wardIds: editForm.role === 'NURSE' ? editForm.wardIds : undefined,
      }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const beginEdit = (user: StaffAccount) => {
    setEditingId(user.id);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      wardIds: (user.wards ?? []).map(({ ward }) => ward.id),
    });
  };

  return (
    <div style={styles.cardContainer}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: '#0f172a' }}>Staff Accounts</h4>
        <button style={styles.primaryButton} onClick={() => setAddOpen(true)}>
          + Add User
        </button>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>User ID</th>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Role</th>
            <th style={styles.th}>Wards</th>
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
              <td style={styles.td}>
                {u.role === 'NURSE'
                  ? u.wards?.map(({ ward }) => ward.name).join(', ') || 'No ward assigned'
                  : '—'}
              </td>
              <td style={styles.td}>{u.isActive ? 'Active' : 'Deactivated'}</td>
              <td style={styles.td}>
                <button onClick={() => beginEdit(u)} style={styles.actionButton}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal
        open={addOpen}
        // Stay open while its confirmation dialog is on top.
        onClose={() => {
          if (!confirmation) setAddOpen(false);
        }}
        size="sm"
        title="Add Account"
      >
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
            <option value="" disabled>Select a role</option>
            <option value="PHYSICIAN">Physician</option>
            <option value="NURSE">Nurse</option>
            <option value="CLAIMS_PROCESSOR">Claims Processor</option>
            <option value="ADMIN">Admin</option>
          </select>
          {form.role === 'NURSE' && (
            <WardChecklist wards={wards} value={form.wardIds} onChange={(wardIds) => setForm({ ...form, wardIds })} />
          )}
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
      </Modal>

      <Modal
        open={editingId !== null}
        onClose={() => {
          if (!confirmation) setEditingId(null);
        }}
        size="sm"
        title="Edit Account"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            style={styles.formInput}
            placeholder="First name"
            value={editForm.firstName}
            onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
          />
          <input
            style={styles.formInput}
            placeholder="Last name"
            value={editForm.lastName}
            onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
          />
          <select style={styles.formInput} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
            <option value="PHYSICIAN">Physician</option>
            <option value="NURSE">Nurse</option>
            <option value="CLAIMS_PROCESSOR">Claims Processor</option>
            <option value="ADMIN">Admin</option>
          </select>
          {editForm.role === 'NURSE' && (
            <WardChecklist
              wards={wards}
              value={editForm.wardIds}
              onChange={(wardIds) => setEditForm({ ...editForm, wardIds })}
            />
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Active
          </label>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button style={styles.secondaryButton} onClick={() => setEditingId(null)}>Cancel</button>
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
          </div>
        </div>
      </Modal>

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

/** The wards a nurse works in; they see full patient details only there. */
function WardChecklist({
  wards,
  value,
  onChange,
}: {
  wards: Ward[];
  value: string[];
  onChange: (wardIds: string[]) => void;
}) {
  return (
    <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
      <legend style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', padding: '0 4px' }}>Assigned wards</legend>
      {wards.map((ward) => (
        <label key={ward.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '2px 0' }}>
          <input
            type="checkbox"
            checked={value.includes(ward.id)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, ward.id] : value.filter((id) => id !== ward.id))
            }
          />
          {ward.name}
          {ward.holdsUnroomed && <span style={{ color: '#64748b' }}>(patients without a room)</span>}
        </label>
      ))}
      {!wards.length && <span style={{ fontSize: 13, color: '#64748b' }}>No wards set up.</span>}
    </fieldset>
  );
}

/* ==========================================================================
   REQUESTS VIEW (Password Reset Requests with Functional Pagination)
   ========================================================================== */
