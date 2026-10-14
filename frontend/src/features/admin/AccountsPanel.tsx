/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { Button, DataTableToolbar, PageHeader, StatusBadge } from '../../components/ui';
import { useTableState } from '../../hooks/useTableState';
import { adminApi } from '../../services/domainApi';
import { styles } from './styles';
import type { StaffAccount, Ward } from '../../types';

import { ConfirmationDialog } from './ConfirmationDialog';

const ROLE_OPTIONS = [
  { value: 'PHYSICIAN', label: 'Physician' },
  { value: 'NURSE', label: 'Nurse' },
  { value: 'CLAIMS_PROCESSOR', label: 'Claims Processor' },
  { value: 'ADMIN', label: 'Admin' },
];

const ROLE_HINTS: Record<string, string> = {
  PHYSICIAN: "Doctor's orders and summaries",
  NURSE: 'Patient care and order execution',
  CLAIMS_PROCESSOR: 'Insurance claims',
  ADMIN: 'Accounts and requests',
};

const MIN_PASSWORD_LENGTH = 8;

const roleLabel = (role: string) => ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;

/** Wards a nurse is assigned to, or a physician's wards / specialties. */
const wardsOf = (user: StaffAccount) =>
  (user.role === 'PHYSICIAN' ? user.physicianWards : user.role === 'NURSE' ? user.wards : undefined) ?? [];

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

  const table = useTableState<StaffAccount>({
    items: users ?? [],
    pageSize: Number.MAX_SAFE_INTEGER,
    searchFields: (user) => [
      user.userId,
      `${user.firstName} ${user.lastName}`,
      user.role,
      ROLE_OPTIONS.find((option) => option.value === user.role)?.label,
      ...wardsOf(user).map(({ ward }) => ward.name),
    ],
    filterPredicates: {
      role: (user, value) => value === 'all' || user.role === value,
      status: (user, value) => value === 'all' || (value === 'active') === user.isActive,
      ward: (user, value) =>
        value === 'all' ||
        (value === 'none'
          ? (user.role === 'NURSE' || user.role === 'PHYSICIAN') && wardsOf(user).length === 0
          : wardsOf(user).some(({ ward }) => ward.id === value)),
    },
    initialFilters: { role: 'all', status: 'all', ward: 'all' },
    sorters: {
      name: (user) => `${user.firstName} ${user.lastName}`.toLowerCase(),
      userId: (user) => user.userId,
      role: (user) => user.role,
    },
    initialSort: { field: 'name', direction: 'ascending' },
  });
  const activeFilterCount = Object.values(table.filters).filter((value) => value !== 'all').length;

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
    mutationFn: () =>
      adminApi.createUser({
        ...form,
        wardIds: ['NURSE', 'PHYSICIAN'].includes(form.role) ? form.wardIds : undefined,
      }),
    onSuccess: () => {
      setForm({ firstName: '', lastName: '', role: '', temporaryPassword: '', wardIds: [] });
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const [showPassword, setShowPassword] = useState(false);
  const openAdd = () => {
    setForm({ firstName: '', lastName: '', role: '', temporaryPassword: '', wardIds: [] });
    setShowPassword(false);
    createUser.reset();
    setAddOpen(true);
  };
  const needsWards = form.role === 'NURSE' || form.role === 'PHYSICIAN';
  const passwordTooShort =
    form.temporaryPassword.length > 0 && form.temporaryPassword.length < MIN_PASSWORD_LENGTH;
  const canCreate =
    Boolean(form.firstName.trim() && form.lastName.trim() && form.role) &&
    form.temporaryPassword.length >= MIN_PASSWORD_LENGTH &&
    !(form.role === 'PHYSICIAN' && form.wardIds.length === 0) &&
    !createUser.isPending;
  const createError = (() => {
    if (!createUser.isError) return null;
    const message = (createUser.error as { response?: { data?: { message?: string | string[] } } })
      ?.response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : message || 'Could not create the account.';
  })();

  const updateUser = useMutation({
    mutationFn: () =>
      adminApi.updateUser(editingId as string, {
        ...editForm,
        wardIds: ['NURSE', 'PHYSICIAN'].includes(editForm.role) ? editForm.wardIds : undefined,
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
      wardIds: (user.role === 'PHYSICIAN' ? user.physicianWards ?? [] : user.wards ?? []).map(
        ({ ward }) => ward.id,
      ),
    });
  };

  return (
    <div style={styles.cardContainer}>
      <PageHeader
        title="Staff Accounts"
        description={
          users
            ? `Manage staff logins, roles and ward assignments · ${users.length} account${users.length === 1 ? '' : 's'}`
            : 'Manage staff logins, roles and ward assignments'
        }
        actions={
          <Button variant="primary" leadingIcon={<UserPlus size={16} aria-hidden="true" />} onClick={openAdd}>
            Add User
          </Button>
        }
      />
      <DataTableToolbar
        searchProps={{
          value: table.query,
          onChange: table.setQuery,
          placeholder: 'Search by name, user ID, role or ward...',
          ariaLabel: 'Search staff accounts',
        }}
        filters={[
          {
            label: 'Role',
            options: [{ value: 'all', label: 'All roles' }, ...ROLE_OPTIONS],
            value: table.filters.role,
            onChange: (value) => table.setFilter('role', value),
          },
          {
            label: 'Status',
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'deactivated', label: 'Deactivated' },
            ],
            value: table.filters.status,
            onChange: (value) => table.setFilter('status', value),
          },
          {
            label: 'Ward / Specialty',
            options: [
              { value: 'all', label: 'All wards' },
              ...wards.map((ward) => ({ value: ward.id, label: ward.name })),
              { value: 'none', label: 'No ward assigned' },
            ],
            value: table.filters.ward,
            onChange: (value) => table.setFilter('ward', value),
          },
        ]}
        activeFilterCount={activeFilterCount}
        onClearFilters={table.resetFilters}
        sortProps={{
          title: 'Sort accounts by',
          options: [
            { value: 'name', label: 'Name' },
            { value: 'userId', label: 'User ID' },
            { value: 'role', label: 'Role' },
          ],
          value: table.sort.field,
          onChange: table.setSortField,
          direction: table.sort.direction,
          onDirectionChange: (direction) => table.setSort({ ...table.sort, direction }),
        }}
      />
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>User ID</th>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Role</th>
            <th style={styles.th}>Wards / Specialties</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((u) => (
            <tr key={u.id} style={styles.tr}>
              <td style={styles.td}>{u.userId}</td>
              <td style={styles.td}>
                {u.firstName} {u.lastName}
              </td>
              <td style={styles.td}>{roleLabel(u.role)}</td>
              <td style={styles.td}>
                {u.role === 'NURSE' || u.role === 'PHYSICIAN'
                  ? (u.role === 'PHYSICIAN' ? u.physicianWards : u.wards)
                      ?.map(({ ward }) => ward.name)
                      .join(', ') || 'No ward assigned'
                  : '—'}
              </td>
              <td style={styles.td}>
                <StatusBadge
                  showDot
                  status={u.isActive ? 'active' : 'neutral'}
                  label={u.isActive ? 'Active' : 'Deactivated'}
                />
              </td>
              <td style={styles.td}>
                <button onClick={() => beginEdit(u)} style={styles.actionButton}>Edit</button>
              </td>
            </tr>
          ))}
          {users && table.rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#64748b' }}>
                No staff accounts match.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Modal
        open={addOpen}
        // Stay open while its confirmation dialog is on top.
        onClose={() => {
          if (!confirmation) setAddOpen(false);
        }}
        size="md"
        title="Add Staff Account"
        description="Create a login for a new staff member. They set their own password after first signing in."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={createUser.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createUser.isPending}
              disabled={!canCreate}
              onClick={() => {
                const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
                setConfirmation({
                  title: 'Create account',
                  message: `Are you sure you want to create a ${roleLabel(form.role)} account for ${fullName}?`,
                  confirmLabel: 'Create Account',
                  onConfirm: () => {
                    setConfirmation(null);
                    createUser.mutate();
                  },
                });
              }}
            >
              Create Account
            </Button>
          </>
        }
      >
        <div style={form_.body}>
          <section style={form_.section}>
            <h5 style={form_.sectionTitle}>Personal details</h5>
            <div style={form_.grid2}>
              <FormField label="First name" htmlFor="add-first-name" required>
                <input
                  id="add-first-name"
                  style={form_.input}
                  placeholder="e.g. Maria"
                  autoComplete="off"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </FormField>
              <FormField label="Last name" htmlFor="add-last-name" required>
                <input
                  id="add-last-name"
                  style={form_.input}
                  placeholder="e.g. Santos"
                  autoComplete="off"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </FormField>
            </div>
          </section>

          <section style={form_.section}>
            <h5 style={form_.sectionTitle}>
              Role <span style={form_.required}>*</span>
            </h5>
            <div role="radiogroup" aria-label="Role" style={form_.roleGrid}>
              {ROLE_OPTIONS.map((option) => {
                const active = form.role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    style={{ ...form_.roleCard, ...(active ? form_.roleCardActive : {}) }}
                    onClick={() =>
                      setForm({
                        ...form,
                        role: option.value,
                        wardIds: option.value === 'NURSE' || option.value === 'PHYSICIAN' ? form.wardIds : [],
                      })
                    }
                  >
                    <span style={{ ...form_.radioDot, ...(active ? form_.radioDotActive : {}) }} aria-hidden="true" />
                    <span>
                      <span style={form_.roleName}>{option.label}</span>
                      <span style={form_.roleHint}>{ROLE_HINTS[option.value]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {needsWards && (
            <section style={form_.section}>
              <WardChecklist
                wards={wards}
                value={form.wardIds}
                onChange={(wardIds) => setForm({ ...form, wardIds })}
                legend={form.role === 'PHYSICIAN' ? 'Wards / specialties' : 'Assigned wards'}
                required={form.role === 'PHYSICIAN'}
              />
              {form.role === 'PHYSICIAN' && form.wardIds.length === 0 && (
                <span role="status" style={form_.hintError}>
                  Assign at least one ward / specialty to this physician.
                </span>
              )}
            </section>
          )}

          <section style={form_.section}>
            <h5 style={form_.sectionTitle}>Sign-in</h5>
            <FormField label="Temporary password" htmlFor="add-temp-password" required>
              <div style={{ position: 'relative' }}>
                <input
                  id="add-temp-password"
                  style={{ ...form_.input, paddingRight: 44, ...(passwordTooShort ? form_.inputInvalid : {}) }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  autoComplete="new-password"
                  value={form.temporaryPassword}
                  onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
                />
                <button
                  type="button"
                  style={form_.eyeButton}
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>
            <span style={passwordTooShort ? form_.hintError : form_.hint}>
              {passwordTooShort
                ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
                : 'Share this password with the staff member securely.'}
            </span>
          </section>

          {createError && (
            <div role="alert" style={form_.errorBox}>
              ⚠ {createError}
            </div>
          )}
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
          {(editForm.role === 'NURSE' || editForm.role === 'PHYSICIAN') && (
            <WardChecklist
              wards={wards}
              value={editForm.wardIds}
              onChange={(wardIds) => setEditForm({ ...editForm, wardIds })}
              legend={editForm.role === 'PHYSICIAN' ? 'Assigned wards / specialties' : 'Assigned wards'}
            />
          )}
          {editForm.role === 'PHYSICIAN' && editForm.wardIds.length === 0 && (
            <span role="status" style={{ fontSize: 13, color: '#b91c1c' }}>
              Assign at least one ward / specialty to this physician.
            </span>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Active
          </label>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button style={styles.secondaryButton} onClick={() => setEditingId(null)}>Cancel</button>
            <button
              style={styles.primaryButton}
              disabled={updateUser.isPending || (editForm.role === 'PHYSICIAN' && !editForm.wardIds.length)}
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

/** Selects one or more wards for a physician specialty or nurse assignment. */
function WardChecklist({
  wards,
  value,
  onChange,
  legend,
  required = false,
}: {
  wards: Ward[];
  value: string[];
  onChange: (wardIds: string[]) => void;
  legend: string;
  required?: boolean;
}) {
  const allSelected = wards.length > 0 && wards.every((ward) => value.includes(ward.id));

  return (
    <fieldset style={form_.fieldset} aria-label={legend}>
      <div style={form_.wardHeader}>
        <span style={form_.sectionTitle}>
          {legend} {required && <span style={form_.required}>*</span>}
        </span>
        <label style={form_.selectAll}>
          <input
            type="checkbox"
            checked={allSelected}
            disabled={!wards.length}
            onChange={(event) => onChange(event.target.checked ? wards.map((ward) => ward.id) : [])}
          />
          Select all
        </label>
      </div>
      <div style={form_.wardGrid}>
        {wards.map((ward) => {
          const checked = value.includes(ward.id);
          return (
            <label key={ward.id} style={{ ...form_.wardOption, ...(checked ? form_.wardOptionActive : {}) }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  onChange(e.target.checked ? [...value, ward.id] : value.filter((id) => id !== ward.id))
                }
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{ward.name}</span>
                {ward.holdsUnroomed && <span style={form_.roleHint}>Patients without a room</span>}
              </span>
            </label>
          );
        })}
      </div>
      {!wards.length && <span style={form_.hint}>No wards set up.</span>}
    </fieldset>
  );
}

function FormField({
  label,
  htmlFor,
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label htmlFor={htmlFor} style={form_.label}>
        {label} {required && <span style={form_.required}>*</span>}
      </label>
      {children}
    </div>
  );
}

const form_: Record<string, CSSProperties> = {
  body: { display: 'flex', flexDirection: 'column', gap: 20 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  label: { fontSize: 13, fontWeight: 600, color: '#0f172a' },
  required: { color: '#dc2626' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    height: 40,
    padding: '0 12px',
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    outline: 'none',
    fontFamily: 'inherit',
  },
  inputInvalid: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  eyeButton: {
    position: 'absolute',
    top: '50%',
    right: 6,
    transform: 'translateY(-50%)',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    background: 'none',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  roleGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 },
  roleCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    textAlign: 'left',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease',
  },
  roleCardActive: {
    borderColor: 'var(--c4w-color-primary, #1d4ed8)',
    backgroundColor: '#eff6ff',
    boxShadow: '0 0 0 1px var(--c4w-color-primary, #1d4ed8)',
  },
  radioDot: {
    flexShrink: 0,
    width: 16,
    height: 16,
    marginTop: 2,
    borderRadius: '50%',
    border: '2px solid #94a3b8',
    boxSizing: 'border-box',
  },
  radioDotActive: {
    borderColor: 'var(--c4w-color-primary, #1d4ed8)',
    boxShadow: 'inset 0 0 0 3px #ffffff',
    backgroundColor: 'var(--c4w-color-primary, #1d4ed8)',
  },
  roleName: { display: 'block', fontSize: 14, fontWeight: 700, color: '#0f172a' },
  roleHint: { display: 'block', marginTop: 2, fontSize: 12, color: '#64748b' },
  fieldset: { border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  wardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectAll: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' },
  wardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
    maxHeight: 220,
    overflowY: 'auto',
  },
  wardOption: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '9px 12px',
    fontSize: 13,
    color: '#0f172a',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    cursor: 'pointer',
  },
  wardOptionActive: { borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  hint: { fontSize: 12, color: '#64748b' },
  hintError: { fontSize: 12, fontWeight: 600, color: '#b91c1c' },
  errorBox: {
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
    color: '#b91c1c',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
  },
};

/* ==========================================================================
   REQUESTS VIEW (Password Reset Requests with Functional Pagination)
   ========================================================================== */
