import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/domainApi';
import { useAuthStore } from '../store/authStore';
import { ROLE_PATH } from '../routes/roleRoutes';
import { ActionButton } from '../components/ui/DashboardUi';

export function ResetPassword() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
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
      const { data } = await authApi.changePassword(newPassword);
      setAuth(data.accessToken, data.refreshToken, data.user);
      navigate(data.user.role ? ROLE_PATH[data.user.role] : '/', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <form onSubmit={submit} className="auth-card">
        <h1 style={{ margin: 0, color: 'var(--dashboard-primary-dark)', fontSize: 24 }}>Set a new password</h1>
        <p style={{ margin: 0, color: 'var(--dashboard-muted)', lineHeight: 1.5 }}>
          Your administrator issued a temporary password. Choose a private password to continue.
        </p>
        <input
          className="auth-input"
          type="password"
          minLength={8}
          required
          placeholder="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <input
          className="auth-input"
          type="password"
          minLength={8}
          required
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <ActionButton className="auth-submit" type="submit" loading={saving}>
          {saving ? 'Updating...' : 'Update password'}
        </ActionButton>
      </form>
    </main>
  );
}