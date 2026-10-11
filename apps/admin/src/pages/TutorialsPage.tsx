import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useVisibleCount } from '../hooks/useVisibleCount';
import type { Tutorial } from '../../../mobile/src/types';

type Tab = 'library' | 'moderation' | 'upload';

interface PendingTutorial extends Tutorial {
  created_by_guardian_id: string | null;
  guardian_name?: string;
  frame_count?: number;
}

export default function TutorialsPage() {
  const [tab, setTab] = useState<Tab>('library');
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [pending, setPending] = useState<PendingTutorial[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  // Moderation
  const [reviewing, setReviewing] = useState<PendingTutorial | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);
  const [reviewFrames, setReviewFrames] = useState<any[]>([]);

  // Library preview
  const [previewing, setPreviewing] = useState<Tutorial | null>(null);
  const [previewFrames, setPreviewFrames] = useState<any[]>([]);

  // Library filters
  const [filterName,     setFilterName]     = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrom,     setFilterFrom]     = useState('');
  const [filterTo,       setFilterTo]       = useState('');

  useEffect(() => {
    fetchTutorials();
    fetchPending();
    supabase.from('categories').select('id, name').eq('type', 'like').order('name')
      .then(({ data }) => setCategories(data || []));
  }, []);

  async function fetchTutorials() {
    const { data } = await supabase
      .from('tutorials')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    setTutorials(data || []);
    setLoading(false);
  }

  async function fetchPending() {
    const { data } = await supabase
      .from('tutorials')
      .select('*, tutorial_frames(id)')
      .eq('status', 'pending')
      .order('updated_at', { ascending: true });

    if (!data) { setPending([]); return; }

    // Fetch guardian names separately (service role needed for RLS — or adjust RLS)
    const guardianIds = [...new Set(data.filter(t => t.created_by_guardian_id).map(t => t.created_by_guardian_id))];
    let guardianMap: Record<string, string> = {};
    if (guardianIds.length > 0) {
      const { data: guardians } = await supabase.from('guardians').select('id, full_name').in('id', guardianIds);
      (guardians ?? []).forEach((g: any) => { guardianMap[g.id] = g.full_name; });
    }

    setPending(data.map(t => ({
      ...t,
      guardian_name: t.created_by_guardian_id ? guardianMap[t.created_by_guardian_id] ?? 'Unknown Guardian' : 'Admin Upload',
      frame_count: (t as any).tutorial_frames?.length ?? 0,
    })));
  }

  async function openPreview(t: Tutorial) {
    setPreviewing(t);
    const { data: frames } = await supabase
      .from('tutorial_frames')
      .select('*')
      .eq('tutorial_id', t.id)
      .order('order_index', { ascending: true });
    const cacheBust = Date.now();
    setPreviewFrames((frames ?? []).map((f: any) => ({
      ...f,
      image_url: f.image_url ? `${f.image_url.split('?')[0]}?t=${cacheBust}` : f.image_url,
    })));
  }

  async function openReview(t: PendingTutorial) {
    setReviewing(t);
    setRejectNotes('');
    const { data: frames } = await supabase
      .from('tutorial_frames')
      .select('*')
      .eq('tutorial_id', t.id)
      .order('order_index', { ascending: true });
    const cacheBust = Date.now();
    setReviewFrames((frames ?? []).map((f: any) => ({
      ...f,
      image_url: f.image_url ? `${f.image_url.split('?')[0]}?t=${cacheBust}` : f.image_url,
    })));
  }

  async function describeFunctionError(error: any): Promise<string> {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body?.error) return body.error;
      } catch { /* fall through to generic message below */ }
    }
    return error?.message ?? String(error);
  }

  async function approveTutorial(id: string) {
    setActionInProgress(true);
    const { error } = await supabase.functions.invoke('approve-tutorial', { body: { tutorial_id: id } });
    if (error) { alert('Error: ' + await describeFunctionError(error)); } else {
      setPending(prev => prev.filter(t => t.id !== id));
      setReviewing(null);
      fetchTutorials();
    }
    setActionInProgress(false);
  }

  async function rejectTutorial(id: string) {
    if (!rejectNotes.trim()) { alert('Please add notes explaining why you are rejecting this tutorial.'); return; }
    setActionInProgress(true);
    const { error } = await supabase.functions.invoke('reject-tutorial', { body: { tutorial_id: id, admin_notes: rejectNotes } });
    if (error) { alert('Error: ' + await describeFunctionError(error)); } else {
      setPending(prev => prev.filter(t => t.id !== id));
      setReviewing(null);
    }
    setActionInProgress(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const videoFile = videoRef.current?.files?.[0];
    const thumbFile = thumbRef.current?.files?.[0];
    if (!title || !category || !videoFile) { alert('Title, category and video are required'); return; }
    setUploading(true);

    const videoExt = videoFile.name.split('.').pop();
    const videoPath = `${Date.now()}.${videoExt}`;
    const { error: videoError } = await supabase.storage.from('tutorials').upload(videoPath, videoFile);
    if (videoError) { alert('Video upload failed: ' + videoError.message); setUploading(false); return; }
    const { data: { publicUrl: videoUrl } } = supabase.storage.from('tutorials').getPublicUrl(videoPath);

    let thumbnailUrl: string | null = null;
    if (thumbFile) {
      const thumbExt = thumbFile.name.split('.').pop();
      const thumbPath = `thumbs/${Date.now()}.${thumbExt}`;
      await supabase.storage.from('tutorials').upload(thumbPath, thumbFile);
      const { data: { publicUrl } } = supabase.storage.from('tutorials').getPublicUrl(thumbPath);
      thumbnailUrl = publicUrl;
    }

    const { error } = await supabase.from('tutorials').insert({
      title, description, category, video_url: videoUrl, thumbnail_url: thumbnailUrl,
      status: 'approved', source: 'admin_upload', format: 'video',
    });

    if (error) alert('Error saving tutorial: ' + error.message);
    else { setTitle(''); setDescription(''); setCategory(''); fetchTutorials(); }
    setUploading(false);
  }

  async function deleteTutorial(id: string) {
    if (!confirm('Delete this tutorial? This will remove it from all user learning pages.')) return;
    await supabase.from('tutorials').delete().eq('id', id);
    setTutorials(prev => prev.filter(t => t.id !== id));
  }

  const filteredTutorials = useMemo(() => {
    return tutorials.filter(t => {
      const name = ((t as any).display_name || t.title || '').toLowerCase();
      if (filterName && !name.includes(filterName.toLowerCase())) return false;
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterFrom && new Date(t.created_at) < new Date(filterFrom)) return false;
      if (filterTo) {
        const to = new Date(filterTo); to.setHours(23, 59, 59, 999);
        if (new Date(t.created_at) > to) return false;
      }
      return true;
    });
  }, [tutorials, filterName, filterCategory, filterFrom, filterTo]);

  const tutorialsResetKey = `${filterName}|${filterCategory}|${filterFrom}|${filterTo}`;
  const { visible: visibleTutorials, showLoadMore, loadMore, showCapMessage, pageSize } = useVisibleCount(filteredTutorials, tutorialsResetKey);

  const hasLibraryFilters = filterName || filterCategory || filterFrom || filterTo;
  function clearLibraryFilters() {
    setFilterName(''); setFilterCategory(''); setFilterFrom(''); setFilterTo('');
  }

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.heading}>Tutorials</h1>
        <div style={styles.tabGroup}>
          <TabBtn label="Library" active={tab === 'library'} onClick={() => setTab('library')} />
          <TabBtn label={`Moderation${pending.length > 0 ? ` (${pending.length})` : ''}`} active={tab === 'moderation'} onClick={() => setTab('moderation')} badge={pending.length > 0} />
          <TabBtn label="Upload" active={tab === 'upload'} onClick={() => setTab('upload')} />
        </div>
      </div>

      {/* ── LIBRARY TAB ── */}
      {tab === 'library' && (
        <>
          {previewing ? (
            <div style={styles.reviewPanel}>
              <button style={styles.backBtn} onClick={() => setPreviewing(null)}>← Back to library</button>
              <h2 style={styles.reviewTitle}>{previewing.display_name || previewing.title}</h2>
              <div style={styles.reviewMeta}>
                <MetaItem label="Format" value={previewing.format} />
                <MetaItem label="Category" value={previewing.category} />
                {(previewing as any).duration_seconds && <MetaItem label="Duration" value={`${(previewing as any).duration_seconds}s`} />}
                {(previewing as any).comprehension_level && <MetaItem label="Level" value={(previewing as any).comprehension_level} />}
              </div>
              {previewFrames.length > 0
                ? <FrameViewer frames={previewFrames} />
                : <p style={styles.empty}>No frames available for this tutorial.</p>
              }
            </div>
          ) : (
            <>
              <div style={styles.filterBar}>
                <input style={styles.filterInput} placeholder="Search by name…" value={filterName} onChange={e => setFilterName(e.target.value)} />
                <select style={styles.filterInput} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <div style={styles.dateRange}>
                  <input type="date" style={styles.dateInput} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From date" />
                  <span style={styles.dateSep}>–</span>
                  <input type="date" style={styles.dateInput} value={filterTo} onChange={e => setFilterTo(e.target.value)} title="To date" />
                </div>
                {hasLibraryFilters && <button style={styles.clearBtn} onClick={clearLibraryFilters}>Clear</button>}
              </div>

              {loading ? <p>Loading…</p> : (
                <>
                  <div style={styles.resultCount}>Showing {visibleTutorials.length} of {filteredTutorials.length} tutorial{filteredTutorials.length !== 1 ? 's' : ''}</div>
                  <table style={styles.table}>
                    <thead>
                      <tr>{['Title', 'Category', 'Format', 'Source', 'Links', 'Date', 'Actions'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {visibleTutorials.map(t => (
                        <tr key={t.id} style={styles.tr}>
                          <td style={styles.td}>{(t as any).display_name || t.title}</td>
                          <td style={styles.td}><span style={styles.badge}>{t.category}</span></td>
                          <td style={styles.td}><span style={styles.fmtBadge}>{t.format}</span></td>
                          <td style={styles.td}><span style={{ ...styles.badge, background: (t as any).source === 'ai_generated' ? '#EBF8FF' : '#F0FFF4', color: (t as any).source === 'ai_generated' ? '#3182CE' : '#2F855A' }}>{(t as any).source === 'ai_generated' ? 'AI' : 'Admin'}</span></td>
                          <td style={styles.td}>{t.link_count > 0 ? `🔗 ${t.link_count}` : '—'}</td>
                          <td style={styles.td}>{new Date(t.created_at).toLocaleDateString()}</td>
                          <td style={styles.td}>
                            {(t as any).source === 'ai_generated'
                              ? <a style={{ ...styles.viewLink, cursor: 'pointer' }} onClick={() => openPreview(t)}>View</a>
                              : t.video_url && <a href={t.video_url} target="_blank" style={styles.viewLink} rel="noreferrer">View</a>
                            }
                            <button style={{ ...styles.deleteBtn, marginLeft: 8 }} onClick={() => deleteTutorial(t.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {showLoadMore && (
                    <button style={styles.loadMoreBtn} onClick={loadMore}>Load {Math.min(pageSize, filteredTutorials.length - visibleTutorials.length)} more</button>
                  )}
                  {showCapMessage && (
                    <p style={styles.capMessage}>Use filters to narrow down results</p>
                  )}
                </>
              )}
              {!loading && filteredTutorials.length === 0 && <p style={styles.empty}>{tutorials.length === 0 ? 'No approved tutorials yet.' : 'No tutorials match your filters.'}</p>}
            </>
          )}
        </>
      )}

      {/* ── MODERATION TAB ── */}
      {tab === 'moderation' && (
        <div>
          {reviewing ? (
            /* Review panel */
            <div style={styles.reviewPanel}>
              <button style={styles.backBtn} onClick={() => setReviewing(null)}>← Back to queue</button>
              <h2 style={styles.reviewTitle}>{reviewing.display_name || reviewing.title}</h2>

              <div style={styles.reviewMeta}>
                <MetaItem label="Guardian" value={reviewing.guardian_name ?? 'Unknown'} />
                <MetaItem label="Format" value={reviewing.format} />
                <MetaItem label="Duration" value={reviewing.duration_seconds ? `${reviewing.duration_seconds}s` : '—'} />
                <MetaItem label="Level" value={reviewing.comprehension_level} />
                <MetaItem label="Category" value={reviewing.category} />
              </div>

              {/* AI Prompt (audit log) */}
              {reviewing.ai_prompt && (
                <details style={styles.promptDetails}>
                  <summary style={styles.promptSummary}>AI Prompt used (audit log)</summary>
                  <pre style={styles.promptPre}>{reviewing.ai_prompt}</pre>
                </details>
              )}

              {/* Frame viewer */}
              {reviewFrames.length > 0 && <FrameViewer frames={reviewFrames} />}

              {/* Approve / Reject */}
              <div style={styles.reviewActions}>
                <div style={styles.rejectSection}>
                  <label style={styles.rejectLabel}>Rejection Notes (required if rejecting)</label>
                  <textarea
                    style={styles.rejectTextarea}
                    value={rejectNotes}
                    onChange={e => setRejectNotes(e.target.value.slice(0, 250))}
                    placeholder="Explain what needs to change. You can reference specific frame numbers."
                    maxLength={250}
                    rows={4}
                  />
                  <div style={{ fontSize: 11, color: '#999', textAlign: 'right', marginTop: 2 }}>{rejectNotes.length}/250</div>
                </div>
                <div style={styles.reviewBtns}>
                  <button
                    style={{ ...styles.rejectBtn, opacity: actionInProgress ? 0.5 : 1 }}
                    onClick={() => rejectTutorial(reviewing.id)}
                    disabled={actionInProgress}
                  >
                    Reject
                  </button>
                  <button
                    style={{ ...styles.approveBtn, opacity: actionInProgress ? 0.5 : 1 }}
                    onClick={() => approveTutorial(reviewing.id)}
                    disabled={actionInProgress}
                  >
                    Approve & Publish
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Queue list */
            <>
              {pending.length === 0 && <p style={styles.empty}>No tutorials pending review. 🎉</p>}
              {pending.length > 0 && (
                <table style={styles.table}>
                  <thead>
                    <tr>{['Title', 'Guardian', 'Format', 'Duration', 'Frames', 'Submitted', 'Action'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {pending.map(t => (
                      <tr key={t.id} style={styles.tr}>
                        <td style={styles.td}>{(t as any).display_name || t.title}</td>
                        <td style={styles.td}>{t.guardian_name}</td>
                        <td style={styles.td}><span style={styles.fmtBadge}>{t.format}</span></td>
                        <td style={styles.td}>{t.duration_seconds ? `${t.duration_seconds}s` : '—'}</td>
                        <td style={styles.td}>{t.frame_count}</td>
                        <td style={styles.td}>{t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '—'}</td>
                        <td style={styles.td}>
                          <button style={styles.reviewBtn} onClick={() => openReview(t)}>Review</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {/* ── UPLOAD TAB ── */}
      {tab === 'upload' && (
        <div style={styles.form}>
          <h3 style={styles.formTitle}>Upload Admin Tutorial</h3>
          <form onSubmit={handleSubmit}>
            <Field label="Title *" value={title} onChange={setTitle} />
            <div style={styles.field}>
              <label style={styles.label}>Category *</label>
              <select style={styles.input} value={category} onChange={e => setCategory(e.target.value)} required>
                <option value="">Select a category…</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Description</label>
              <textarea style={{ ...styles.input, height: 80, resize: 'vertical' } as React.CSSProperties}
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Video File *</label>
              <input ref={videoRef} type="file" accept="video/*" style={styles.fileInput} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Thumbnail (optional)</label>
              <input ref={thumbRef} type="file" accept="image/*" style={styles.fileInput} />
            </div>
            <button style={styles.submitBtn} type="submit" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload Tutorial'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function FrameViewer({ frames }: { frames: any[] }) {
  const [index, setIndex] = React.useState(0);
  const [autoPlaying, setAutoPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const frame = frames[index];
  const isLast = index === frames.length - 1;

  function advance() {
    setIndex(i => {
      const next = i + 1;
      if (next >= frames.length) { setAutoPlaying(false); return i; }
      return next;
    });
  }

  // When auto-play is on, advance after audio ends or after 4s (no audio)
  React.useEffect(() => {
    if (!autoPlaying) { if (timerRef.current) clearTimeout(timerRef.current); return; }
    if (isLast) { setAutoPlaying(false); return; }

    if (frame?.audio_url) {
      // advance triggered by onEnded on the <audio> element
    } else {
      timerRef.current = setTimeout(advance, 4000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [autoPlaying, index]);

  // Reset to frame 0 whenever frames prop changes (new tutorial opened)
  React.useEffect(() => { setIndex(0); setAutoPlaying(false); }, [frames]);

  function handleManualNav(next: number) {
    setAutoPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setIndex(next);
  }

  return (
    <div style={styles.frameViewer}>
      <div style={styles.frameViewerHeader}>
        <span style={styles.frameCounter}>Frame {index + 1} of {frames.length}</span>
        <div style={styles.frameNavBtns}>
          <button style={styles.frameNavBtn} onClick={() => handleManualNav(Math.max(0, index - 1))} disabled={index === 0}>← Prev</button>
          <button
            style={{ ...styles.frameNavBtn, background: autoPlaying ? '#FED7D7' : '#C6F6D5', color: autoPlaying ? '#C53030' : '#276749', minWidth: 110 }}
            onClick={() => {
              if (!autoPlaying) { setIndex(0); setAutoPlaying(true); }
              else setAutoPlaying(false);
            }}
          >
            {autoPlaying ? '⏸ Pause' : '▶ Auto Play'}
          </button>
          <button style={styles.frameNavBtn} onClick={() => handleManualNav(Math.min(frames.length - 1, index + 1))} disabled={isLast}>Next →</button>
        </div>
      </div>

      {frame?.image_url && (
        <img src={frame.image_url} alt={`Frame ${index + 1}`} style={styles.frameImg} />
      )}

      <div style={styles.frameTextBox}>
        {frame?.caption && <p style={styles.frameCaption}>{frame.caption}</p>}
        {frame?.tts_text && <p style={styles.frameTts}>{frame.tts_text}</p>}
        {frame?.audio_url && (
          <audio
            key={frame.audio_url}
            ref={audioRef}
            src={frame.audio_url}
            controls
            autoPlay
            style={styles.audioPlayer}
            onEnded={() => { if (autoPlaying) advance(); }}
          />
        )}
      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick, badge }: { label: string; active: boolean; onClick: () => void; badge?: boolean }) {
  return (
    <button
      style={{
        ...styles.tabBtn,
        ...(active ? styles.tabBtnActive : {}),
        position: 'relative',
      }}
      onClick={onClick}
    >
      {label}
      {badge && <span style={styles.badgeDot} />}
    </button>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metaItem}>
      <span style={styles.metaLabel}>{label}</span>
      <span style={styles.metaValue}>{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input style={styles.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  heading: { fontSize: 26, fontWeight: 700, color: '#2D3748', margin: 0 },
  tabGroup: { display: 'flex', gap: 8 },
  tabBtn: { background: '#EDF2F7', color: '#4A5568', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  tabBtnActive: { background: '#5B8DB8', color: '#fff' },
  badgeDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: '#E53E3E', display: 'inline-block' },

  filterBar: {
    display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
    background: '#fff', border: '1px solid #E2E8F0',
    borderRadius: 10, padding: '14px 16px', marginBottom: 16,
  },
  filterInput: {
    flex: '1 1 160px', padding: '8px 12px', fontSize: 14,
    border: '1.5px solid #CBD5E0', borderRadius: 8,
    color: '#2D3748', outline: 'none',
  },
  dateRange: { display: 'flex', alignItems: 'center', gap: 6 },
  dateInput: {
    padding: '8px 10px', fontSize: 14,
    border: '1.5px solid #CBD5E0', borderRadius: 8,
    color: '#2D3748', outline: 'none',
  },
  dateSep: { fontSize: 14, color: '#A0AEC0' },
  clearBtn: {
    padding: '8px 16px', fontSize: 13, fontWeight: 600,
    background: '#FFF5F5', color: '#C53030',
    border: '1px solid #FED7D7', borderRadius: 8, cursor: 'pointer',
  },
  resultCount: { fontSize: 13, color: '#718096', padding: '0 0 10px' },
  loadMoreBtn: {
    display: 'block', margin: '20px auto 0', padding: '10px 24px',
    fontSize: 14, fontWeight: 600, color: '#5B8DB8',
    background: '#EBF4FF', border: '1px solid #BEE3F8',
    borderRadius: 8, cursor: 'pointer',
  },
  capMessage: { textAlign: 'center', color: '#A0AEC0', fontSize: 13, fontStyle: 'italic', marginTop: 16 },

  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  th: { padding: '14px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#718096', background: '#F7FAFC', borderBottom: '1px solid #E2E8F0' },
  tr: { borderBottom: '1px solid #E2E8F0' },
  td: { padding: '14px 16px', fontSize: 14, color: '#2D3748' },
  badge: { background: '#EBF4FF', color: '#5B8DB8', borderRadius: 12, padding: '3px 10px', fontSize: 12, fontWeight: 600 },
  fmtBadge: { background: '#F0FFF4', color: '#2F855A', borderRadius: 12, padding: '3px 10px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' },
  viewLink: { color: '#5B8DB8', marginRight: 12, textDecoration: 'none', fontWeight: 500 },
  deleteBtn: { background: 'none', border: '1px solid #E53E3E', color: '#E53E3E', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 },
  reviewBtn: { background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },

  // Review panel
  reviewPanel: { background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  backBtn: { background: 'none', border: 'none', color: '#5B8DB8', cursor: 'pointer', fontWeight: 600, fontSize: 14, padding: 0, marginBottom: 16 },
  reviewTitle: { fontSize: 22, fontWeight: 700, color: '#2D3748', marginBottom: 16 },
  reviewMeta: { display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20 },
  metaItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  metaLabel: { fontSize: 11, fontWeight: 600, color: '#718096', textTransform: 'uppercase' },
  metaValue: { fontSize: 14, fontWeight: 600, color: '#2D3748', textTransform: 'capitalize' },
  promptDetails: { marginBottom: 20 },
  promptSummary: { cursor: 'pointer', fontSize: 13, color: '#5B8DB8', fontWeight: 600 },
  promptPre: { background: '#F7FAFC', borderRadius: 8, padding: 16, fontSize: 12, color: '#4A5568', whiteSpace: 'pre-wrap', marginTop: 8 },

  frameViewer: { background: '#F7FAFC', borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  frameViewerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' },
  frameCounter: { fontSize: 13, fontWeight: 600, color: '#718096' },
  frameNavBtns: { display: 'flex', gap: 8 },
  frameNavBtn: { background: '#EDF2F7', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#4A5568' },
  frameImg: { width: '100%', maxHeight: 360, objectFit: 'contain', background: '#000' },
  frameTextBox: { padding: 16 },
  frameCaption: { fontSize: 20, fontWeight: 700, color: '#2D3748', marginBottom: 6 },
  frameTts: { fontSize: 15, color: '#718096', lineHeight: 1.6, marginBottom: 12 },
  audioPlayer: { width: '100%', marginTop: 8 },

  reviewActions: { borderTop: '1px solid #E2E8F0', paddingTop: 24 },
  rejectSection: { marginBottom: 16 },
  rejectLabel: { display: 'block', fontSize: 14, fontWeight: 600, color: '#2D3748', marginBottom: 8 },
  rejectTextarea: { width: '100%', borderRadius: 8, border: '1px solid #E2E8F0', padding: '10px 12px', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' },
  reviewBtns: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  rejectBtn: { background: '#fff', border: '2px solid #E53E3E', color: '#E53E3E', borderRadius: 10, padding: '12px 28px', cursor: 'pointer', fontWeight: 700, fontSize: 15 },
  approveBtn: { background: '#48BB78', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', cursor: 'pointer', fontWeight: 700, fontSize: 15 },

  form: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  formTitle: { margin: '0 0 20px', color: '#2D3748', fontWeight: 700, fontSize: 18 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 14, fontWeight: 600, color: '#2D3748', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box' as const },
  fileInput: { fontSize: 14 },
  submitBtn: { background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', cursor: 'pointer', fontWeight: 600 },
  empty: { color: '#718096', textAlign: 'center', marginTop: 40, fontSize: 15 },
};
