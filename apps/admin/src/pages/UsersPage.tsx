import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useVisibleCount } from '../hooks/useVisibleCount';

interface UserRow {
  id: string;
  name: string;
  age: number;
  gender: string;
  city: string;
  created_at: string;
  guardians: { full_name: string; email: string };
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    const { data } = await supabase
      .from('user_profiles')
      .select('*, guardians(full_name, email)')
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.city.toLowerCase().includes(search.toLowerCase()) ||
    u.guardians?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const { visible: visibleUsers, showLoadMore, loadMore, showCapMessage, pageSize } = useVisibleCount(filtered, search);

  return (
    <div>
      <h1 style={styles.heading}>Users</h1>
      <input
        style={styles.search}
        placeholder="Search by name, city, or guardian email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? <p>Loading...</p> : (
        <>
          <div style={styles.resultCount}>Showing {visibleUsers.length} of {filtered.length} user{filtered.length !== 1 ? 's' : ''}</div>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'Age', 'Gender', 'City', 'Guardian', 'Joined'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map(u => (
                <tr key={u.id} style={styles.tr}>
                  <td style={styles.td}><strong>{u.name}</strong></td>
                  <td style={styles.td}>{u.age}</td>
                  <td style={styles.td}>{u.gender}</td>
                  <td style={styles.td}>{u.city}</td>
                  <td style={styles.td}>
                    <div style={styles.guardianName}>{u.guardians?.full_name}</div>
                    <div style={styles.guardianEmail}>{u.guardians?.email}</div>
                  </td>
                  <td style={styles.td}>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {showLoadMore && (
            <button style={styles.loadMoreBtn} onClick={loadMore}>Load {Math.min(pageSize, filtered.length - visibleUsers.length)} more</button>
          )}
          {showCapMessage && (
            <p style={styles.capMessage}>Use search to narrow down results</p>
          )}
        </>
      )}
      {!loading && filtered.length === 0 && <p style={styles.empty}>No users found.</p>}
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
  guardianName: { fontWeight: 500 },
  guardianEmail: { fontSize: 12, color: '#718096' },
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
