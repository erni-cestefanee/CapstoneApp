// src/Frontend/pages/Admin/Approvals.tsx

import './styles/Approvals.css';

import { useEffect, useMemo, useState } from 'react';

import RoleChecker from '../../components/nav/RoleChecker';
import supabase from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

type Profile = { roles?: any; role?: any; app_metadata?: any; email?: string; display_name?: string };

export default function Approvals() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [appsLoading, setAppsLoading] = useState(false);
  const { user: authUser } = useAuth();

  // Application rows fetched from DB
  type ApprovalRow = {
    id: string;
    user_id?: string;
    leave_type?: string;
    date_from?: string | null;
    date_to?: string | null;
    applied_on?: string | null;
    status?: string | null;
    name?: string | null;
    email?: string | null;
  };

  const [applications, setApplications] = useState<ApprovalRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    if (Array.isArray(raw)) return raw.map((r: any) => String(r).toLowerCase());
    if (typeof raw === 'object') {
      try { return Object.values(raw).map((v: any) => String(v).toLowerCase()); } catch { return []; }
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((r: any) => String(r).toLowerCase());
        if (typeof parsed === 'string') return [parsed.toLowerCase()];
      } catch {}
      if (trimmed.includes(',')) return trimmed.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      return [trimmed.toLowerCase()];
    }
    return [];
  }

  const roles = parseRoles(authUser?.roles ?? profile?.roles ?? profile?.role ?? profile?.app_metadata?.role);
  const isAdmin = roles.includes('admin');
  const isSUL = roles.includes('sul') || roles.includes('pl'); // 'pl' alias used elsewhere
  const isAuthorized = isAdmin || isSUL;

  // Fetch leave applications from Supabase
  async function fetchApplications() {
    setAppsLoading(true);
    setErrorMsg(null);
    try {
      // NOTE: temporarily do NOT filter by status on the server so we can see all rows and
      // inspect actual status values coming from the DB (case, null, etc).
      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_applications')
        .select('id, user_id, leave_type, start_date, end_date, created_at, status, approver_id')
        .order('created_at', { ascending: false });

      if (leaveError) throw leaveError;

      const leaveRows = (leaveData as any[]) || [];
      console.debug('[Approvals] fetched leave_applications rows count:', leaveRows.length, leaveRows.slice(0, 10));

      if (leaveRows.length === 0) {
        setApplications([]);
        return;
      }

      // collect unique user ids (exclude falsy values)
      const userIds = Array.from(new Set(leaveRows.map(r => r.user_id).filter(Boolean)));
      let usersMap = new Map<string, any>();

      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, display_name, email')
          .in('id', userIds);

        if (usersError) throw usersError;
        usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));
        console.debug('[Approvals] fetched users for userIds:', userIds, usersData?.length ?? 0);
      } else {
        console.debug('[Approvals] no userIds found for fetched leave rows');
      }

      const rows: ApprovalRow[] = leaveRows.map(r => ({
        id: r.id,
        user_id: r.user_id,
        leave_type: r.leave_type,
        // map your actual column names
        date_from: r.start_date ?? null,
        date_to: r.end_date ?? null,
        applied_on: r.created_at ?? null,
        status: r.status ?? null,
        name: usersMap.get(r.user_id)?.display_name ?? null,
        email: usersMap.get(r.user_id)?.email ?? null,
      }));

      // TEMPORARY: show everything so we can inspect statuses in the UI.
      // When ready to show only pending, change to:
      // setApplications(rows.filter(r => String(r.status || '').toLowerCase() === 'pending'));
      setApplications(rows);
    } catch (err: any) {
      console.error('Failed to fetch leave applications', err);
      setErrorMsg(err?.message ?? 'Failed to fetch leave applications');
      setApplications([]);
    } finally {
      setAppsLoading(false);
    }
  }

  useEffect(() => {
    // Only fetch if user is allowed (we still fetch once role/profile resolved)
    if (!isAuthorized && !loading) return;
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthorized]);

  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter(r => (
      (r.name ?? '').toLowerCase().includes(q) ||
      (r.leave_type ?? '').toLowerCase().includes(q) ||
      (r.email ?? '').toLowerCase().includes(q)
    ));
  }, [query, applications]);

  // Approve / decline handlers
  async function updateApplicationStatus(id: string, newStatus: 'approved' | 'declined') {
    try {
      // Log action
      console.debug(`[Approvals] updating ${id} -> ${newStatus}`);

      // get current auth user id to set as approver_id (if available)
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = (userData as any)?.user;
      const approverId = currentUser?.id ?? null;

      // update status and approver_id
      const { data, error } = await supabase
        .from('leave_applications')
        .update({ status: newStatus, approver_id: approverId })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      console.debug('[Approvals] update result:', data);

      // Refresh server data to reflect any DB-side triggers/policies and to pick up changes
      await fetchApplications();
    } catch (err: any) {
      console.error(`Failed to update status for ${id}`, err);
      setErrorMsg(err?.message ?? `Failed to ${newStatus}`);
    }
  }

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

            <div style={{ marginTop: 8 }}>
              {appsLoading && <p>Fetching leave applications…</p>}
              {errorMsg && <p style={{ color: 'crimson' }}>{errorMsg}</p>}
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
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && !appsLoading && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>No pending applications found.</td>
                    </tr>
                  )}

                  {rows.map(r => (
                    <tr key={r.id}>
                      <td>{r.leave_type ?? '—'}</td>
                      <td>{r.name ?? r.email ?? r.user_id ?? 'Unknown'}</td>
                      <td>{r.date_from ? new Date(r.date_from).toLocaleDateString() : '—'}</td>
                      <td>{r.date_to ? new Date(r.date_to).toLocaleDateString() : '—'}</td>
                      <td>{r.applied_on ? new Date(r.applied_on).toLocaleDateString() : '—'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{r.status ?? 'pending'}</td>
                      <td className="actions-cell">
                        <button
                          className="btn approve"
                          onClick={() => updateApplicationStatus(r.id, 'approved')}
                          disabled={r.status === 'approved'}
                        >
                          Approve
                        </button>
                        <button
                          className="btn decline"
                          onClick={() => updateApplicationStatus(r.id, 'declined')}
                          disabled={r.status === 'declined'}
                        >
                          Decline
                        </button>
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