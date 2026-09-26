import React, { useEffect, useRef, useState } from 'react';
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

  const [tutorialWindow, setTutorialWindow]       = useState<number>(48);
  const [draftTutorialWindow, setDraftTutorialWindow] = useState<string>('48');
  const [savingTutorialWindow, setSavingTutorialWindow] = useState(false);
  const [savedTutorialWindow, setSavedTutorialWindow]   = useState(false);

  const [discussionLimit, setDiscussionLimit]       = useState<number>(30);
  const [draftDiscussionLimit, setDraftDiscussionLimit] = useState<string>('30');
  const [savingDiscussionLimit, setSavingDiscussionLimit] = useState(false);
  const [savedDiscussionLimit, setSavedDiscussionLimit]   = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('app_settings').select('tutorial_quota_limit, tutorial_default_duration, tutorial_image_timeout_ms, tutorial_max_frames, report_snapshot_limit, pagination_page_size, notif_tutorial_window_hours, notif_discussion_limit').single();
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
      setTutorialWindow(data.notif_tutorial_window_hours ?? 48);
      setDraftTutorialWindow(String(data.notif_tutorial_window_hours ?? 48));
      setDiscussionLimit(data.notif_discussion_limit ?? 30);
      setDraftDiscussionLimit(String(data.notif_discussion_limit ?? 30));
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

  async function saveTutorialWindow(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(draftTutorialWindow, 10);
    if (isNaN(val) || val < 1) return;
    setSavingTutorialWindow(true);
    await supabase.from('app_settings').update({ notif_tutorial_window_hours: val, updated_at: new Date().toISOString() }).eq('id', 1);
    setTutorialWindow(val);
    setSavingTutorialWindow(false);
    setSavedTutorialWindow(true);
    setTimeout(() => setSavedTutorialWindow(false), 2500);
  }

  async function saveDiscussionLimit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(draftDiscussionLimit, 10);
    if (isNaN(val) || val < 1) return;
    setSavingDiscussionLimit(true);
    await supabase.from('app_settings').update({ notif_discussion_limit: val, updated_at: new Date().toISOString() }).eq('id', 1);
    setDiscussionLimit(val);
    setSavingDiscussionLimit(false);
    setSavedDiscussionLimit(true);
    setTimeout(() => setSavedDiscussionLimit(false), 2500);
  }

  if (loading) return <div style={{ padding: 32 }}>Loading…</div>;

  const dirtyTutorialWindow  = parseInt(draftTutorialWindow, 10) !== tutorialWindow;
  const dirtyDiscussionLimit = parseInt(draftDiscussionLimit, 10) !== discussionLimit;
  const dirtyQuota    = parseInt(draftQuota, 10) !== quotaLimit;
  const dirtyDuration = parseInt(draftDuration, 10) !== defaultDuration;
  const dirtyTimeout  = parseInt(draftTimeout, 10) !== imageTimeout;
  const dirtyFrames   = parseInt(draftFrames, 10) !== maxFrames;
  const dirtySnapshot = parseInt(draftSnapshot, 10) !== snapshotLimit;
  const dirtyPageSize = parseInt(draftPageSize, 10) !== pageSize;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <h1 style={styles.heading}>App Settings</h1>

      <SectionCard title="Tutorials">
        <SettingRow
          label="Tutorial Quota"
          description="Monthly limit for AI-generated tutorials per guardian. Applies to all guardians."
          draft={draftQuota} onDraftChange={setDraftQuota} onSave={saveQuota}
          saving={savingQuota} saved={savedQuota} dirty={dirtyQuota}
          invalid={isNaN(parseInt(draftQuota, 10)) || parseInt(draftQuota, 10) < 1}
          min={1} max={100}
        />
        <SettingRow
          label="Tutorial Default Duration"
          description="Duration (in seconds) used when generating AI tutorials. Applies to all new tutorials."
          draft={draftDuration} onDraftChange={setDraftDuration} onSave={saveDuration}
          saving={savingDuration} saved={savedDuration} dirty={dirtyDuration}
          invalid={isNaN(parseInt(draftDuration, 10)) || parseInt(draftDuration, 10) < 5}
          min={5} max={120}
        />
        <SettingRow
          label="Frames per Tutorial"
          description="Number of frames (slides) Claude generates per tutorial. Each frame gets its own image and audio. More frames = richer tutorial but higher cost (~$0.04 per extra frame)."
          draft={draftFrames} onDraftChange={setDraftFrames} onSave={saveFrames}
          saving={savingFrames} saved={savedFrames} dirty={dirtyFrames}
          invalid={isNaN(parseInt(draftFrames, 10)) || parseInt(draftFrames, 10) < 1}
          min={1} max={10}
        />
        <SettingRow
          label="Image Generation Timeout"
          description="Maximum time (in milliseconds) to wait for a single DALL·E image call before failing the job. All frames generate in parallel so this is the wall-time cap for the image step regardless of frame count. Free-tier wall-clock limit is 150s — keep this well below that."
          draft={draftTimeout} onDraftChange={setDraftTimeout} onSave={saveTimeout}
          saving={savingTimeout} saved={savedTimeout} dirty={dirtyTimeout}
          invalid={isNaN(parseInt(draftTimeout, 10)) || parseInt(draftTimeout, 10) < 10000}
          min={10000} max={120000} step={1000} inputWidth={110}
        />
      </SectionCard>

      <SectionCard title="Reports">
        <SettingRow
          label="Report Message Snapshot Limit"
          description="Number of recent messages saved as evidence when a guardian reports a user. Higher values give moderators more context but use more storage."
          draft={draftSnapshot} onDraftChange={setDraftSnapshot} onSave={saveSnapshotLimit}
          saving={savingSnapshot} saved={savedSnapshot} dirty={dirtySnapshot}
          invalid={isNaN(parseInt(draftSnapshot, 10)) || parseInt(draftSnapshot, 10) < 1}
          min={1} max={100}
        />
      </SectionCard>

      <SectionCard title="Pagination">
        <SettingRow
          label="List Pagination Size"
          description="Number of records shown per page in the mobile app (discussions, tutorials, etc.). Users can load up to 3 pages before being prompted to use filters."
          draft={draftPageSize} onDraftChange={setDraftPageSize} onSave={savePageSize}
          saving={savingPageSize} saved={savedPageSize} dirty={dirtyPageSize}
          invalid={isNaN(parseInt(draftPageSize, 10)) || parseInt(draftPageSize, 10) < 1}
          min={1} max={50}
        />
      </SectionCard>

      <SectionCard title="Notifications">
        <SettingRow
          label="Tutorial Notification Window"
          description="How many hours back the app shows tutorial approval/rejection notifications. Older notifications are hidden automatically."
          draft={draftTutorialWindow} onDraftChange={setDraftTutorialWindow} onSave={saveTutorialWindow}
          saving={savingTutorialWindow} saved={savedTutorialWindow} dirty={dirtyTutorialWindow}
          invalid={isNaN(parseInt(draftTutorialWindow, 10)) || parseInt(draftTutorialWindow, 10) < 1}
          min={1} max={168}
        />
        <SettingRow
          label="Discussion Notification Limit"
          description="Maximum number of unread discussion reply notifications shown to a guardian. Only unread notifications are fetched."
          draft={draftDiscussionLimit} onDraftChange={setDraftDiscussionLimit} onSave={saveDiscussionLimit}
          saving={savingDiscussionLimit} saved={savedDiscussionLimit} dirty={dirtyDiscussionLimit}
          invalid={isNaN(parseInt(draftDiscussionLimit, 10)) || parseInt(draftDiscussionLimit, 10) < 1}
          min={1} max={200}
        />
      </SectionCard>
    </div>
  );
}

