import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Forgot Password</h1>

        {sent ? (
          <>
            <p style={styles.success}>Recovery email sent to <strong>{email}</strong>. Check your inbox and follow the link to reset your password.</p>
            <button style={styles.backBtn} onClick={() => navigate('/login')}>Back to Sign In</button>
          </>
        ) : (
          <>
            <p style={styles.subtitle}>Enter your email and we'll send you a recovery link.</p>
            <form onSubmit={handleSubmit}>
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
                {loading ? 'Sending…' : 'Send Recovery Email'}
              </button>
            </form>
            <div style={styles.backRow}>
              <button style={styles.backLink} type="button" onClick={() => navigate('/login')}>← Back to Sign In</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA' },
  card:      { background: '#fff', borderRadius: 16, padding: 40, width: 380, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' },
  title:     { margin: 0, fontSize: 28, fontWeight: 700, color: '#2D3748' },
  subtitle:  { color: '#718096', marginBottom: 28, marginTop: 4 },
  field:     { marginBottom: 16 },
  label:     { display: 'block', fontSize: 14, fontWeight: 600, color: '#2D3748', marginBottom: 6 },
  input:     { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 15, boxSizing: 'border-box' as const },
  error:     { color: '#E53E3E', fontSize: 14, marginBottom: 12 },
  success:   { color: '#38A169', fontSize: 15, lineHeight: '1.5', marginTop: 8 },
  button:    { width: '100%', padding: 14, background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  backRow:   { textAlign: 'center' as const, marginTop: 16 },
  backLink:  { background: 'none', border: 'none', padding: 0, fontSize: 13, color: '#718096', cursor: 'pointer', fontWeight: 500 },
  backBtn:   { marginTop: 20, width: '100%', padding: 14, background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
};
