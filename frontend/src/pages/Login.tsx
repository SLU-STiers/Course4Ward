import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/domainApi';
import { useAuthStore } from '../store/authStore';

export function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await authApi.login(userId, password);
      setAuth(data.accessToken, data.refreshToken, data.user);
      navigate('/');
    } catch (err: any) {
      navigate('/');
      //setError(err?.response?.data?.message ?? 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setResetMessage(null);
    try {
      await authApi.requestPasswordReset(resetUserId);
      setResetMessage(
        'If that user ID exists, a reset code has been issued. Contact IT desk to retrieve it.',
      );
    } catch {
      setResetMessage('Something went wrong. Please contact the IT desk.');
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>SLU Sacred Heart</h1>
        <p style={styles.subtitle}>Clinical Information Management System</p>

        {!showReset ? (
          <form onSubmit={handleLogin} style={styles.form}>
            <label style={styles.label}>
              User ID
              <input
                style={styles.input}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. DRJ-0231"
                required
              />
            </label>
            <label style={styles.label}>
              Password
              <input
                style={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => setShowReset(true)}
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetRequest} style={styles.form}>
            <label style={styles.label}>
              User ID
              <input
                style={styles.input}
                value={resetUserId}
                onChange={(e) => setResetUserId(e.target.value)}
                required
              />
            </label>
            {resetMessage && <p style={styles.info}>{resetMessage}</p>}
            <button style={styles.button} type="submit">
              Request reset code
            </button>
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => setShowReset(false)}
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    width: 380,
    background: '#ffffff',
    borderRadius: 12,
    padding: '32px 28px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
  },
  title: { margin: 0, fontSize: 22, color: '#0f172a' },
  subtitle: { marginTop: 4, marginBottom: 24, color: '#64748b', fontSize: 13 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', fontSize: 13, color: '#334155', gap: 6 },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    padding: '10px 12px',
    borderRadius: 8,
    border: 'none',
    background: '#0f766e',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#0f766e',
    fontSize: 13,
    cursor: 'pointer',
    padding: 4,
  },
  error: { color: '#dc2626', fontSize: 13, margin: 0 },
  info: { color: '#0f766e', fontSize: 13, margin: 0 },
};
