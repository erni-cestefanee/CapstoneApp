import './Navbar.css';

import { useEffect, useState } from 'react';

import ERNILogo from '/src/Frontend/assets/ERNI_logo_color.png';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useMsal } from '@azure/msal-react';

type Props = {
  onLogout?: () => void;
  userName?: string;
  userEmail?: string;
};

function prettifyName(raw: string | undefined): string {
  if (!raw) return '';
  if (raw.includes('@')) {
    const local = raw.split('@')[0];
    const words = local.replace(/[._\-+]/g, ' ').split(/\s+/).filter(Boolean);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

export default function CXNavbar({ onLogout, userName, userEmail }: Props) {
  const { accounts } = useMsal();
  const { user, logout } = useAuth();

  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 721;
  });

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 721) setOpen(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const rawName = accounts?.[0]?.name ?? user?.display_name ?? userName ?? userEmail ?? '';
  const displayName = prettifyName(rawName);
  const display = displayName ? `Welcome, ${displayName}` : 'Welcome';

  const handleLogout = async () => {
    try { await logout(); } catch (err) { console.warn('CXNavbar.logout', err); }
    try { onLogout?.(); } catch {}
  };

  return (
    <>{/*
      <button
        className="hamburger-btn"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
        aria-controls="cx-side-nav"
        onClick={() => setOpen(s => !s)}
      >
        <span className="bar" style={{ transform: open ? 'rotate(45deg) translate(3px, 3px)' : undefined }} />
        <span className="bar" style={{ opacity: open ? 0 : 1 }} />
        <span className="bar" style={{ transform: open ? 'rotate(-45deg) translate(3px, -3px)' : undefined }} />
      </button>

      <div
        className={`nav-overlay ${open ? 'visible' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />
      */}

      <aside
        id="cx-side-nav"
        className={`side-nav ${open ? 'mobile-open' : 'mobile-closed'}`}
        aria-label="CX"
      >
        <div className="logo">
          <img src={ERNILogo} alt="ERNI" className="erni-logo" />
          <div className="welcome-text">{display}</div>
          <div style={{ marginTop: '-15px', marginBottom: '25px', fontSize: '13px', color: '#0b3b66', opacity: 0.95 }} aria-hidden>
            CX
          </div>
        </div>

        <nav>
          <NavLink to="/cx" end className={({ isActive }) => (isActive ? 'nav-btn active' : 'nav-btn')}>
            CX Dashboard
          </NavLink>

          <NavLink to="/cx/leave" className={({ isActive }) => (isActive ? 'nav-btn active' : 'nav-btn')}>
            Leave Requests
          </NavLink>

          <NavLink to="/cx/calendar" className={({ isActive }) => (isActive ? 'nav-btn active' : 'nav-btn')}>
            Calendar
          </NavLink>

          <NavLink to="/cx/teams" className={({ isActive }) => (isActive ? 'nav-btn active' : 'nav-btn')}>
            Teams
          </NavLink>

          <NavLink to="/cx/activity" className={({ isActive }) => (isActive ? 'nav-btn active' : 'nav-btn')}>
            Activity Log
          </NavLink>
        </nav>

        <div className="side-footer">
          <button className="nav-btn logout" onClick={handleLogout}>Logout</button>
        </div>
      </aside>
    </>
  );
}