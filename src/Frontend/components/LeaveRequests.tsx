import React, { useEffect, useRef, useState } from 'react';
import './styles/LeaveRequests.css';
import { useMsal } from '@azure/msal-react';
import RequestForm, { type RequestFormHandle } from './RequestForm.tsx';
import { type SavedLeaveRequest } from './types';
import ButtonRequest from './ButtonRequest.tsx';

const STORAGE_KEY = 'capstone_leave_requests_v1';

function calculateInclusiveDays(fromIso: string, toIso: string) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.round((to.getTime() - from.getTime()) / msPerDay) + 1;
  return diff > 0 ? diff : 0;
}

const DEMO_ROWS: SavedLeaveRequest[] = [
  {
    id: 'demo-1',
    user: 'Jane Doe',
    type: 'Vacation',
    from: '2025-10-25',
    to: '2025-10-30',
    reason: 'Family trip',
    days: calculateInclusiveDays('2025-10-25', '2025-10-30'),
    submittedAt: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    user: 'Jane Doe',
    type: 'Vacation',
    from: '2025-10-25',
    to: '2025-10-30',
    reason: 'Family trip',
    days: calculateInclusiveDays('2025-10-25', '2025-10-30'),
    submittedAt: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    user: 'Jane Doe',
    type: 'Holiday',
    from: '2025-10-25',
    to: '2025-10-30',
    reason: 'Holiday',
    days: calculateInclusiveDays('2025-10-25', '2025-10-30'),
    submittedAt: new Date().toISOString(),
  },
  {
    id: 'demo-4',
    user: 'Jane Doe',
    type: 'Maternity',
    from: '2025-10-25',
    to: '2025-10-30',
    reason: 'Maternity leave',
    days: calculateInclusiveDays('2025-10-25', '2025-10-30'),
    submittedAt: new Date().toISOString(),
  },
];

export default function LeaveRequests() {
  const { accounts } = useMsal();
  const username = accounts?.[0]?.username ?? accounts?.[0]?.name ?? 'Me';

  const [saved, setSaved] = useState<SavedLeaveRequest[]>([]);
  const [demoRows, setDemoRows] = useState<SavedLeaveRequest[]>(DEMO_ROWS);
  const [showForm, setShowForm] = useState<boolean>(false);

  const requestFormRef = useRef<RequestFormHandle | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch (err) {
      console.error('Failed to load saved leave requests', err);
    }
  }, []);

  function handleSavedUpdated(newSaved: SavedLeaveRequest[]) {
    setSaved(newSaved);
  }

  function handleEdit(id: string) {
    const all = saved.length ? saved : demoRows;
    const item = all.find((s) => s.id === id);
    if (!item) return;
    // ensure form is visible, then load the item
    setShowForm(true);
    // wait a tick for the child to mount, then load
    setTimeout(() => {
      requestFormRef.current?.loadRequest(item);
    }, 60);
  }

  function handleCancel(id: string) {
    if (!confirm('Cancel this leave request? This will remove it from saved requests.')) return;
    if (saved.find((s) => s.id === id)) {
      const updated = saved.filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setSaved(updated);
    } else {
      const updatedDemo = demoRows.filter((s) => s.id !== id);
      setDemoRows(updatedDemo);
    }
  }

  const visibleRows = saved.length ? saved : demoRows;
  const totalUsed = visibleRows.reduce((acc, s) => acc + (s.days || 0), 0);
  const totalAvailable = 18;
  const pending = visibleRows.length;

  return (
    <div className="leave-requests">
      <header className="site-header">
        <div className="title">Leave Request</div>
      </header>

      <div className="content">
        <div className="left-column">
          <div className="track-box panel">
            <div className="track-title">
              <h3>Track your Request/s</h3>
              <div className="subtitle">Edit or cancel your leave application</div>
            </div>

            <div className="track-table">
              <div className="track-head">
                <div className="col type-col">Type</div>
                <div className="col date-col">Date</div>
                <div className="col actions-col" />
              </div>

              <div className="track-rows">
                {visibleRows.length === 0 ? (
                  <div className="empty">No saved requests yet.</div>
                ) : (
                  visibleRows.map((s) => (
                    <div key={s.id} className="track-row">
                      <div className="col type-col">{s.type}</div>
                      <div className="col date-col">{formatDateRange(s.from, s.to)}</div>
                      <div className="col actions-col">
                        <button className="pill update-pill" onClick={() => handleEdit(s.id)}>Update</button>
                        <button className="pill cancel-pill" onClick={() => handleCancel(s.id)}>Cancel</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="track-spacer" />
          </div>
        </div>

       
        <aside className="right-column">
          <div className="sidebar-buttons">

            <ButtonRequest />
          </div>

          <div className="sidebar-card stats-card">
            <div className="card-title">Quick Stats</div>
            <div className="card-body">
              <div>Total leaves used: <strong>{totalUsed}</strong></div>
              <div>Total available: <strong>{totalAvailable}</strong></div>
              <div>Pending Request/s: <strong>{pending}</strong></div>
            </div>
          </div>

          <div className="sidebar-card teams-card">
            <div className="card-title">Team/s</div>
            <div className="card-body">
              <div className="team-pill">DE/DA Starbucks</div>
              <div className="team-pill">DE/DA Starbucks</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatDateRange(fromIso: string, toIso: string) {
  try {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const fromStr = from.toLocaleDateString(undefined, opts);
    const toStr = to.toLocaleDateString(undefined, opts);
    if (fromIso === toIso) {
      return `${fromStr}, ${from.getFullYear()}`;
    }
    return `${fromStr} - ${toStr}, ${from.getFullYear()}`;
  } catch {
    return `${fromIso} → ${toIso}`;
  }
}