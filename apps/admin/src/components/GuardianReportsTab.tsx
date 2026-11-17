import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useVisibleCount } from '../hooks/useVisibleCount';

// One tab of guardian-filed reports (migration 087_guardian_reports.sql):
// guardian chat, discussions (posts + replies), events, guardian profiles.
// Shows who reported whom, the reason, a View-able content snapshot, and Open / Resolved status.
// "Mark resolved" sets status; the database fills resolved_at / resolved_by.
// (Learner-chat reports are a separate table and stay in ReportsPage's own tab.)

export type GuardianReportArea = 'guardian_chat' | 'discussion' | 'event' | 'guardian_profile';

const TABLE: Record<GuardianReportArea, string> = {
  guardian_chat:    'guardian_chat_reports',
  discussion:       'discussion_reports',
  event:            'event_reports',
  guardian_profile: 'guardian_profile_reports',
};

const REASON_LABEL: Record<string, string> = {
  offensive: 'Offensive', spam: 'Spam', harassment: 'Harassment', sensitive: 'Sensitive',
};

type StatusFilter = 'open' | 'resolved' | 'all';

interface GuardianRef { id: string; full_name: string | null; email: string | null }

interface ChatMessage { sender_id: string; content: string; created_at: string }

interface GuardianReport {
  id: string;
  created_at: string;
  reason: string;
  status: 'open' | 'resolved';
  resolved_at: string | null;
  target_type?: 'post' | 'reply';
  message_snapshot?: ChatMessage[];
  content_snapshot?: Record<string, string | null>;
  reporter: GuardianRef | null;
  reported: GuardianRef | null;
}

