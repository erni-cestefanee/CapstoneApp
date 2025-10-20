// src/Frontend/pages/SUL/SULHomeScreen.tsx
import React from 'react';
import './SULHomeScreen.css';

type LeaveBalance = { label: string; used: number; total: number; color?: string };
type Upcoming = { status: 'Approved' | 'Pending' | 'Declined'; date: string; type: string };

export default function SULHomeScreen(): React.ReactElement {
  const balances: LeaveBalance[] = [
    { label: 'Holiday Leave', used: 7, total: 15, color: '#2bc1b6' },
    { label: 'Birthday Leave', used: 0, total: 1, color: '#ff6ec7' },
    { label: 'Sick Leave', used: 3, total: 15, color: '#ff9a4a' },
    { label: 'Vacation Leave', used: 9, total: 15, color: '#4b78ff' },
    { label: 'Parental Leave', used: 9, total: 130, color: '#8fd2ff' },
  ];

  const upcoming: Upcoming[] = [
    { status: 'Approved', date: 'Oct 25 - 30, 2025', type: 'Sick' },
    { status: 'Approved', date: 'Nov 3 - 5, 2025', type: 'Vacation' },
    { status: 'Pending', date: 'Dec 27, 2025 - Jan 3, 2026', type: 'Holiday' },
  ];

  const teams = ['DE/DA Starbucks', 'DE/DA Lulalaoo', 'DE/DA Get', 'DE/DA Foodapp'];

  return (
    <div className="sul-page">
      <div className="sul-grid">
        <div className="main-col">
          <div className="card balances">
          <div className="card-title">Available Leaves</div>
          <div className="card-sub">Your current leave balance for this year</div>

          <div className="balances-list">
            {balances.map((b, i) => (
              <div className="balance-row" key={i}>
                <div className="balance-dot" style={{ background: b.color }} />
                <div className="balance-label">{b.label}</div>
                <div className="balance-value">{b.used} / {b.total} Days Available</div>
              </div>
            ))}
          </div>
        </div>

          <div className="card upcoming-card">
            <div className="card-title">Upcoming Leave/s</div>
            <table className="upcoming-table">
              <thead>
                <tr><th>Status</th><th>Date</th><th>Type</th></tr>
              </thead>
              <tbody>
                {upcoming.map((u, i) => (
                  <tr key={i}>
                    <td className={`status-dot ${u.status.toLowerCase()}`}>{u.status}</td>
                    <td>{u.date}</td>
                    <td>{u.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="right-col">
          <button className="apply-btn">+ Apply Leave</button>

          <div className="card quick-stats">
            <div className="card-title">Quick Stats</div>
            <div className="stat-row"><span>Total leaves used:</span><strong>28</strong></div>
            <div className="stat-row"><span>Total available:</span><strong>18</strong></div>
            <div className="stat-row"><span>Pending Request/s:</span><strong>3</strong></div>
          </div>

          <button className="create-btn">+ Create Team</button>

          <div className="card teams-card">
            <div className="card-title">Team/s</div>
            <div className="team-list">
              {teams.slice(0,2).map((t, i) => (
                <div className="team-pill" key={i}>{t}</div>
              ))}
            </div>
          </div>

          <div className="card join-card">
            <div className="card-title">Join Team</div>
            <div className="join-list">
              {teams.map((t, i) => (
                <div className="join-row" key={i}>
                  <div className="join-name">{t}</div>
                  <button className="join-btn">+</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        
      </div>
    </div>
  );
}