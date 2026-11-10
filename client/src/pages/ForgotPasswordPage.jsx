import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import { authService } from '../services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ email, code, password });
      setComplete(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="eyebrow">Account recovery</span>
          <h1>Forgot password?</h1>
          <p>Enter the email address linked to your account.</p>
        </div>

        {complete ? (
          <p className="inline-success" role="status">Your password has been updated. You can now sign in.</p>
        ) : (
          <form className="auth-form" onSubmit={sent ? handleReset : handleSubmit}>
            {!sent ? (
              <label className="field-group">
                <span>Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@campus.edu" autoComplete="email" required />
              </label>
            ) : (
              <>
                <p className="inline-success" role="status">If an account exists for that email, a 6-digit code has been sent. The code expires in 10 minutes.</p>
                <label className="field-group">
                  <span>Email verification code</span>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} placeholder="000000" required />
                </label>
                <label className="field-group">
                  <span>New password</span>
                  <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
                </label>
                <label className="field-group">
                  <span>Confirm new password</span>
                  <input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                </label>
              </>
            )}
            {error ? <div className="inline-error" role="alert">{error}</div> : null}
            <Button type="submit" variant="primary" className="full-width" disabled={loading}>
              {loading ? (sent ? 'Updating password...' : 'Sending code...') : (sent ? 'Verify code and reset password' : 'Send verification code')}
            </Button>
          </form>
        )}

        <p className="switch-text"><Link to="/login">Back to login</Link></p>
      </div>
    </div>
  );
}