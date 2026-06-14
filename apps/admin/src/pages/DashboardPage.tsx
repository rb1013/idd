import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Stats {
  guardians: number;
  users: number;
  tutorials: number;
  pendingFriendships: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ guardians: 0, users: 0, tutorials: 0, pendingFriendships: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [g, u, t, f] = await Promise.all([
        supabase.from('guardians').select('id', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('tutorials').select('id', { count: 'exact', head: true }),
        supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setStats({
        guardians: g.count || 0,
        users: u.count || 0,
        tutorials: t.count || 0,
        pendingFriendships: f.count || 0,
      });
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={styles.heading}>Dashboard</h1>
      <div style={styles.grid}>
        <StatCard label="Guardians" value={stats.guardians} color="#5B8DB8" />
        <StatCard label="User Profiles" value={stats.users} color="#7DBDA2" />
        <StatCard label="Tutorials" value={stats.tutorials} color="#D69E2E" />
        <StatCard label="Pending Connections" value={stats.pendingFriendships} color="#E53E3E" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
      <div style={{ ...styles.cardValue, color }}>{value}</div>
      <div style={styles.cardLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 26, fontWeight: 700, color: '#2D3748', marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 },
  card: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardValue: { fontSize: 40, fontWeight: 700 },
  cardLabel: { fontSize: 14, color: '#718096', marginTop: 4 },
};
