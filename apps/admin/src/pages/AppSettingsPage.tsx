import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AppSettingsPage() {
  const [quotaLimit, setQuotaLimit]       = useState<number>(10);
  const [draftQuota, setDraftQuota]       = useState<string>('10');
  const [savingQuota, setSavingQuota]     = useState(false);
  const [savedQuota, setSavedQuota]       = useState(false);

  const [defaultDuration, setDefaultDuration] = useState<number>(25);
  const [draftDuration, setDraftDuration]     = useState<string>('25');
  const [savingDuration, setSavingDuration]   = useState(false);
  const [savedDuration, setSavedDuration]     = useState(false);

  const [imageTimeout, setImageTimeout]     = useState<number>(65000);
  const [draftTimeout, setDraftTimeout]     = useState<string>('65000');
  const [savingTimeout, setSavingTimeout]   = useState(false);
  const [savedTimeout, setSavedTimeout]     = useState(false);

  const [maxFrames, setMaxFrames]       = useState<number>(4);
  const [draftFrames, setDraftFrames]   = useState<string>('4');
  const [savingFrames, setSavingFrames] = useState(false);
  const [savedFrames, setSavedFrames]   = useState(false);

  const [snapshotLimit, setSnapshotLimit]       = useState<number>(20);
  const [draftSnapshot, setDraftSnapshot]       = useState<string>('20');
  const [savingSnapshot, setSavingSnapshot]     = useState(false);
  const [savedSnapshot, setSavedSnapshot]       = useState(false);

  const [pageSize, setPageSize]         = useState<number>(10);
  const [draftPageSize, setDraftPageSize] = useState<string>('10');
  const [savingPageSize, setSavingPageSize] = useState(false);
  const [savedPageSize, setSavedPageSize]   = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('app_settings').select('tutorial_quota_limit, tutorial_default_duration, tutorial_image_timeout_ms, tutorial_max_frames, report_snapshot_limit, pagination_page_size').single();
    if (data) {
      setQuotaLimit(data.tutorial_quota_limit);
      setDraftQuota(String(data.tutorial_quota_limit));
      setDefaultDuration(data.tutorial_default_duration ?? 25);
      setDraftDuration(String(data.tutorial_default_duration ?? 25));
      setImageTimeout(data.tutorial_image_timeout_ms ?? 65000);
      setDraftTimeout(String(data.tutorial_image_timeout_ms ?? 65000));
      setMaxFrames(data.tutorial_max_frames ?? 4);
      setDraftFrames(String(data.tutorial_max_frames ?? 4));
      setSnapshotLimit(data.report_snapshot_limit ?? 20);
      setDraftSnapshot(String(data.report_snapshot_limit ?? 20));
      setPageSize(data.pagination_page_size ?? 10);
      setDraftPageSize(String(data.pagination_page_size ?? 10));
    }
    setLoading(false);
  }

  async function saveSnapshotLimit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(draftSnapshot, 10);
    if (isNaN(val) || val < 1) return;
    setSavingSnapshot(true);
    await supabase.from('app_settings').update({ report_snapshot_limit: val, updated_at: new Date().toISOString() }).eq('id', 1);
    setSnapshotLimit(val);
    setSavingSnapshot(false);
    setSavedSnapshot(true);
    setTimeout(() => setSavedSnapshot(false), 2500);
  }

  async function saveQuota(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(draftQuota, 10);
    if (isNaN(val) || val < 1) return;
    setSavingQuota(true);
    await supabase.from('app_settings').update({ tutorial_quota_limit: val, updated_at: new Date().toISOString() }).eq('id', 1);
    setQuotaLimit(val);
    setSavingQuota(false);
    setSavedQuota(true);
    setTimeout(() => setSavedQuota(false), 2500);
  }

  async function saveDuration(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(draftDuration, 10);
    if (isNaN(val) || val < 5) return;
    setSavingDuration(true);
    await supabase.from('app_settings').update({ tutorial_default_duration: val, updated_at: new Date().toISOString() }).eq('id', 1);
    setDefaultDuration(val);
    setSavingDuration(false);
    setSavedDuration(true);
    setTimeout(() => setSavedDuration(false), 2500);
  }

  async function saveFrames(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(draftFrames, 10);
    if (isNaN(val) || val < 1) return;
    setSavingFrames(true);
    await supabase.from('app_settings').update({ tutorial_max_frames: val, updated_at: new Date().toISOString() }).eq('id', 1);
    setMaxFrames(val);
    setSavingFrames(false);
    setSavedFrames(true);
    setTimeout(() => setSavedFrames(false), 2500);
  }

  async function saveTimeout(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(draftTimeout, 10);
    if (isNaN(val) || val < 10000) return;
    setSavingTimeout(true);
    await supabase.from('app_settings').update({ tutorial_image_timeout_ms: val, updated_at: new Date().toISOString() }).eq('id', 1);
    setImageTimeout(val);
    setSavingTimeout(false);
    setSavedTimeout(true);
    setTimeout(() => setSavedTimeout(false), 2500);
  }

  async function savePageSize(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(draftPageSize, 10);
    if (isNaN(val) || val < 1) return;
    setSavingPageSize(true);
    await supabase.from('app_settings').update({ pagination_page_size: val, updated_at: new Date().toISOString() }).eq('id', 1);
    setPageSize(val);
    setSavingPageSize(false);
    setSavedPageSize(true);
    setTimeout(() => setSavedPageSize(false), 2500);
  }

  if (loading) return <div style={{ padding: 32 }}>Loading…</div>;

  const dirtyQuota    = parseInt(draftQuota, 10) !== quotaLimit;
  const dirtyDuration = parseInt(draftDuration, 10) !== defaultDuration;
  const dirtyTimeout  = parseInt(draftTimeout, 10) !== imageTimeout;
  const dirtyFrames   = parseInt(draftFrames, 10) !== maxFrames;
  const dirtySnapshot = parseInt(draftSnapshot, 10) !== snapshotLimit;
  const dirtyPageSize = parseInt(draftPageSize, 10) !== pageSize;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={styles.heading}>App Settings</h1>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Tutorial Quota</h2>
        <p style={styles.cardDesc}>
          Monthly limit for AI-generated tutorials per guardian. Applies to all guardians.
          Currently set to <strong>{quotaLimit}</strong>.
        </p>
        <form onSubmit={saveQuota} style={styles.form}>
          <label style={styles.label}>Monthly quota limit</label>
          <div style={styles.inputRow}>
            <input
              type="number" min={1} max={100}
              value={draftQuota} onChange={e => setDraftQuota(e.target.value)}
              style={styles.input}
            />
            <button
              type="submit"
              disabled={savingQuota || !dirtyQuota || parseInt(draftQuota, 10) < 1 || isNaN(parseInt(draftQuota, 10))}
              style={{ ...styles.btn, ...(savingQuota || !dirtyQuota ? styles.btnDisabled : {}) }}
            >
              {savingQuota ? 'Saving…' : 'Save'}
            </button>
          </div>
          {savedQuota && <p style={styles.savedMsg}>✓ Saved successfully</p>}
          {dirtyQuota && !savedQuota && <p style={styles.hint}>Changed from {quotaLimit} → {draftQuota}</p>}
        </form>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Tutorial Default Duration</h2>
        <p style={styles.cardDesc}>
          Duration (in seconds) used when generating AI tutorials. Applies to all new tutorials.
          Currently set to <strong>{defaultDuration}s</strong>.
        </p>
        <form onSubmit={saveDuration} style={styles.form}>
          <label style={styles.label}>Duration (seconds)</label>
          <div style={styles.inputRow}>
            <input
              type="number" min={5} max={120}
              value={draftDuration} onChange={e => setDraftDuration(e.target.value)}
              style={styles.input}
            />
            <button
              type="submit"
              disabled={savingDuration || !dirtyDuration || parseInt(draftDuration, 10) < 5 || isNaN(parseInt(draftDuration, 10))}
              style={{ ...styles.btn, ...(savingDuration || !dirtyDuration ? styles.btnDisabled : {}) }}
            >
              {savingDuration ? 'Saving…' : 'Save'}
            </button>
          </div>
          {savedDuration && <p style={styles.savedMsg}>✓ Saved successfully</p>}
          {dirtyDuration && !savedDuration && <p style={styles.hint}>Changed from {defaultDuration}s → {draftDuration}s</p>}
        </form>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Frames per Tutorial</h2>
        <p style={styles.cardDesc}>
          Number of frames (slides) Claude generates per tutorial. Each frame gets its own image and audio.
          More frames = richer tutorial but higher cost (~$0.04 per extra frame).
          Currently set to <strong>{maxFrames} frames</strong>.
        </p>
        <form onSubmit={saveFrames} style={styles.form}>
          <label style={styles.label}>Max frames</label>
          <div style={styles.inputRow}>
            <input
              type="number" min={1} max={10}
              value={draftFrames} onChange={e => setDraftFrames(e.target.value)}
              style={styles.input}
            />
            <button
              type="submit"
              disabled={savingFrames || !dirtyFrames || parseInt(draftFrames, 10) < 1 || isNaN(parseInt(draftFrames, 10))}
              style={{ ...styles.btn, ...(savingFrames || !dirtyFrames ? styles.btnDisabled : {}) }}
            >
              {savingFrames ? 'Saving…' : 'Save'}
            </button>
          </div>
          {savedFrames && <p style={styles.savedMsg}>✓ Saved successfully</p>}
          {dirtyFrames && !savedFrames && <p style={styles.hint}>Changed from {maxFrames} → {draftFrames} frames</p>}
        </form>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Report Message Snapshot Limit</h2>
        <p style={styles.cardDesc}>
          Number of recent messages saved as evidence when a guardian reports a user.
          Higher values give moderators more context but use more storage.
          Currently set to <strong>{snapshotLimit} messages</strong>.
        </p>
        <form onSubmit={saveSnapshotLimit} style={styles.form}>
          <label style={styles.label}>Messages to snapshot</label>
          <div style={styles.inputRow}>
            <input
              type="number" min={1} max={100}
              value={draftSnapshot} onChange={e => setDraftSnapshot(e.target.value)}
              style={styles.input}
            />
            <button
              type="submit"
              disabled={savingSnapshot || !dirtySnapshot || parseInt(draftSnapshot, 10) < 1 || isNaN(parseInt(draftSnapshot, 10))}
              style={{ ...styles.btn, ...(savingSnapshot || !dirtySnapshot ? styles.btnDisabled : {}) }}
            >
              {savingSnapshot ? 'Saving…' : 'Save'}
            </button>
          </div>
          {savedSnapshot && <p style={styles.savedMsg}>✓ Saved successfully</p>}
          {dirtySnapshot && !savedSnapshot && <p style={styles.hint}>Changed from {snapshotLimit} → {draftSnapshot} messages</p>}
        </form>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>List Pagination Size</h2>
        <p style={styles.cardDesc}>
          Number of records shown per page in the mobile app (discussions, tutorials, etc.).
          Users can load up to 3 pages before being prompted to use filters.
          Currently set to <strong>{pageSize} records</strong> (max {pageSize * 3} before filters nudge).
        </p>
        <form onSubmit={savePageSize} style={styles.form}>
          <label style={styles.label}>Records per page</label>
          <div style={styles.inputRow}>
            <input
              type="number" min={1} max={50}
              value={draftPageSize} onChange={e => setDraftPageSize(e.target.value)}
              style={styles.input}
            />
            <button
              type="submit"
              disabled={savingPageSize || !dirtyPageSize || parseInt(draftPageSize, 10) < 1 || isNaN(parseInt(draftPageSize, 10))}
              style={{ ...styles.btn, ...(savingPageSize || !dirtyPageSize ? styles.btnDisabled : {}) }}
            >
              {savingPageSize ? 'Saving…' : 'Save'}
            </button>
          </div>
          {savedPageSize && <p style={styles.savedMsg}>✓ Saved successfully</p>}
          {dirtyPageSize && !savedPageSize && <p style={styles.hint}>Changed from {pageSize} → {draftPageSize} records</p>}
        </form>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Image Generation Timeout</h2>
        <p style={styles.cardDesc}>
          Maximum time (in milliseconds) to wait for a single DALL·E image call before failing the job.
          All frames generate in parallel so this is the wall-time cap for the image step regardless of frame count.
          Free-tier wall-clock limit is 150s — keep this well below that. Currently set to <strong>{imageTimeout}ms ({imageTimeout / 1000}s)</strong>.
        </p>
        <form onSubmit={saveTimeout} style={styles.form}>
          <label style={styles.label}>Timeout (milliseconds)</label>
          <div style={styles.inputRow}>
            <input
              type="number" min={10000} max={120000} step={1000}
              value={draftTimeout} onChange={e => setDraftTimeout(e.target.value)}
              style={{ ...styles.input, width: 130 }}
            />
            <button
              type="submit"
              disabled={savingTimeout || !dirtyTimeout || parseInt(draftTimeout, 10) < 10000 || isNaN(parseInt(draftTimeout, 10))}
              style={{ ...styles.btn, ...(savingTimeout || !dirtyTimeout ? styles.btnDisabled : {}) }}
            >
              {savingTimeout ? 'Saving…' : 'Save'}
            </button>
          </div>
          {savedTimeout && <p style={styles.savedMsg}>✓ Saved successfully</p>}
          {dirtyTimeout && !savedTimeout && <p style={styles.hint}>Changed from {imageTimeout}ms → {draftTimeout}ms</p>}
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
