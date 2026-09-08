import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
import { authApi } from '../services/domainApi';
import { useAuthStore } from '../store/authStore';
import { ROLE_PATH } from '../routes/roleRoutes';

// Import images from src/Img/
import logoImg from '../Img/Course4Ward-Logo.png';
import bgImg from '../Img/Course4Ward-Background.png';
import foregroundImg from '../Img/Course4Ward-Foreground.png';

const RESET_TOKEN_STORAGE_KEY = 'cims_password_reset_token';

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
  const [resetToken, setResetToken] = useState<string | null>(() =>
    sessionStorage.getItem(RESET_TOKEN_STORAGE_KEY),
  );
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  useEffect(() => {
    if (!resetToken || temporaryPassword) return;

    const checkResetStatus = async () => {
      try {
        const { data } = await authApi.passwordResetStatus(resetToken);
        if (data.status === 'APPROVED' && data.temporaryPassword) {
          setTemporaryPassword(data.temporaryPassword);
          setResetMessage('Your reset request was approved. Use this temporary password to log in.');
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Password reset approved', {
              body: 'Your temporary password is ready on the login page.',
            });
          }
        }
      } catch {
        // Keep polling; a brief network interruption should not lose the notification.
      }
    };

    void checkResetStatus();
    const intervalId = window.setInterval(checkResetStatus, 5000);
    return () => window.clearInterval(intervalId);
  }, [resetToken, temporaryPassword]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data } = await authApi.login(userId, password);
      setAuth(data.accessToken, data.refreshToken, data.user);
      sessionStorage.removeItem(RESET_TOKEN_STORAGE_KEY);

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
    setTemporaryPassword(null);
    setPasswordCopied(false);
    try {
      const { data } = await authApi.requestPasswordReset(resetUserId);
      setResetToken(data.resetToken);
      sessionStorage.setItem(RESET_TOKEN_STORAGE_KEY, data.resetToken);
      setShowReset(false);
      setResetMessage(
        'Your request was submitted. Keep this login page open while an administrator reviews it.'
      );
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
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
      {/* Central Blue Banner / Foreground Section */}
      <div
        style={{
          ...styles.blueBannerContainer,
          backgroundImage: `url(${foregroundImg})`,
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
                <input
                  style={styles.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password..."
                  required
                />
              </div>

              {resetMessage && <p style={styles.info}>{resetMessage}</p>}

              {temporaryPassword && (
                <div style={styles.resetNotification} role="status">
                  <div style={styles.passwordRow}>
                    <strong>Temporary password:</strong>
                    <code style={styles.passwordValue}>{temporaryPassword}</code>
                    <button
                      type="button"
                      aria-label="Copy temporary password"
                      title="Copy temporary password"
                      style={styles.copyButton}
                      onClick={async () => {
                        await navigator.clipboard.writeText(temporaryPassword);
                        setPasswordCopied(true);
                      }}
                    >
                      {passwordCopied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <span>Enter it on the login screen to continue.</span>
                </div>
              )}

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

              {!temporaryPassword && (
                <button style={styles.button} type="submit">
                  Request reset code
                </button>
              )}

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
            <span style={styles.stiersText}>S-TIERS</span>
          </div>
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
    backgroundColor: '#ffffff',
    backgroundRepeat: 'repeat',
    backgroundSize: '900px auto',
    backgroundPosition: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
    boxSizing: 'border-box',
  },
  blueBannerContainer: {
    width: '100%',
    maxWidth: '1080px',
    minHeight: '620px',
    borderRadius: '16px',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    padding: '20px',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '36px 32px 28px 32px',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
    display: 'flex',
    flexDirection: 'column',
  },
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '28px',
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
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
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
    marginTop: '2px',
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
    marginTop: '8px',
    padding: '12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#0a5c83',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#0a5c83',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
    fontWeight: 500,
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
    fontWeight: 700,
    color: '#0f4c81',
    letterSpacing: '0.5px',
  },
  error: { color: '#dc2626', fontSize: '12px', margin: 0 },
  info: { color: '#0a5c83', fontSize: '12px', margin: 0 },
  resetNotification: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #86efac',
    backgroundColor: '#f0fdf4',
    color: '#166534',
    fontSize: '13px',
  },
  passwordRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  passwordValue: {
    padding: '4px 6px',
    borderRadius: '4px',
    backgroundColor: '#dcfce7',
    overflowWrap: 'anywhere',
  },
  copyButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    padding: 0,
    border: '1px solid #86efac',
    borderRadius: '5px',
    backgroundColor: '#ffffff',
    color: '#166534',
    cursor: 'pointer',
  },
};