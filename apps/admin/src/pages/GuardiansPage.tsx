import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useVisibleCount } from '../hooks/useVisibleCount';

interface GuardianRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  learnerCount: number;
}

export default function GuardiansPage() {
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');

  useEffect(() => { fetchGuardians(); }, []);

  async function fetchGuardians() {
    const [{ data: guardianData }, { data: profileData }] = await Promise.all([
      supabase.from('guardians').select('id, full_name, email, phone, created_at').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('guardian_id'),
    ]);

    const countByGuardian: Record<string, number> = {};
    (profileData ?? []).forEach((p: any) => {
      if (!p.guardian_id) return;
      countByGuardian[p.guardian_id] = (countByGuardian[p.guardian_id] ?? 0) + 1;
    });

    setGuardians((guardianData ?? []).map((g: any) => ({
      ...g,
      learnerCount: countByGuardian[g.id] ?? 0,
    })));
    setLoading(false);
  }

  const filtered = guardians.filter(g =>
    g.full_name.toLowerCase().includes(search.toLowerCase()) ||
    g.email.toLowerCase().includes(search.toLowerCase()) ||
    (g.phone ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const { visible: visibleGuardians, showLoadMore, loadMore, showCapMessage, pageSize } = useVisibleCount(filtered, search);

  return (
    <div>
      <h1 style={styles.heading}>Guardians</h1>
      <input
        style={styles.search}
        placeholder="Search by name, email, or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? <p>Loading...</p> : (
        <>
          <div style={styles.resultCount}>Showing {visibleGuardians.length} of {filtered.length} guardian{filtered.length !== 1 ? 's' : ''}</div>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'Email', 'Phone', 'Learners', 'Joined'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleGuardians.map(g => (
                <tr key={g.id} style={styles.tr}>
                  <td style={styles.td}><strong>{g.full_name}</strong></td>
                  <td style={styles.td}>{g.email}</td>
                  <td style={styles.td}>{g.phone || '—'}</td>
                  <td style={styles.td}>
                    <span style={styles.badge}>{g.learnerCount}</span>
                  </td>
                  <td style={styles.td}>{new Date(g.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {showLoadMore && (
            <button style={styles.loadMoreBtn} onClick={loadMore}>Load {Math.min(pageSize, filtered.length - visibleGuardians.length)} more</button>
          )}
          {showCapMessage && (
            <p style={styles.capMessage}>Use search to narrow down results</p>
          )}
        </>
      )}
      {!loading && filtered.length === 0 && <p style={styles.empty}>No guardians found.</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 26, fontWeight: 700, color: '#2D3748', marginBottom: 20 },
  search: { width: '100%', maxWidth: 420, padding: '10px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 14, marginBottom: 24, boxSizing: 'border-box' as const },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  th: { padding: '14px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#718096', background: '#F7FAFC', borderBottom: '1px solid #E2E8F0' },
  tr: { borderBottom: '1px solid #E2E8F0' },
  td: { padding: '14px 16px', fontSize: 14, color: '#2D3748' },
  badge: {
    display: 'inline-block', fontSize: 12, fontWeight: 600,
    color: '#5B8DB8', background: '#EBF4FF', borderRadius: 999, padding: '2px 10px',
  },
  empty: { color: '#718096', textAlign: 'center', marginTop: 40 },
  resultCount: { fontSize: 13, color: '#718096', marginBottom: 10 },
  loadMoreBtn: {
    display: 'block', margin: '20px auto 0', padding: '10px 24px',
    fontSize: 14, fontWeight: 600, color: '#5B8DB8',
    background: '#EBF4FF', border: '1px solid #BEE3F8',
    borderRadius: 8, cursor: 'pointer',
  },
  capMessage: { textAlign: 'center', color: '#A0AEC0', fontSize: 13, fontStyle: 'italic', marginTop: 16 },
};
