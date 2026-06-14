import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tutorials', label: 'Tutorials' },
  { to: '/categories', label: 'Categories' },
  { to: '/users', label: 'Users' },
];

export default function Layout() {
  const { signOut } = useAuth();

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>IDD Admin</div>
        <nav style={styles.nav}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button style={styles.signOut} onClick={signOut}>Sign Out</button>
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
  nav: { display: 'flex', flexDirection: 'column', flex: 1 },
  navLink: {
    padding: '12px 24px', textDecoration: 'none', color: '#718096',
    fontSize: 15, fontWeight: 500, borderLeft: '3px solid transparent',
  },
  navLinkActive: { color: '#5B8DB8', borderLeftColor: '#5B8DB8', background: '#EBF4FF' },
  signOut: {
    margin: '0 16px', padding: 10, background: 'none', border: '1px solid #E2E8F0',
    borderRadius: 8, color: '#718096', cursor: 'pointer', fontSize: 14,
  },
  main: { flex: 1, padding: 32, maxWidth: 1100 },
};
