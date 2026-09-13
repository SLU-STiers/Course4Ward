import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../services/domainApi';
import { useAuthStore } from '../store/authStore';
import { ROLE_PATH } from '../routes/roleRoutes';
import { ActionButton } from '../components/ui/DashboardUi';

// Import images from src/Img/
import logoImg from '../Img/Course4Ward-Logo.png';
import bgImg from '../Img/Course4Ward-Background.png';
import stiersImg from '../Img/S-tiers.png';

const RESET_TOKEN_STORAGE_KEY = 'cims_password_reset_token';

const INCORRECT_CREDENTIALS_MESSAGE = 'Invalid credentials. Please check your user ID and password.';

/**
 * Turns a failed-login Axios error into a single, consistent message. The
 * backend can respond with either a plain string (e.g. "Invalid
 * credentials" from a bad User ID/password) or an array of class-validator
 * messages (e.g. "password must be longer than or equal to 8 characters"),
 * but the login form always shows the same friendly wording either way.
 */
function buildLoginErrorMessage(_err: any): string {
  return INCORRECT_CREDENTIALS_MESSAGE;
}

export function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const storedAccessToken = useAuthStore((s) => s.accessToken);
  const storedUser = useAuthStore((s) => s.user);

  // "Remember me" persists the session in localStorage (shared across
  // tabs/windows), so if a remembered session already exists — e.g. the
  // user opens a brand-new tab — skip the login form entirely and drop
  // them straight into their dashboard.
  useEffect(() => {
    if (!storedAccessToken || !storedUser) return;
    if (storedUser.mustResetPassword) {
      navigate('/reset-password', { replace: true });
      return;
    }
    navigate(ROLE_PATH[storedUser.role] ?? '/', { replace: true });
  }, [storedAccessToken, storedUser, navigate]);

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setAuth(data.accessToken, data.refreshToken, data.user, rememberMe);
      sessionStorage.removeItem(RESET_TOKEN_STORAGE_KEY);

      if (data.user.mustResetPassword) {
        navigate('/reset-password');
      } else {
        navigate(ROLE_PATH[data.user.role] ?? '/', { replace: true });
      }
    } catch (err: any) {
      setError(buildLoginErrorMessage(err));
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
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      setResetMessage(
        backendMessage || 'Something went wrong. Please contact the IT desk.'
      );
    }
  }

  return (
    <div
      className="auth-page"
      style={{ backgroundImage: `url(${bgImg})` }}
    >
      {/* Floating White Login Card */}
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo-container">
          <img src={logoImg} alt="Course4Ward Logo" className="auth-logo" />
        </div>

        {!showReset ? (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">User ID</label>
              <input
                className="auth-input"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter User ID..."
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <div className="auth-password-wrap">
                <input
                  className="auth-input auth-input-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password..."
                  required
                />
                <button
                  type="button"
                  className="auth-toggle-button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && <p className="auth-error" role="alert">{error}</p>}
            </div>

            {resetMessage && <p className="auth-info">{resetMessage}</p>}

            {temporaryPassword && (
              <div className="auth-notification" role="status">
                <div className="auth-notification-row">
                  <strong>Temporary password:</strong>
                  <code className="auth-notification-value">{temporaryPassword}</code>
                  <button
                    type="button"
                    aria-label="Copy temporary password"
                    title="Copy temporary password"
                    className="auth-copy-button"
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

            {/* Options Row */}
            <div className="auth-options-row">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  className="auth-checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>

              <button type="button" className="auth-link" onClick={() => setShowReset(true)}>
                Forgot Password?
              </button>
            </div>

            <ActionButton className="auth-submit" type="submit" disabled={loading} loading={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </ActionButton>
          </form>
        ) : (
          <form onSubmit={handleResetRequest} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">User ID</label>
              <input
                className="auth-input"
                value={resetUserId}
                onChange={(e) => setResetUserId(e.target.value)}
                placeholder="Enter User ID..."
                required
              />
            </div>

            {resetMessage && <p className="auth-info">{resetMessage}</p>}

            {!temporaryPassword && (
              <ActionButton className="auth-submit" type="submit">
                Request reset code
              </ActionButton>
            )}

            <button type="button" className="auth-link-center" onClick={() => setShowReset(false)}>
              Back to login
            </button>
          </form>
        )}

        {/* Footer / Developed by */}
        <div className="auth-footer">
          <span className="auth-footer-text">Developed by:</span>
          <img src={stiersImg} alt="S-TIERS" className="auth-footer-logo" />
        </div>
      </div>
    </div>
  );
}