// ── Shared row/section components ────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <div>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.sectionCard}>
        {items.map((child, i) => (
          <div key={i} style={i < items.length - 1 ? styles.rowDivider : undefined}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  invalid: boolean;
  min?: number;
  max?: number;
  step?: number;
  inputWidth?: number;
}

function SettingRow({
  label, description, draft, onDraftChange, onSave,
  saving, saved, dirty, invalid, min, max, step, inputWidth,
}: SettingRowProps) {
  return (
    <form onSubmit={onSave} style={styles.row}>
      <div style={styles.rowLeft}>
        <InfoPopover text={description} />
        <span style={styles.rowLabel}>{label}</span>
      </div>
      <div style={styles.rowRight}>
        <input
          type="number" min={min} max={max} step={step}
          value={draft} onChange={e => onDraftChange(e.target.value)}
          style={{ ...styles.input, ...(inputWidth ? { width: inputWidth } : {}) }}
        />
        <button
          type="submit"
          disabled={saving || !dirty || invalid}
          style={{ ...styles.btn, ...((saving || !dirty || invalid) ? styles.btnDisabled : {}), ...(saved ? styles.btnSaved : {}) }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={ref} style={styles.infoWrap}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ ...styles.infoBtn, ...(open ? styles.infoBtnActive : {}) }}
        aria-label="More info"
      >
        ⓘ
      </button>
      {open && (
        <div style={styles.popover}>
          {text}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 24, fontWeight: 700, color: '#2D3748', margin: 0 },

  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: '#2D3748',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    margin: '0 0 8px 2px', textAlign: 'left',
  },
  sectionCard: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #E2E8F0', maxWidth: 640,
    overflow: 'visible',
  },
  rowDivider: { borderBottom: '1px solid #EDF2F7' },

  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 12,
    padding: '14px 18px',
  },
  rowLeft: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  rowLabel: { fontSize: 14, fontWeight: 600, color: '#2D3748', whiteSpace: 'nowrap' },
  rowRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },

  input: {
    width: 80, padding: '7px 10px', fontSize: 14,
    border: '1.5px solid #CBD5E0', borderRadius: 8,
    color: '#2D3748', outline: 'none',
  },
  btn: {
    padding: '7px 16px', background: '#5B8DB8', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 76,
  },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  btnSaved: { background: '#38A169' },

  // Info icon + popover
  infoWrap: { position: 'relative', display: 'inline-flex', flexShrink: 0 },
  infoBtn: {
    width: 24, height: 24, borderRadius: '50%',
    border: 'none', background: '#5B8DB8',
    color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', padding: 0, flexShrink: 0,
  },
  infoBtnActive: { background: '#3E6B93' },
  popover: {
    position: 'absolute', top: '130%', left: 0, zIndex: 20,
    width: 280, background: '#2D3748', color: '#F7FAFC',
    borderRadius: 10, padding: '12px 14px',
    fontSize: 13, lineHeight: 1.55, fontWeight: 400,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  },
};
