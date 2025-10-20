// src/Frontend/pages/Admin/Approvals.tsx

import { useEffect, useMemo, useState } from 'react';
import './styles/Approvals.css';

import RoleChecker from '../../components/nav/RoleChecker';
import supabase from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

type Profile = { roles?: any; role?: any; app_metadata?: any; email?: string; display_name?: string };

export default function Approvals() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user: authUser } = useAuth();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = (userData as any)?.user;
        if (!user) {
          if (mounted) setProfile(null);
          return;
        }

        const { data } = await supabase
          .from('users')
          .select('roles, email, display_name')
          .eq('id', user.id)
          .maybeSingle();

        if (mounted) setProfile((data as any) ?? null);
      } catch (err) {
        if (mounted) console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  // Normalize roles for safer, case-insensitive checks
  function parseRoles(raw: any): string[] {
    if (!raw) return [];
    // already an array
    if (Array.isArray(raw)) return raw.map((r: any) => String(r).toLowerCase());
    // if it's an object with values
    if (typeof raw === 'object') {
      try { return Object.values(raw).map((v: any) => String(v).toLowerCase()); } catch { return []; }
    }
    // if it's a JSON string
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      // try parse JSON
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((r: any) => String(r).toLowerCase());
        if (typeof parsed === 'string') return [parsed.toLowerCase()];
      } catch {}

      // comma separated
      if (trimmed.includes(',')) return trimmed.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

      // single value
      return [trimmed.toLowerCase()];
    }

    return [];
  }

  // Prefer the centralized auth user (AuthContext) if available, otherwise fall back to fetched profile
  const roles = parseRoles(authUser?.roles ?? profile?.roles ?? profile?.role ?? profile?.app_metadata?.role);
  const isAdmin = roles.includes('admin');
  const isSUL = roles.includes('sul') || roles.includes('pl'); // 'pl' alias used elsewhere
  const isAuthorized = isAdmin || isSUL;

  // --- Mock data for UI (replace with real fetch from DB) ---
  type ApprovalRow = {
    id: string;
    leaveType: string;
    name: string;
    dateFrom: string;
    dateTo: string;
    appliedOn: string;
    team: string;
  };

  const [query, setQuery] = useState('');

  const sampleRows: ApprovalRow[] = [
    { id: '1', leaveType: 'Vacation', name: 'Estefanee Din', dateFrom: '2025-04-22', dateTo: '2025-04-22', appliedOn: '2025-04-22', team: 'Team 1' },
    { id: '2', leaveType: 'Holiday', name: 'Jeremy Lim', dateFrom: '2025-04-22', dateTo: '2025-04-22', appliedOn: '2025-04-22', team: 'Team 2' },
    { id: '3', leaveType: 'Vacation', name: 'Dann Purr', dateFrom: '2025-04-22', dateTo: '2025-04-22', appliedOn: '2025-04-22', team: 'Team 2' },
    { id: '4', leaveType: 'Sick', name: 'Jhonelle Ong', dateFrom: '2025-04-22', dateTo: '2025-04-22', appliedOn: '2025-04-22', team: 'Team 4' },
    { id: '5', leaveType: 'Parental', name: 'Trix Silong', dateFrom: '2025-04-22', dateTo: '2025-04-22', appliedOn: '2025-04-22', team: 'Team 2' },
    { id: '6', leaveType: 'Vacation', name: 'Brad Mason', dateFrom: '2025-04-22', dateTo: '2025-04-22', appliedOn: '2025-04-22', team: 'Team 1' },
    { id: '7', leaveType: 'Vacation', name: 'Dominic Tan', dateFrom: '2025-04-22', dateTo: '2025-04-22', appliedOn: '2025-04-22', team: 'Team 4' },
    { id: '8', leaveType: 'Sick', name: 'Taylor Sev', dateFrom: '2025-04-22', dateTo: '2025-04-22', appliedOn: '2025-04-22', team: 'Team 2' },
    { id: '9', leaveType: 'Vacation', name: 'Viki Vicks', dateFrom: '2025-04-22', dateTo: '2025-04-22', appliedOn: '2025-04-22', team: 'Team 3' },
    { id: '10', leaveType: 'Holiday', name: 'Neon Neil', dateFrom: '2025-04-22', dateTo: '2025-04-22', appliedOn: '2025-04-22', team: 'Team 5' },
  ];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sampleRows;
    return sampleRows.filter(r => (
      r.name.toLowerCase().includes(q) || r.leaveType.toLowerCase().includes(q) || r.team.toLowerCase().includes(q)
    ));
  }, [query]);


  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
  <RoleChecker onLogout={() => supabase.auth.signOut()} userEmail={profile?.email} isAdmin={isAdmin} />
  

      <main style={{ padding: '24px', flex: 1 }}>
        <div className="approvals-header">Approvals</div>

        {loading && <p>Loading…</p>}

        {!loading && !isAuthorized && (
          <p style={{ color: 'crimson' }}>You do not have permission to view approvals.</p>
        )}

        {!loading && isAuthorized && (
          <section className="approvals-card">
            <div className="approvals-card-top">
              <div>
                <h2>Employee Leave Request/s</h2>
                <div className="muted">Approve or decline employee leave request</div>
              </div>

              <div className="approvals-search">
                <input
                  aria-label="Search approvals"
                  placeholder="Search..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="approvals-table-wrap">
              <table className="approvals-table">
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Name</th>
                    <th>Date From</th>
                    <th>Date To</th>
                    <th>Applied On</th>
                    <th>Team</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td>{r.leaveType}</td>
                      <td>{r.name}</td>
                      <td>{new Date(r.dateFrom).toLocaleDateString()}</td>
                      <td>{new Date(r.dateTo).toLocaleDateString()}</td>
                      <td>{new Date(r.appliedOn).toLocaleDateString()}</td>
                      <td>{r.team}</td>
                      <td className="actions-cell">
                        <button className="btn approve">Approve</button>
                        <button className="btn decline">Decline</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}