import './styles/AvailableLeaves.css';
import './styles/ActivityLog.css';

import React from 'react';

const AvailableLeaves: React.FC = () => {
  return (
    <div className="available-leaves card">
      <h3>Available Leaves</h3>
      <p className="muted">Your current leave balance for this year</p>

      <ul className="leave-list">
        <li className="leave-item purple">
          <div className="label-left"><span className="dot purple" /> <span className="leave-label">Holiday Leave</span></div>
          <span className="balance">7 / 15 Days Available</span>
        </li>
        <li className="leave-item orange">
          <div className="label-left"><span className="dot orange" /> <span className="leave-label">Birthday Leave</span></div>
          <span className="balance">0 / 1 Days Available</span>
        </li>
        <li className="leave-item red">
          <div className="label-left"><span className="dot red" /> <span className="leave-label">Sick Leave</span></div>
          <span className="balance">3 / 15 Days Available</span>
        </li>
        <li className="leave-item green">
          <div className="label-left"><span className="dot green" /> <span className="leave-label">Vacation Leave</span></div>
          <span className="balance">9 / 15 Days Available</span>
        </li>
        <li className="leave-item blue">
          <div className="label-left"><span className="dot blue" /> <span className="leave-label">Parental Leave</span></div>
          <span className="balance">9 / 130 Days Available</span>
        </li>
      </ul>
    </div>
  );
};

export default AvailableLeaves;