export default function GuardianReportsTab({ area }: { area: GuardianReportArea }) {
  const table = TABLE[area];
  const [reports, setReports]       = useState<GuardianReport[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [status, setStatus]         = useState<StatusFilter>('open');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId]     = useState<string | null>(null);

  useEffect(() => { load(); }, [area]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    const snapshotCols = area === 'guardian_chat' ? 'message_snapshot' : 'content_snapshot';
    const extraCols    = area === 'discussion' ? ', target_type' : '';
    const { data, error: err } = await supabase
      .from(table)
      .select(`
        id, created_at, reason, status, resolved_at, ${snapshotCols}${extraCols},
        reporter:guardians!${table}_reported_by_guardian_id_fkey(id, full_name, email),
        reported:guardians!${table}_reported_guardian_id_fkey(id, full_name, email)
      `)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setReports((data ?? []) as unknown as GuardianReport[]);
    setLoading(false);
  }

  async function setReportStatus(r: GuardianReport, next: 'open' | 'resolved') {
    setSavingId(r.id);
    const { error: err } = await supabase.from(table).update({ status: next }).eq('id', r.id);
    setSavingId(null);
    if (err) { alert(`Could not update report: ${err.message}`); return; }
    setReports(prev => prev.map(x => x.id === r.id
      ? { ...x, status: next, resolved_at: next === 'resolved' ? new Date().toISOString() : null }
      : x));
  }

  const filtered = useMemo(
    () => reports.filter(r => status === 'all' || r.status === status),
    [reports, status],
  );
  const counts = useMemo(() => ({
    open:     reports.filter(r => r.status === 'open').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  }), [reports]);

  const { visible, showLoadMore, loadMore, showCapMessage, pageSize } = useVisibleCount(filtered, `${area}|${status}`);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error)   return <div style={styles.errorBox}>Failed to load reports: {error}</div>;

  return (
    <>
      <div style={styles.filterBar}>
        {(['open', 'resolved', 'all'] as StatusFilter[]).map(s => (
          <button
            key={s}
            style={{ ...styles.statusBtn, ...(status === s ? styles.statusBtnActive : {}) }}
            onClick={() => setStatus(s)}
          >
            {s === 'open' ? `Open (${counts.open})` : s === 'resolved' ? `Resolved (${counts.resolved})` : `All (${reports.length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={styles.emptyWrap}>
          <div style={styles.emptyIcon}>{reports.length === 0 ? '🛡️' : '✅'}</div>
          <h2 style={styles.emptyTitle}>
            {reports.length === 0 ? 'No reports yet' : status === 'open' ? 'No open reports' : 'Nothing here'}
          </h2>
          <p style={styles.emptyDesc}>
            {reports.length === 0 ? 'Reports from guardians will appear here.' : 'Try a different status filter.'}
          </p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <div style={styles.resultCount}>Showing {visible.length} of {filtered.length} report{filtered.length !== 1 ? 's' : ''}</div>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Reported Guardian', 'Reported By', area === 'discussion' ? 'Item' : null, 'Reason', 'Date', 'Status', 'Content', '']
                  .filter(Boolean)
                  .map((c, i) => <th key={i} style={styles.th}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const expanded = expandedId === r.id;
                const colCount = area === 'discussion' ? 8 : 7;
                return (
                  <React.Fragment key={r.id}>
                    <tr style={{ background: i % 2 === 0 ? '#fff' : '#F7FAFC' }}>
                      <td style={styles.td}><GuardianCell g={r.reported} badge /></td>
                      <td style={styles.td}><GuardianCell g={r.reporter} /></td>
                      {area === 'discussion' && (
                        <td style={styles.td}><span style={styles.itemTag}>{r.target_type === 'reply' ? 'Reply' : 'Post'}</span></td>
                      )}
                      <td style={styles.td}><span style={styles.reasonText}>{REASON_LABEL[r.reason] ?? r.reason}</span></td>
                      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                        <div style={styles.dateCell}>
                          <span>{new Date(r.created_at).toLocaleDateString()}</span>
                          <span style={styles.timeText}>{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        {r.status === 'open'
                          ? <span style={styles.openBadge}>Open</span>
                          : (
                            <div style={styles.dateCell}>
                              <span style={styles.resolvedBadge}>Resolved</span>
                              {r.resolved_at && <span style={styles.timeText}>{new Date(r.resolved_at).toLocaleDateString()}</span>}
                            </div>
                          )}
                      </td>
                      <td style={styles.td}>
                        <button style={styles.viewBtn} onClick={() => setExpandedId(expanded ? null : r.id)}>
                          {expanded ? 'Hide' : 'View'}
                        </button>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <button
                          style={{ ...(r.status === 'open' ? styles.resolveBtn : styles.reopenBtn), ...(savingId === r.id ? styles.busy : {}) }}
                          disabled={savingId !== null}
                          onClick={() => setReportStatus(r, r.status === 'open' ? 'resolved' : 'open')}
                        >
                          {savingId === r.id ? 'Saving…' : r.status === 'open' ? 'Mark resolved' : 'Reopen'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr style={{ background: '#EBF4FF' }}>
                        <td colSpan={colCount} style={styles.snapshotTd}>
                          <Snapshot area={area} r={r} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {showLoadMore && (
            <button style={styles.loadMoreBtn} onClick={loadMore}>Load {Math.min(pageSize, filtered.length - visible.length)} more</button>
          )}
          {showCapMessage && <p style={styles.capMessage}>Use the status filter to narrow down results</p>}
        </div>
      )}
    </>
  );
}

function GuardianCell({ g, badge }: { g: GuardianRef | null; badge?: boolean }) {
  if (!g) return <span style={styles.muted}>Deleted account</span>;
  return (
    <div style={styles.guardianCell}>
      <span style={badge ? styles.reportedBadge : styles.nameText}>{g.full_name ?? '—'}</span>
      {g.email && <span style={styles.emailText}>{g.email}</span>}
    </div>
  );
}

/** The content as it was when reported (copied by the database at report time). */
function Snapshot({ area, r }: { area: GuardianReportArea; r: GuardianReport }) {
  const c = r.content_snapshot ?? {};

  if (area === 'guardian_chat') {
    const msgs = r.message_snapshot ?? [];
    if (msgs.length === 0) return <div style={styles.snapshotHeader}>No messages in this conversation when it was reported.</div>;
    return (
      <>
        <div style={styles.snapshotHeader}>
          Last {msgs.length} message{msgs.length !== 1 ? 's' : ''} between <strong>{r.reporter?.full_name ?? 'reporter'}</strong> and <strong>{r.reported?.full_name ?? 'reported guardian'}</strong>, at the time of the report
        </div>
        <div style={styles.messageList}>
          {msgs.map((m, idx) => {
            const isReporter = m.sender_id === r.reporter?.id;
            return (
              <div key={idx} style={{ ...styles.msgRow, justifyContent: isReporter ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...styles.msgBubble, ...(isReporter ? styles.msgRight : styles.msgLeft) }}>
                  <div style={styles.msgSender}>{isReporter ? r.reporter?.full_name ?? 'Reporter' : r.reported?.full_name ?? 'Reported guardian'}</div>
                  <div style={styles.msgText}>{m.content}</div>
                  <div style={styles.msgTime}>{new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  if (area === 'discussion') {
    return r.target_type === 'reply' ? (
      <div style={styles.snapshotBox}>
        <Field label="On post" value={c.post_title} />
        <Field label="Reply" value={c.content} />
      </div>
    ) : (
      <div style={styles.snapshotBox}>
        <Field label="Title" value={c.title} />
        <Field label="Details" value={c.body} />
      </div>
    );
  }

  if (area === 'event') {
    return (
      <div style={styles.snapshotBox}>
        <Field label="Name" value={c.name} />
        <Field label="Duration" value={c.duration} />
        <Field label="Venue" value={c.venue} />
        <Field label="Description" value={c.description} />
      </div>
    );
  }

  // guardian_profile
  return (
    <div style={{ ...styles.snapshotBox, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      {c.photo_url
        ? <img src={c.photo_url} alt="" style={styles.profilePhoto} />
        : <div style={{ ...styles.profilePhoto, ...styles.noPhoto }}>No photo</div>}
      <Field label="Name" value={c.name} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={styles.field}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{value?.trim() ? value : <span style={styles.muted}>—</span>}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filterBar: {
    display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
    background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px',
  },
  statusBtn: {
    padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    color: '#4A5568', background: '#F7FAFC', border: '1px solid #E2E8F0', borderRadius: 999,
  },
  statusBtnActive: { color: '#fff', background: '#5B8DB8', borderColor: '#5B8DB8' },

  errorBox: { padding: 16, color: '#C53030', background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 8 },

  resultCount: { fontSize: 13, color: '#718096', padding: '10px 16px 6px' },
  loadMoreBtn: {
    display: 'block', margin: '20px auto', padding: '10px 24px',
    fontSize: 14, fontWeight: 600, color: '#5B8DB8',
    background: '#EBF4FF', border: '1px solid #BEE3F8', borderRadius: 8, cursor: 'pointer',
  },
  capMessage: { textAlign: 'center', color: '#A0AEC0', fontSize: 13, fontStyle: 'italic', margin: 16 },

  tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid #E2E8F0', background: '#fff' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#718096',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    background: '#F7FAFC', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap',
  },
  td: { padding: '13px 16px', verticalAlign: 'top', borderBottom: '1px solid #EDF2F7' },

  reportedBadge: {
    display: 'inline-block', fontSize: 13, fontWeight: 700, color: '#C53030', background: '#FFF5F5',
    border: '1px solid #FED7D7', borderRadius: 6, padding: '3px 8px',
  },
  nameText:     { fontSize: 14, color: '#2D3748', fontWeight: 500 },
  guardianCell: { display: 'flex', flexDirection: 'column', gap: 2 },
  emailText:    { fontSize: 12, color: '#A0AEC0' },
  reasonText:   { fontSize: 14, color: '#4A5568' },
  itemTag:      { fontSize: 12, fontWeight: 700, color: '#4A5568', background: '#EDF2F7', borderRadius: 6, padding: '3px 8px' },
  muted:        { color: '#A0AEC0' },
  dateCell:     { display: 'flex', flexDirection: 'column', gap: 2 },
  timeText:     { fontSize: 12, color: '#A0AEC0' },

  openBadge:     { fontSize: 12, fontWeight: 700, color: '#C05621', background: '#FFFAF0', border: '1px solid #FBD38D', borderRadius: 6, padding: '3px 8px' },
  resolvedBadge: { fontSize: 12, fontWeight: 700, color: '#276749', background: '#F0FFF4', border: '1px solid #9AE6B4', borderRadius: 6, padding: '3px 8px', alignSelf: 'flex-start' },

  viewBtn: {
    padding: '5px 12px', fontSize: 13, fontWeight: 600, color: '#5B8DB8', background: '#EBF4FF',
    border: '1px solid #BEE3F8', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  resolveBtn: {
    padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#38A169',
    border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  reopenBtn: {
    padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#4A5568', background: '#EDF2F7',
    border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  busy: { opacity: 0.55, cursor: 'not-allowed' },

  snapshotTd:     { padding: '16px 24px' },
  snapshotHeader: { fontSize: 13, color: '#4A5568', marginBottom: 12 },
  snapshotBox: {
    display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
    background: '#fff', border: '1px solid #BEE3F8', borderRadius: 10,
  },
  field:      { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em' },
  fieldValue: { fontSize: 14, color: '#2D3748', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  profilePhoto: { width: 88, height: 88, borderRadius: 44, objectFit: 'cover' },
  noPhoto:      { display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EDF2F7', color: '#A0AEC0', fontSize: 12 },

  messageList: {
    display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto',
    border: '1px solid #BEE3F8', borderRadius: 10, padding: 12, background: '#fff',
  },
  msgRow:    { display: 'flex' },
  msgBubble: { maxWidth: '65%', borderRadius: 12, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3 },
  msgLeft:   { background: '#F7FAFC', border: '1px solid #E2E8F0', borderBottomLeftRadius: 4 },
  msgRight:  { background: '#EBF4FF', border: '1px solid #BEE3F8', borderBottomRightRadius: 4 },
  msgSender: { fontSize: 11, fontWeight: 700, color: '#718096' },
  msgText:   { fontSize: 14, color: '#2D3748', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  msgTime:   { fontSize: 11, color: '#A0AEC0', textAlign: 'right' },

  emptyWrap:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 12 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#2D3748', margin: 0 },
  emptyDesc:  { fontSize: 14, color: '#718096', textAlign: 'center', maxWidth: 380, margin: 0 },
};
