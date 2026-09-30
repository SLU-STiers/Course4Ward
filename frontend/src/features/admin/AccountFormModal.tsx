/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { adminApi } from '../../services/domainApi';
import { styles } from './styles';
import type { StaffAccount } from '../../types';

import { ConfirmationDialog } from './ConfirmationDialog';

const ROLE_OPTIONS = [
  { value: 'PHYSICIAN', label: 'Physician' },
  { value: 'NURSE', label: 'Nurse' },
  { value: 'CLAIMS_PROCESSOR', label: 'Claims Processor' },
  { value: 'ADMIN', label: 'Admin' },
];

/** Matches the backend's CreateUserDto `@MinLength(8)`. */
const MIN_PASSWORD_LENGTH = 8;

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#334155',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={labelStyle}>
      {label}
      {children}
    </label>
  );
}

function errorMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}

/**
 * Pop-up form for staff accounts. Without `account` it creates a new user;
 * with `account` it edits that user.
 */
export function AccountFormModal({ account, onClose }: { account?: StaffAccount; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = Boolean(account);

  const [form, setForm] = useState({
    firstName: account?.firstName ?? '',
    lastName: account?.lastName ?? '',
    role: account?.role ?? '',
    temporaryPassword: '',
    isActive: account?.isActive ?? true,
  });
  const [confirming, setConfirming] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? adminApi.updateUser(account!.id, {
            firstName: form.firstName,
            lastName: form.lastName,
            role: form.role,
            isActive: form.isActive,
          })
        : adminApi.createUser({
            firstName: form.firstName,
            lastName: form.lastName,
            role: form.role,
            temporaryPassword: form.temporaryPassword,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
  });

  const canSubmit =
    form.firstName.trim() !== '' &&
    form.lastName.trim() !== '' &&
    form.role !== '' &&
    (isEdit || form.temporaryPassword.length >= MIN_PASSWORD_LENGTH) &&
    !save.isPending;

  const fullName = `${form.firstName} ${form.lastName}`.trim();

  return (
    <>
      <Modal
        open
        // Keep the form open while its confirmation dialog is on top of it.
        onClose={() => {
          if (!confirming) onClose();
        }}
        size="sm"
        title={isEdit ? 'Edit Account' : 'Add User'}
        description={
          isEdit
            ? `${account!.firstName} ${account!.lastName} · ${account!.userId}`
            : 'The user will be asked to change the temporary password on first login.'
        }
        footer={
          <>
            <button style={styles.secondaryButton} onClick={onClose}>
              Cancel
            </button>
            <button
              style={{ ...styles.primaryButton, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
              disabled={!canSubmit}
              onClick={() => setConfirming(true)}
            >
              {save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="First name">
            <input
              style={styles.formInput}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Last name">
            <input
              style={styles.formInput}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </Field>
          <Field label="Role">
            <select
              style={styles.formInput}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as StaffAccount['role'] })}
            >
              <option value="" disabled>
                Select a role…
              </option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          {isEdit ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Account is active
            </label>
          ) : (
            <Field label="Temporary password">
              <input
                style={styles.formInput}
                type="password"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                value={form.temporaryPassword}
                onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
              />
            </Field>
          )}
          {save.isError && (
            <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: '13px' }}>
              {errorMessage(save.error, isEdit ? 'Could not save changes. Please try again.' : 'Could not create the account. Please try again.')}
            </p>
          )}
        </div>
      </Modal>
      {confirming && (
        <ConfirmationDialog
          title={isEdit ? 'Save account changes' : 'Create account'}
          message={
            isEdit
              ? `Are you sure you want to save changes for ${fullName}?`
              : `Are you sure you want to create an account for ${fullName}?`
          }
          confirmLabel={isEdit ? 'Save Changes' : 'Create Account'}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            save.mutate();
          }}
        />
      )}
    </>
  );
}
