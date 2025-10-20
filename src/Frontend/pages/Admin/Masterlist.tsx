import './styles/Masterlist.css';

import { useEffect, useState } from 'react';

import DeletePng from '../../assets/Delete Button.png';
import DetailsPng from '../../assets/Details Icon.png';
import EditPng from '../../assets/Edit Icon.png';
import MasterEdit from './MasterEdit';
import React from 'react';
import { supabase } from '../../lib/supabaseClient';

type UserRow = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  roles?: string[] | null;
  [k: string]: any;
};

export default function Masterlist(): React.ReactElement {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [detailsUser, setDetailsUser] = useState<UserRow | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  
  const [showMasterEdit, setShowMasterEdit] = useState(false);

  const ADMIN_FN_URL = import.meta.env.VITE_ADMIN_FN_URL as string | undefined;

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getAccessToken(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token ?? null;
      return token;
    } catch (e) {
      return null;
    }
  }

  async function loadUsers() {
    setLoading(true);
    setError(null);

    const token = await getAccessToken();
    if (!token) {
      setError('No session token found. Login as an admin to view users.');
      setLoading(false);
      return;
    }

    if (!ADMIN_FN_URL) {
      setError('Admin function URL not configured. Set VITE_ADMIN_FN_URL in your .env');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(ADMIN_FN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'list' }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || res.statusText || `status ${res.status}`);
      }

      const body = await res.json();
      console.log('Function response:', body);  // DEBUG: see what function returns
      setUsers(Array.isArray(body.users) ? body.users : []);
      if (body.users && body.users.length === 0) {
        console.warn('Function returned empty users array - check your users table or is_admin function');
      }
    } catch (err: any) {
      console.error('Failed to load users', err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function performAction(payload: Record<string, any>, successMsg?: string) {
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      setError('No session token found.');
      return;
    }
    if (!ADMIN_FN_URL) {
      setError('Admin function URL not configured.');
      return;
    }
    try {
      setBusyId(payload.target_user ?? 'busy');
      const res = await fetch(ADMIN_FN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || res.statusText || `status ${res.status}`);
      }
      await loadUsers();
      if (successMsg) alert(successMsg);
    } catch (err: any) {
      console.error('Admin action failed', err);
      setError(err?.message || String(err));
    } finally {
      setBusyId(null);
    }
  }

  

  async function deleteUser(userId: string) {
    if (!confirm('Permanently delete this user? This cannot be undone.')) return;
    await performAction({ action: 'delete', target_user: userId }, 'User deleted');
  }

  return (
    <section className="masterlist-card">
      <div className="masterlist-header">
        <div>
          <h2>Employee Masterlist</h2>
          <p className="muted">View their leave activities and status</p>
        </div>

        <div className="masterlist-controls">
          <input
            className="masterlist-search"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="masterlist-filter" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option>All</option>
            <option>Web 1</option>
            <option>Web 2</option>
            <option>Data & AI</option>
            <option>Quality Assurance</option>
            <option>UI UX</option>
            <option>HR</option>
          </select>
          <select className="masterlist-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option>All</option>
            <option>admin</option>
            <option>employee</option>
            <option>SUL</option>
            <option>PL</option>
            <option>CX</option>
          </select>
        </div>
      </div>

      {loading && <p>Loading users…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && users.length === 0 && <p className="muted">No users found (admin account excluded).</p>}

      {users.length > 0 && (
        <>
          <p className="count"><strong>{users.length}</strong> user{users.length !== 1 ? 's' : ''} found</p>

          <div className="masterlist-table-wrap">
            <table className="masterlist-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Team</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter((u) => {
                    const q = search.trim().toLowerCase();
                    if (q === '') return true;
                    const email = (u.email || '').toLowerCase();
                    const id = (u.id || '').toLowerCase();
                    return email.includes(q) || id.includes(q) || (u.full_name || '').toLowerCase().includes(q);
                  })
                  .filter((u) => deptFilter === 'All' || (u.department || '') === deptFilter)
                  .filter((u) => {
                    if (roleFilter === 'All') return true;
                    const primaryRole = (u.roles && u.roles[0]) || u.app_metadata?.role || '';
                    return primaryRole === roleFilter;
                  })
                  .map((u, idx) => {
                    const id = u.id;
                    const shortId = id ? `#${id.slice(-4)}` : `#${1000 + idx}`;
                    const name = u.full_name ?? u.email ?? 'Unknown';
                    const dept = u.department ?? '—';
                    const primaryRole = (u.roles && u.roles[0]) || u.app_metadata?.role || '—';
                    const team = u.team ?? 'Team 2';
                    return (
                      <tr key={id || idx} className={idx % 2 === 0 ? 'row--alt' : ''}>
                        <td className="col-id">{shortId}</td>
                        <td className="col-name">{name}</td>
                        <td className="col-dept">{dept}</td>
                        <td className="col-role">{primaryRole}</td>
                        <td className="col-team">{team}</td>
                        <td className="col-actions">
                          {busyId === id ? (
                            <em>working…</em>
                          ) : (
                            <div className="actions-row">
                              <button className="icon-btn" title="Details" onClick={() => setDetailsUser(u)}>
                                <img src={DetailsPng} alt="Details" className="action-img" />
                              </button>

                              <button className="icon-btn" title="Edit" onClick={() => { setEditUser(u); setShowMasterEdit(true); }}>
                                <img src={EditPng} alt="Edit" className="action-img" />
                              </button>

                              <button className="icon-btn icon-delete" title="Delete" onClick={() => deleteUser(id)}>
                                <img src={DeletePng} alt="Delete" className="action-img action-delete" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Details modal */}
      {detailsUser && (
        <div className="modal-backdrop" onClick={() => setDetailsUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Employee details</h3>
            <div className="modal-row"><strong>ID:</strong> {detailsUser.id}</div>
            <div className="modal-row"><strong>Email:</strong> {detailsUser.email}</div>
            <div className="modal-row"><strong>Roles:</strong> {detailsUser.roles ? detailsUser.roles.join(', ') : (detailsUser.app_metadata?.role ?? '')}</div>
            <div className="modal-row"><strong>Created:</strong> {detailsUser.created_at ? new Date(detailsUser.created_at).toLocaleString() : ''}</div>
            <div style={{ marginTop: 12 }}>
              <button onClick={() => setDetailsUser(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Master edit modal */}
      {showMasterEdit && editUser && (
        <MasterEdit
          user={editUser}
          onClose={() => { setShowMasterEdit(false); setEditUser(null); }}
          onSave={async (updates: any) => {
            // updates contains id, role and leave fields
            const payload: Record<string, any> = { action: 'update_user', target_user: updates.id };
            if (updates.role) payload.role = updates.role;
            // copy leave balance and allotted fields
            ['holiday_balance','birthday_balance','sick_balance','vacation_balance','parental_balance','holiday_allotted','birthday_allotted','sick_allotted','vacation_allotted','parental_allotted'].forEach((k) => {
              if (updates[k] !== undefined) payload[k] = updates[k];
            });
            // include year so the admin function can target the correct leave_balances row
            payload.year = new Date().getFullYear();
            await performAction(payload, 'User updated');
          }}
        />
      )}
    </section>
  );
}