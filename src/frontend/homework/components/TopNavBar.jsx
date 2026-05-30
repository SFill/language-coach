import React from 'react';
import { USER } from '../data/mockData';

export default function TopNavBar({ user = USER }) {
  return (
    <header className="hw-topbar">
      <div className="hw-topbar-title">
        User Dashboard
      </div>
      <div className="hw-topbar-actions">
        <span className="hw-level-badge">{user.level}</span>
        <div className="hw-topbar-icons">
          <button className="hw-icon-btn hw-icon-btn--notif">
            <span className="hw-material-icon">notifications</span>
            <span className="hw-notif-dot" />
          </button>
          <button className="hw-icon-btn">
            <span className="hw-material-icon">help_outline</span>
          </button>
          <img
            alt="User profile photo"
            className="hw-avatar-img"
            src={user.avatarUrl}
          />
        </div>
      </div>
    </header>
  );
}