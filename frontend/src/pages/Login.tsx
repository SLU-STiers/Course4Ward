import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/domainApi';
import { useAuthStore } from '../store/authStore';
import type { Role } from '../types';

// Import images from src/Img/
import logoImg from '../Img/Course4Ward-Logo.png';
import illustrationImg from '../Img/Course4Ward-Illustration.png';
import bgImg from '../Img/Course4Ward-Background.png';

const DEV_REDIRECT_ROLE: Role = 'CLAIMS_PROCESSOR'; // Change this to test different roles in development

const roleRouteMap: Record<Role, string> = {
  PHYSICIAN: '/physician',
  NURSE: '/nurse',
  CLAIMS_PROCESSOR: '/claims',
  ADMIN: '/admin',
};

export function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
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
      if (import.meta.env.DEV) {
        const fakeUser = {
          id: 'dev-user',
          userId: userId || 'dev-admin',
          firstName: 'Dev',
          lastName: DEV_REDIRECT_ROLE,
          role: DEV_REDIRECT_ROLE,
        };

        setAuth('dev-access-token', 'dev-refresh-token', fakeUser);
        navigate(roleRouteMap[DEV_REDIRECT_ROLE], { replace: true });
        return;
      }

      const { data } = await authApi.login(userId, password);
      setAuth(data.accessToken, data.refreshToken, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Login failed. Check your credentials.');
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
        'If that user ID exists, a reset code has been issued. Contact IT desk to retrieve it.'
      );
    } catch {
      setResetMessage('Something went wrong. Please contact the IT desk.');
    }
  }

  return (
    <div
      style={{
        ...styles.page,
        backgroundImage: `url(${bgImg})`,
      }}
    >
      <div style={styles.container}>
        {/* Left Side: Illustration */}
        <div style={styles.illustrationSection}>
          <img
            src={illustrationImg}
            alt="Medical Team Illustration"
            style={styles.illustrationImage}
          />
        </div>

        {/* Right Side: Floating Login Card */}
        <div style={styles.cardWrapper}>
          <div style={styles.card}>
            {/* Logo */}
            <div style={styles.logoContainer}>
              <img
                src={logoImg}
                alt="Course4Ward Logo"
                style={styles.logo}
              />
            </div>

            {!showReset ? (
              <form onSubmit={handleLogin} style={styles.form}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>User ID</label>
                  <input
                    style={styles.input}
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter User ID..."
                    required
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Password</label>
                  <input
                    style={styles.input}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Password..."
                    required
                  />
                </div>

                {error && <p style={styles.error}>{error}</p>}

                {/* Options Row */}
                <div style={styles.optionsRow}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={styles.checkbox}
                    />
                    Remember me
                  </label>

                  <button
                    type="button"
                    style={styles.linkButton}
                    onClick={() => setShowReset(true)}
                  >
                    Forgot Password?
                  </button>
                </div>

                <button style={styles.button} type="submit" disabled={loading}>
                  {loading ? 'Signing in...' : 'Login'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetRequest} style={styles.form}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>User ID</label>
                  <input
                    style={styles.input}
                    value={resetUserId}
                    onChange={(e) => setResetUserId(e.target.value)}
                    placeholder="Enter User ID..."
                    required
                  />
                </div>

                {resetMessage && <p style={styles.info}>{resetMessage}</p>}

                <button style={styles.button} type="submit">
                  Request reset code
                </button>

                <button
                  type="button"
                  style={styles.linkButtonCenter}
                  onClick={() => setShowReset(false)}
                >
                  Back to login
                </button>
              </form>
            )}

            {/* Footer / Developed by */}
            <div style={styles.footer}>
              <span style={styles.footerText}>Developed by:</span>
              <span style={styles.stiersText}>
                🚀 <strong style={{ color: '#0f4c81' }}>S-TIERS</strong>
              </span>
            </div>
          </div>
        </div>
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
    backgroundColor: '#fafafa',
    backgroundRepeat: 'repeat',
    backgroundSize: '800px auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
  },
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '1050px',
    width: '100%',
    gap: '30px',
  },
  illustrationSection: {
    flex: '1 1 55%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationImage: {
    maxWidth: '100%',
    maxHeight: '520px',
    objectFit: 'contain',
    mixBlendMode: 'darken',
  },
  cardWrapper: {
    flex: '0 0 360px',
    display: 'flex',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '36px 30px 28px 30px',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
  },
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '26px',
  },
  logo: {
    height: '42px',
    objectFit: 'contain',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    color: '#1e293b',
    outline: 'none',
    backgroundColor: '#ffffff',
  },
  optionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '12px',
  },
  checkbox: {
    cursor: 'pointer',
    accentColor: '#0a5c83',
  },
  button: {
    marginTop: '6px',
    padding: '12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#0a5c83',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
  linkButtonCenter: {
    background: 'none',
    border: 'none',
    color: '#0a5c83',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px',
    marginTop: '6px',
  },
  footer: {
    marginTop: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  footerText: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: 500,
  },
  stiersText: {
    fontSize: '12px',
    letterSpacing: '0.5px',
  },
  error: { color: '#dc2626', fontSize: '12px', margin: 0 },
  info: { color: '#0a5c83', fontSize: '12px', margin: 0 },
};