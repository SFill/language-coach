import React from 'react';
import { Link, useLocation } from 'react-router';
import { USER } from '../data/mockData';
import LanguagePicker from '../../LanguagePicker';

const NAV_LINKS = [
  { to: '/', label: 'New note' },
  { to: '/wordlist', label: 'My words' },
  { to: '/homework', label: 'Homework' },
];

export default function TopNavBar({ currentNoteName, onNoteNameClick, onHomeworkClick, user = USER }) {
  const location = useLocation();

  return (
    <header className="hw-topbar">
      <div className="hw-topbar-title">
        {currentNoteName && (
          <h3
            className="hw-topbar-note-name"
            onClick={onNoteNameClick}
          >
            {currentNoteName}
          </h3>
        )}
      </div>

      <nav className="hw-topbar-nav">
        {NAV_LINKS.map((link) => {
          const isActive = location.pathname === link.to ||
            (link.to !== '/' && location.pathname.startsWith(link.to));
          // When on /homework exactly, clicking the Homework link toggles between
          // ImportWorkspace and NoteListView instead of navigating.
          // On /homework/:id, it navigates normally back to /homework.
          const isHomeworkToggle = link.to === '/homework' && onHomeworkClick &&
            location.pathname === '/homework';
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={isHomeworkToggle ? (e) => { e.preventDefault(); onHomeworkClick(); } : undefined}
              className={`hw-topbar-link ${isActive ? 'hw-topbar-link--active' : ''}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="hw-topbar-actions">
        <LanguagePicker />
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