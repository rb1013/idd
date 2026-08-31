import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AppSettingsPage() {
  const [quotaLimit, setQuotaLimit] = useState<number>(10);
  const [draft, setDraft]           = useState<string>('10');
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('app_settings').select('tutorial_quota_limit').single();
    if (data) {
      setQuotaLimit(data.tutorial_quota_limit);
      setDraft(String(data.tutorial_quota_limit));
    }
    setLoading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(draft, 10);
    if (isNaN(val) || val < 1) return;
    setSaving(true);
    await supabase.from('app_settings').update({ tutorial_quota_limit: val, updated_at: new Date().toISOString() }).eq('id', 1);
    setQuotaLimit(val);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <div style={{ padding: 32 }}>Loading…</div>;

  const dirty = parseInt(draft, 10) !== quotaLimit;

  return (
    <div>
      <h1 style={styles.heading}>App Settings</h1>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Tutorial Quota</h2>
        <p style={styles.cardDesc}>
          Monthly limit for AI-generated tutorials per guardian. Applies to all guardians.
          Currently set to <strong>{quotaLimit}</strong>.
        </p>

        <form onSubmit={save} style={styles.form}>
          <label style={styles.label}>Monthly quota limit</label>
          <div style={styles.inputRow}>
            <input
              type="number"
              min={1}
              max={100}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              style={styles.input}
            />
            <button
              type="submit"
              disabled={saving || !dirty || parseInt(draft, 10) < 1 || isNaN(parseInt(draft, 10))}
              style={{ ...styles.btn, ...(saving || !dirty ? styles.btnDisabled : {}) }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {saved && <p style={styles.savedMsg}>✓ Saved successfully</p>}
          {dirty && !saved && (
            <p style={styles.hint}>Changed from {quotaLimit} → {draft}</p>
          )}
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 24, fontWeight: 700, color: '#2D3748', marginBottom: 24 },

  card: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #E2E8F0', padding: 28, maxWidth: 480,
  },
  cardTitle: { fontSize: 17, fontWeight: 700, color: '#2D3748', marginBottom: 6 },
  cardDesc:  { fontSize: 14, color: '#718096', lineHeight: 1.6, marginBottom: 20 },

  form:     { display: 'flex', flexDirection: 'column', gap: 8 },
  label:    { fontSize: 13, fontWeight: 600, color: '#4A5568' },
  inputRow: { display: 'flex', gap: 10, alignItems: 'center' },
  input: {
    width: 100, padding: '9px 12px', fontSize: 15,
    border: '1.5px solid #CBD5E0', borderRadius: 8,
    color: '#2D3748', outline: 'none',
  },
  btn: {
    padding: '9px 20px', background: '#5B8DB8', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  savedMsg: { fontSize: 13, color: '#38A169', fontWeight: 600, margin: 0 },
  hint:     { fontSize: 13, color: '#718096', margin: 0 },
};
