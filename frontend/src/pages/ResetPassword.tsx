import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../services/domainApi';
import { useAuthStore } from '../store/authStore';
import { ROLE_PATH } from '../routes/roleRoutes';
import { ActionButton } from '../components/ui/DashboardUi';

export function ResetPassword() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // This page sits behind ProtectedRoute, so a plain history back would just
  // bounce off the login redirect. Sign the temporary session out and return
  // the user to the login page instead.
  function handleBack() {
    logout();
    navigate('/login', { replace: true });
  }

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
        <button
          type="button"
          className="auth-back-button"
          onClick={handleBack}
          aria-label="Back to login"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ margin: 0, color: 'var(--dashboard-primary-dark)', fontSize: 24 }}>Set a new password</h1>
        <p style={{ margin: 0, color: 'var(--dashboard-muted)', lineHeight: 1.5 }}>
          Your administrator issued a temporary password. Choose a private password to continue.
        </p>
        <div className="auth-password-wrap">
          <input
            className="auth-input auth-input-password"
            type={showNewPassword ? 'text' : 'password'}
            minLength={8}
            required
            placeholder="New password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <button
            type="button"
            className="auth-toggle-button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
          >
            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="auth-password-wrap">
          <input
            className="auth-input auth-input-password"
            type={showConfirmPassword ? 'text' : 'password'}
            minLength={8}
            required
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <button
            type="button"
            className="auth-toggle-button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <ActionButton className="auth-submit" type="submit" loading={saving}>
          {saving ? 'Updating...' : 'Update password'}
        </ActionButton>
      </form>
    </main>
  );
}