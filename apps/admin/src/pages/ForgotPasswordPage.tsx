import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const OTP_LENGTH = 6;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');

  async function sendCode() {
    return supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await sendCode();
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStep('code');
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (code.length !== OTP_LENGTH) { setError(`Enter the ${OTP_LENGTH}-digit code from the email.`); return; }

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'recovery',
    });
    setLoading(false);
    if (error) { setError('The code is incorrect or has expired. Please try again.'); setCode(''); return; }
    // AuthContext receives PASSWORD_RECOVERY → ProtectedRoutes renders ResetPasswordPage
    navigate('/dashboard', { replace: true });
  }

  async function handleResend() {
    setError('');
    setLoading(true);
    const { error } = await sendCode();
    setLoading(false);
    if (error) { setError(error.message); return; }
    setCode('');
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Forgot Password</h1>

        {step === 'email' ? (
          <>
            <p style={styles.subtitle}>Enter your email and we'll send you a {OTP_LENGTH}-digit recovery code.</p>
            <form onSubmit={handleSendCode}>
              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input
                  style={styles.input}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="your@email.com"
                />
              </div>
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send Recovery Code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p style={styles.subtitle}>
              We sent a {OTP_LENGTH}-digit code to <strong>{email}</strong>. Enter it below to set a new password.
            </p>
            <form onSubmit={handleVerify}>
              <div style={styles.field}>
                <label style={styles.label}>Recovery Code</label>
                <input
                  style={{ ...styles.input, ...styles.codeInput }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                  maxLength={OTP_LENGTH}
                  required
                  autoFocus
                  placeholder="000000"
                />
              </div>
              {error && <p style={styles.error}>{error}</p>}
              {resent && <p style={styles.success}>A new code has been sent.</p>}
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify Code'}
              </button>
            </form>
            <div style={styles.backRow}>
              <button style={styles.backLink} type="button" onClick={handleResend} disabled={loading}>Resend code</button>
              <span style={styles.separator}>·</span>
              <button style={styles.backLink} type="button" onClick={() => { setStep('email'); setCode(''); setError(''); }}>
                Use a different email
              </button>
            </div>
          </>
        )}

        <div style={styles.backRow}>
          <button style={styles.backLink} type="button" onClick={() => navigate('/login')}>← Back to Sign In</button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA' },
  card:      { background: '#fff', borderRadius: 16, padding: 40, width: 380, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' },
  title:     { margin: 0, fontSize: 28, fontWeight: 700, color: '#2D3748' },
  subtitle:  { color: '#718096', marginBottom: 28, marginTop: 4, lineHeight: '1.5' },
  field:     { marginBottom: 16 },
  label:     { display: 'block', fontSize: 14, fontWeight: 600, color: '#2D3748', marginBottom: 6 },
  input:     { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 15, boxSizing: 'border-box' as const },
  codeInput: { fontSize: 22, letterSpacing: 8, textAlign: 'center' as const, fontVariantNumeric: 'tabular-nums' },
  error:     { color: '#E53E3E', fontSize: 14, marginBottom: 12 },
  success:   { color: '#38A169', fontSize: 14, marginBottom: 12 },
  button:    { width: '100%', padding: 14, background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  backRow:   { textAlign: 'center' as const, marginTop: 16 },
  backLink:  { background: 'none', border: 'none', padding: 0, fontSize: 13, color: '#718096', cursor: 'pointer', fontWeight: 500 },
  separator: { color: '#CBD5E0', margin: '0 8px' },
};
