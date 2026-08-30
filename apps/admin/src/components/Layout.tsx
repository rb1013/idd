import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const METADATA_PATHS = ['/categories', '/situation-tags', '/event-categories', '/medical-conditions'];

const METADATA_ITEMS = [
  { to: '/categories',        label: 'Learner Categories' },
  { to: '/situation-tags',    label: 'Situation Tags' },
  { to: '/event-categories',  label: 'Event Categories' },
  { to: '/medical-conditions',label: 'Medical Conditions' },
];

const TOP_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tutorials',  label: 'Tutorials' },
  { to: '/users',      label: 'Users' },
];

export default function Layout() {
  const { signOut, adminEmail } = useAuth();
  const location = useLocation();
  const metadataActive = METADATA_PATHS.some(p => location.pathname === p);
  const [metadataOpen, setMetadataOpen] = useState(metadataActive);

  const initials = adminEmail
    ? adminEmail.split('@')[0].slice(0, 2).toUpperCase()
    : 'A';

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>IDD Admin</div>
        <nav style={styles.nav}>
          {TOP_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}
            >
              {item.label}
            </NavLink>
          ))}

          {/* Metadata group */}
          <button
            style={{ ...styles.navLink, ...styles.groupToggle, ...(metadataActive ? styles.groupToggleActive : {}) }}
            onClick={() => setMetadataOpen(o => !o)}
          >
            <span>Metadata</span>
            <span style={styles.chevron}>{metadataOpen ? '▾' : '▸'}</span>
          </button>

          {metadataOpen && (
            <div style={styles.subNav}>
              {METADATA_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={({ isActive }) => ({ ...styles.subLink, ...(isActive ? styles.subLinkActive : {}) })}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div style={styles.userSection}>
          <div style={styles.avatar}>{initials}</div>
          <div style={styles.userInfo}>
            <div style={styles.userEmail} title={adminEmail ?? ''}>{adminEmail ?? ''}</div>
            <button style={styles.signOut} onClick={signOut}>Sign out</button>
          </div>
        </div>
      </aside>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh', background: '#F5F7FA' },
  sidebar: {
    width: 220, background: '#fff', borderRight: '1px solid #E2E8F0',
    display: 'flex', flexDirection: 'column', padding: '24px 0',
  },
  logo: { fontSize: 20, fontWeight: 700, color: '#5B8DB8', padding: '0 24px', marginBottom: 32 },
  nav:  { display: 'flex', flexDirection: 'column', flex: 1 },

  navLink: {
    padding: '12px 24px', textDecoration: 'none', color: '#718096',
    fontSize: 15, fontWeight: 500, borderLeft: '3px solid transparent',
  },
  navLinkActive: { color: '#5B8DB8', borderLeftColor: '#5B8DB8', background: '#EBF4FF' },

  groupToggle: {
    width: '100%', textAlign: 'left', background: 'none', border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  groupToggleActive: { color: '#5B8DB8' },
  chevron: { fontSize: 12, opacity: 0.7 },

  subNav: { display: 'flex', flexDirection: 'column' },
  subLink: {
    padding: '10px 24px 10px 36px', textDecoration: 'none', color: '#718096',
    fontSize: 14, fontWeight: 500, borderLeft: '3px solid transparent',
  },
  subLinkActive: { color: '#5B8DB8', borderLeftColor: '#5B8DB8', background: '#EBF4FF' },

  userSection: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '16px 20px', borderTop: '1px solid #E2E8F0',
  },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: '#5B8DB8', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, flexShrink: 0,
  },
  userInfo: { flex: 1, minWidth: 0 },
  userEmail: {
    fontSize: 12, color: '#2D3748', fontWeight: 500,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    marginBottom: 2,
  },
  signOut: {
    background: 'none', border: 'none', padding: 0,
    color: '#718096', cursor: 'pointer', fontSize: 12,
    textAlign: 'left' as const,
  },
  main: { flex: 1, padding: 32, maxWidth: 1100 },
};
