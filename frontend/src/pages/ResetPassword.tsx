import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/domainApi';
import { useAuthStore } from '../store/authStore';
import { ROLE_PATH } from '../routes/roleRoutes';

export function ResetPassword() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await authApi.changePassword(newPassword);
      navigate(user?.role ? ROLE_PATH[user.role] : '/', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <form onSubmit={submit} style={styles.card}>
        <h1 style={styles.title}>Set a new password</h1>
        <p style={styles.copy}>Your administrator issued a temporary password. Choose a private password to continue.</p>
        <input style={styles.input} type="password" minLength={8} required placeholder="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        <input style={styles.input} type="password" minLength={8} required placeholder="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.button} disabled={saving}>{saving ? 'Updating...' : 'Update password'}</button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#eef6f8', padding: '24px' },
  card: { width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px', padding: '32px', background: '#fff', border: '1px solid #d9e5e8', borderRadius: '12px', boxShadow: '0 12px 32px rgba(0, 67, 88, 0.1)' },
  title: { margin: 0, color: '#004358', fontSize: '24px' },
  copy: { margin: 0, color: '#52666d', lineHeight: 1.5 },
  input: { padding: '12px', border: '1px solid #b8cbd2', borderRadius: '6px', fontSize: '14px' },
  button: { padding: '12px', border: 0, borderRadius: '6px', background: '#0a5c83', color: '#fff', fontWeight: 700, cursor: 'pointer' },
  error: { margin: 0, color: '#b42318', fontSize: '13px' },
};