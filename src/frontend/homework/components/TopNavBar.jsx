import React from 'react';
import { USER } from '../data/mockData';

/**
 * @param {{ user: { name: string, level: string, avatar: string } }} props
 */
export default function TopNavBar({ user = USER }) {
  return (
    <header className="hw-topbar">
      <div>
        <h2 className="hw-topbar-title">User Dashboard</h2>
      </div>
      <div className="hw-topbar-actions">
        <span className="hw-level-badge">{user.level}</span>
        <div className="hw-topbar-icons">
          <button className="hw-icon-btn">
            <span className="hw-material-icon">notifications</span>
            <span className="hw-notif-dot"></span>
          </button>
          <button className="hw-icon-btn">
            <span className="hw-material-icon">help_outline</span>
          </button>
          <div className="hw-avatar">{user.avatar}</div>
        </div>
      </div>
    </header>
  );
}
