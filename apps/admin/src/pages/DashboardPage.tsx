import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Stats {
  guardians: number;
  users: number;
  tutorials: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ guardians: 0, users: 0, tutorials: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [g, u, t] = await Promise.all([
        supabase.from('guardians').select('id', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('tutorials').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        guardians: g.count || 0,
        users: u.count || 0,
        tutorials: t.count || 0,
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
        <StatCard label="Guardians" value={stats.guardians} color="#5B8DB8" onClick={() => navigate('/guardians')} />
        <StatCard label="User Profiles" value={stats.users} color="#7DBDA2" onClick={() => navigate('/users')} />
        <StatCard label="Tutorials" value={stats.tutorials} color="#D69E2E" onClick={() => navigate('/tutorials')} />
      </div>
    </div>
  );
}

function StatCard({ label, value, color, onClick }: { label: string; value: number; color: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{ ...styles.card, borderTop: `4px solid ${color}`, ...(hover ? styles.cardHover : {}) }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div style={{ ...styles.cardValue, color }}>{value}</div>
      <div style={styles.cardLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 26, fontWeight: 700, color: '#2D3748', marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 },
  card: {
    background: '#fff', borderRadius: 12, padding: 24,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer',
    transition: 'box-shadow 0.15s ease, transform 0.15s ease',
  },
  cardHover: { boxShadow: '0 4px 12px rgba(0,0,0,0.12)', transform: 'translateY(-2px)' },
  cardValue: { fontSize: 40, fontWeight: 700 },
  cardLabel: { fontSize: 14, color: '#718096', marginTop: 4 },
};
