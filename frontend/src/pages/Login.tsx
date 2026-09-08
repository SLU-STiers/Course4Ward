import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/domainApi';
import { useAuthStore } from '../store/authStore';
import { ROLE_PATH } from '../routes/roleRoutes';

// Import images from src/Img/
import logoImg from '../Img/Course4Ward-Logo.png';
import bgImg from '../Img/Course4Ward-Background.png';
import stiersImg from '../Img/S-tiers.png';
import viewImg from '../Img/view.png';
import hideImg from '../Img/hide.png';

export function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const { data } = await authApi.login(userId, password);
      setAuth(data.accessToken, data.refreshToken, data.user);

      if (data.user.mustResetPassword) {
        navigate('/reset-password');
      } else {
        navigate(ROLE_PATH[data.user.role] ?? '/', { replace: true });
      }
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
      {/* Floating White Login Card */}
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
              <div style={styles.passwordWrapper}>
                <input
                  style={styles.passwordInput}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password..."
                  required
                />
                <button
                  type="button"
                  style={styles.toggleButton}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <img
                    src={showPassword ? hideImg : viewImg}
                    alt={showPassword ? 'Hide password' : 'Show password'}
                    style={styles.toggleIcon}
                  />
                </button>
              </div>
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
          <img
            src={stiersImg}
            alt="S-TIERS"
            style={styles.stiersLogo}
          />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 117, 117, 0.1)',
    backgroundBlendMode: 'darken',
    backgroundRepeat: 'repeat',
    backgroundSize: '900px auto',
    backgroundPosition: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    padding: '40px 36px 32px 36px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08), 0 8px 16px rgba(0, 0, 0, 0.06)',
    display: 'flex',
    flexDirection: 'column',
  },
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '28px',
  },
  logo: {
    height: '85px',
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
    fontSize: '13px',
    fontWeight: 600,
    color: '#64748b',
  },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    color: '#1e293b',
    outline: 'none',
    backgroundColor: '#ffffff',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  passwordInput: {
    width: '100%',
    padding: '12px 42px 12px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    color: '#1e293b',
    outline: 'none',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
  },
  toggleButton: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIcon: {
    width: '20px',
    height: '20px',
    opacity: 0.6,
  },
  optionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    marginTop: '2px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '13px',
  },
  checkbox: {
    cursor: 'pointer',
    accentColor: '#0a5c83',
  },
  button: {
    marginTop: '10px',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0a5c83',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '15px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#0a5c83',
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0,
    fontWeight: 500,
  },
  linkButtonCenter: {
    background: 'none',
    border: 'none',
    color: '#0a5c83',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px',
    marginTop: '6px',
  },
  footer: {
    marginTop: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  footerText: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 500,
  },
  stiersLogo: {
    height: '60px',
    objectFit: 'contain',
  },
  error: { color: '#dc2626', fontSize: '13px', margin: 0 },
  info: { color: '#0a5c83', fontSize: '13px', margin: 0 },
};