import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function ResetPasswordPage() {
  const { clearPasswordReset } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) { setError(error.message); return; }
    setDone(true);
    // Give the user a moment to read the confirmation, then clear the recovery flag
    setTimeout(() => clearPasswordReset(), 2000);
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Reset Password</h1>
        {done ? (
          <p style={styles.success}>Password updated! Redirecting to login…</p>
        ) : (
          <>
            <p style={styles.subtitle}>Choose a new password for your account.</p>
            <form onSubmit={handleSubmit}>
              <div style={styles.field}>
                <label style={styles.label}>New Password</label>
                <input
                  style={styles.input}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="Min. 6 characters"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Confirm Password</label>
                <input
                  style={styles.input}
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="Repeat password"
                />
              </div>
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
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
  success:   { color: '#38A169', fontSize: 16, fontWeight: 600 },
  button:    { width: '100%', padding: 14, background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
};
