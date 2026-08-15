import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>IDD Admin</h1>
        <p style={styles.subtitle}>Sign in to manage the platform</p>
        <form onSubmit={handleLogin}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input style={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <div style={styles.forgotRow}>
            <button type="button" style={styles.forgotLink} onClick={() => navigate('/forgot-password')}>
              Forgot password?
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA' },
  card: { background: '#fff', borderRadius: 16, padding: 40, width: 380, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' },
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: '#2D3748' },
  subtitle: { color: '#718096', marginBottom: 28, marginTop: 4 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 14, fontWeight: 600, color: '#2D3748', marginBottom: 6 },
  input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 15, boxSizing: 'border-box' as const },
  forgotRow:  { textAlign: 'center' as const, marginTop: 16 },
  forgotLink: { background: 'none', border: 'none', padding: 0, fontSize: 13, color: '#5B8DB8', cursor: 'pointer', fontWeight: 500 },
  error:  { color: '#E53E3E', fontSize: 14, marginBottom: 12 },
  button: { width: '100%', padding: 14, background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
};
