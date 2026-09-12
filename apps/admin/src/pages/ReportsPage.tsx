import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SnapshotMessage {
  id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
}

interface Report {
  id: string;
  created_at: string;
  reason: string | null;
  message_snapshot: SnapshotMessage[] | null;
  learner: { id: string; name: string } | null;
  reported_learner: { id: string; name: string } | null;
  guardian: { id: string; full_name: string; email: string } | null;
}

interface StatRow {
  learnerId: string;
  name: string;
  count: number;
}

type Tab = 'reports' | 'statistics';

const TABLE_COLS = ['Reported User', 'Reported By', 'Guardian', 'Reason', 'Date', 'Evidence'];

export default function ReportsPage() {
  const [reports, setReports]       = useState<Report[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<Tab>('reports');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [filterReported,   setFilterReported]   = useState('');
  const [filterReportedBy, setFilterReportedBy] = useState('');
  const [filterGuardian,   setFilterGuardian]   = useState('');
  const [filterFrom,       setFilterFrom]       = useState('');
  const [filterTo,         setFilterTo]         = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        id, created_at, reason, message_snapshot,
        learner:user_profiles!reports_learner_id_fkey(id, name),
        reported_learner:user_profiles!reports_reported_learner_id_fkey(id, name),
        guardian:guardians!reports_reported_by_guardian_id_fkey(id, full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) { console.error('Failed to load reports:', error); setLoading(false); return; }
    setReports((data ?? []) as unknown as Report[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (filterReported && !r.reported_learner?.name?.toLowerCase().includes(filterReported.toLowerCase())) return false;
      if (filterReportedBy && !r.learner?.name?.toLowerCase().includes(filterReportedBy.toLowerCase())) return false;
      if (filterGuardian) {
        const g = `${r.guardian?.full_name ?? ''} ${r.guardian?.email ?? ''}`.toLowerCase();
        if (!g.includes(filterGuardian.toLowerCase())) return false;
      }
      if (filterFrom && new Date(r.created_at) < new Date(filterFrom)) return false;
      if (filterTo) {
        const to = new Date(filterTo); to.setHours(23, 59, 59, 999);
        if (new Date(r.created_at) > to) return false;
      }
      return true;
    });
  }, [reports, filterReported, filterReportedBy, filterGuardian, filterFrom, filterTo]);

  const stats: StatRow[] = useMemo(() => {
    const map = new Map<string, StatRow>();
    reports.forEach(r => {
      if (!r.reported_learner) return;
      const { id, name } = r.reported_learner;
      const row = map.get(id);
      if (row) row.count++;
      else map.set(id, { learnerId: id, name, count: 1 });
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [reports]);

  async function handleDelete(row: StatRow) {
    const confirmed = window.confirm(
      `Delete learner "${row.name}"?\n\nThis will permanently delete their account, all messages, friendships, and reports. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(row.learnerId);
    const { error } = await supabase.functions.invoke('delete-learner', {
      body: { learner_id: row.learnerId },
    });
    setDeletingId(null);

    if (error) {
      alert(`Failed to delete learner: ${error.message}`);
      return;
    }

    // Remove from local reports state — stats re-derive automatically
    setReports(prev => prev.filter(r => r.reported_learner?.id !== row.learnerId));
  }

  const hasFilters = filterReported || filterReportedBy || filterGuardian || filterFrom || filterTo;

  function clearFilters() {
    setFilterReported(''); setFilterReportedBy('');
    setFilterGuardian(''); setFilterFrom(''); setFilterTo('');
  }

  if (loading) return <div style={{ padding: 32 }}>Loading…</div>;

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h1 style={styles.heading}>Reports</h1>
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {(['reports', 'statistics'] as Tab[]).map(t => (
          <button
            key={t}
            style={{ ...styles.tabBtn, ...(tab === t ? styles.tabBtnActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === 'reports' ? 'Reported Users' : 'Statistics'}
          </button>
        ))}
      </div>

      {/* ── Reported Users tab ── */}
      {tab === 'reports' && (
        <>
          <div style={styles.filterBar}>
            <input style={styles.filterInput} placeholder="Reported user…"      value={filterReported}   onChange={e => setFilterReported(e.target.value)} />
            <input style={styles.filterInput} placeholder="Reported by…"        value={filterReportedBy} onChange={e => setFilterReportedBy(e.target.value)} />
            <input style={styles.filterInput} placeholder="Guardian name or email…" value={filterGuardian}   onChange={e => setFilterGuardian(e.target.value)} />
            <div style={styles.dateRange}>
              <input type="date" style={styles.dateInput} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From date" />
              <span style={styles.dateSep}>–</span>
              <input type="date" style={styles.dateInput} value={filterTo}   onChange={e => setFilterTo(e.target.value)}   title="To date" />
            </div>
            {hasFilters && <button style={styles.clearBtn} onClick={clearFilters}>Clear</button>}
          </div>

          {filtered.length === 0 ? (
            <div style={styles.emptyWrap}>
              <div style={styles.emptyIcon}>{reports.length === 0 ? '🛡️' : '🔍'}</div>
              <h2 style={styles.emptyTitle}>{reports.length === 0 ? 'No reports yet' : 'No matching reports'}</h2>
              <p style={styles.emptyDesc}>
                {reports.length === 0
                  ? 'When guardians report users, they will appear here with message snapshots.'
                  : 'Try adjusting your filters.'}
              </p>
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <div style={styles.resultCount}>Showing {filtered.length} of {reports.length} report{reports.length !== 1 ? 's' : ''}</div>
              <table style={styles.table}>
                <thead>
                  <tr>{TABLE_COLS.map(col => <th key={col} style={styles.th}>{col}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map((report, i) => {
                    const expanded = expandedId === report.id;
                    const snapshot = report.message_snapshot ?? [];
                    return (
                      <React.Fragment key={report.id}>
                        <tr style={{ background: i % 2 === 0 ? '#fff' : '#F7FAFC' }}>
                          <td style={styles.td}><span style={styles.reportedBadge}>{report.reported_learner?.name ?? '—'}</span></td>
                          <td style={styles.td}><span style={styles.nameText}>{report.learner?.name ?? '—'}</span></td>
                          <td style={styles.td}>
                            <div style={styles.guardianCell}>
                              <span style={styles.nameText}>{report.guardian?.full_name ?? '—'}</span>
                              {report.guardian?.email && <span style={styles.emailText}>{report.guardian.email}</span>}
                            </div>
                          </td>
                          <td style={{ ...styles.td, maxWidth: 260 }}>
                            {report.reason ? <span style={styles.reasonText}>{report.reason}</span> : <span style={styles.muted}>—</span>}
                          </td>
                          <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                            <div style={styles.dateCell}>
                              <span>{new Date(report.created_at).toLocaleDateString()}</span>
                              <span style={styles.timeText}>{new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td style={styles.td}>
                            {snapshot.length > 0
                              ? <button style={styles.viewBtn} onClick={() => setExpandedId(expanded ? null : report.id)}>{expanded ? 'Hide' : 'View'} ({snapshot.length})</button>
                              : <span style={styles.muted}>None</span>}
                          </td>
                        </tr>

                        {expanded && (
                          <tr style={{ background: '#EBF4FF' }}>
                            <td colSpan={6} style={styles.snapshotTd}>
                              <div style={styles.snapshotHeader}>
                                Conversation between <strong>{report.learner?.name}</strong> and <strong>{report.reported_learner?.name}</strong>
                              </div>
                              <div style={styles.messageList}>
                                {snapshot.map((msg, idx) => {
                                  const isReporter = msg.sender_id === report.learner?.id;
                                  return (
                                    <div key={msg.id ?? idx} style={{ ...styles.msgRow, justifyContent: isReporter ? 'flex-end' : 'flex-start' }}>
                                      <div style={{ ...styles.msgBubble, ...(isReporter ? styles.msgRight : styles.msgLeft) }}>
                                        <div style={styles.msgSender}>{isReporter ? report.learner?.name : report.reported_learner?.name}</div>
                                        {msg.content && <div style={styles.msgText}>{msg.content}</div>}
                                        {msg.image_url && <img src={msg.image_url} alt="" style={styles.msgImg} />}
                                        <div style={styles.msgTime}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Statistics tab ── */}
      {tab === 'statistics' && (
        <div style={styles.statsWrap}>
          {stats.length === 0 ? (
            <div style={styles.emptyWrap}>
              <div style={styles.emptyIcon}>📊</div>
              <h2 style={styles.emptyTitle}>No data yet</h2>
              <p style={styles.emptyDesc}>Statistics will appear once users have been reported.</p>
            </div>
          ) : (
            <>
              <p style={styles.statsDesc}>Number of times each learner has been reported by other learners.</p>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>Reported User</th>
                      <th style={styles.th}>Times Reported</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((row, i) => (
                      <tr key={row.learnerId} style={{ background: i % 2 === 0 ? '#fff' : '#F7FAFC' }}>
                        <td style={{ ...styles.td, color: '#A0AEC0', width: 40, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                        <td style={styles.td}><span style={styles.reportedBadge}>{row.name}</span></td>
                        <td style={styles.td}>
                          <div style={styles.countCell}>
                            <div style={{ ...styles.countBar, width: `${Math.round((row.count / stats[0].count) * 100)}%` }} />
                            <span style={styles.countNum}>{row.count}</span>
                          </div>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <button
                            style={{ ...styles.deleteBtn, ...(deletingId === row.learnerId ? styles.deleteBtnBusy : {}) }}
                            disabled={deletingId !== null}
                            onClick={() => handleDelete(row)}
                          >
                            {deletingId === row.learnerId ? 'Deleting…' : 'Delete Learner'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:       { display: 'flex', flexDirection: 'column', gap: 20 },
  pageHeader: { display: 'flex', alignItems: 'center', gap: 12 },
  heading:    { fontSize: 24, fontWeight: 700, color: '#2D3748', margin: 0 },

  tabBar: { display: 'flex', gap: 4, borderBottom: '2px solid #E2E8F0', paddingBottom: 0 },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 20px', fontSize: 14, fontWeight: 600,
    border: 'none', background: 'none', cursor: 'pointer',
    color: '#718096', borderBottom: '2px solid transparent', marginBottom: -2,
  },
  tabBtnActive: { color: '#5B8DB8', borderBottomColor: '#5B8DB8' },


  filterBar: {
    display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
    background: '#fff', border: '1px solid #E2E8F0',
    borderRadius: 10, padding: '14px 16px',
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

  resultCount: { fontSize: 13, color: '#718096', padding: '10px 0 6px' },

  tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid #E2E8F0' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'left', padding: '12px 16px',
    fontSize: 12, fontWeight: 700, color: '#718096',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    background: '#F7FAFC', borderBottom: '1px solid #E2E8F0',
    whiteSpace: 'nowrap',
  },
  td: { padding: '13px 16px', verticalAlign: 'top', borderBottom: '1px solid #EDF2F7' },

  reportedBadge: {
    display: 'inline-block', fontSize: 13, fontWeight: 700,
    color: '#C53030', background: '#FFF5F5',
    border: '1px solid #FED7D7', borderRadius: 6, padding: '3px 8px',
  },
  nameText:    { fontSize: 14, color: '#2D3748', fontWeight: 500 },
  guardianCell: { display: 'flex', flexDirection: 'column', gap: 2 },
  emailText:   { fontSize: 12, color: '#A0AEC0' },
  reasonText:  { fontSize: 14, color: '#4A5568', lineHeight: 1.5 },
  muted:       { color: '#CBD5E0' },
  dateCell:    { display: 'flex', flexDirection: 'column', gap: 2 },
  timeText:    { fontSize: 12, color: '#A0AEC0' },

  viewBtn: {
    padding: '5px 12px', fontSize: 13, fontWeight: 600,
    color: '#5B8DB8', background: '#EBF4FF',
    border: '1px solid #BEE3F8', borderRadius: 6,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },

  snapshotTd:     { padding: '16px 24px' },
  snapshotHeader: { fontSize: 13, color: '#4A5568', marginBottom: 12 },
  messageList: {
    display: 'flex', flexDirection: 'column', gap: 8,
    maxHeight: 360, overflowY: 'auto',
    border: '1px solid #BEE3F8', borderRadius: 10, padding: 12,
    background: '#fff',
  },
  msgRow:    { display: 'flex' },
  msgBubble: { maxWidth: '65%', borderRadius: 12, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3 },
  msgLeft:   { background: '#F7FAFC', border: '1px solid #E2E8F0', borderBottomLeftRadius: 4 },
  msgRight:  { background: '#EBF4FF', border: '1px solid #BEE3F8', borderBottomRightRadius: 4 },
  msgSender: { fontSize: 11, fontWeight: 700, color: '#718096' },
  msgText:   { fontSize: 14, color: '#2D3748', lineHeight: 1.5 },
  msgImg:    { maxWidth: 180, borderRadius: 8 },
  msgTime:   { fontSize: 11, color: '#A0AEC0', textAlign: 'right' },

  statsWrap:  { display: 'flex', flexDirection: 'column', gap: 16 },
  statsDesc:  { fontSize: 14, color: '#718096', margin: 0 },
  countCell:  { display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 },
  countBar:   { height: 8, borderRadius: 4, background: '#FC8181', minWidth: 4, transition: 'width 0.3s ease' },
  countNum:   { fontSize: 15, fontWeight: 700, color: '#C53030', fontVariantNumeric: 'tabular-nums' },

  deleteBtn: {
    padding: '6px 14px', fontSize: 13, fontWeight: 600,
    color: '#fff', background: '#E53E3E',
    border: 'none', borderRadius: 6, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  deleteBtnBusy: { opacity: 0.55, cursor: 'not-allowed' },

  emptyWrap:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 12 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#2D3748', margin: 0 },
  emptyDesc:  { fontSize: 14, color: '#718096', textAlign: 'center', maxWidth: 380, margin: 0 },
};
