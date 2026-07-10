import React, { useSyncExternalStore } from 'react';
import { Link, useLocation } from 'react-router';
import { USER } from '../data/mockData';
import LanguagePicker from '../../LanguagePicker';

const NAV_LINKS = [
  { to: '/', label: 'New note' },
  { to: '/wordlist', label: 'My words' },
  { to: '/homework', label: 'Homework' },
];

export default function TopNavBar({ currentNoteName, onNoteNameClick, onHomeworkClick, homeworkStore, user = USER }) {
  const location = useLocation();
  // Only the picker flag is needed here; subscribe to just that boolean so the
  // topbar re-renders only when it flips (not on every draft/note change).
  const showPicker = useSyncExternalStore(
    homeworkStore.subscribe,
    () => homeworkStore.getSnapshot().showPicker,
    () => homeworkStore.getSnapshot().showPicker,
  );

  // On a homework workspace view (ImportWorkspace on /homework, or a selected
  // note's split-pane on /homework/:id) the link reads "All homeworks". The
  // NoteListView picker is not a workspace view, so the label stays "Homework"
  // there (clicking it toggles back to the workspace).
  const onHomeworkRoute = location.pathname === '/homework' || location.pathname.startsWith('/homework/');
  const inPicker = location.pathname === '/homework' && showPicker;
  const homeworkLabel = onHomeworkRoute && !inPicker ? 'All homeworks' : 'Homework';

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
          const label = link.to === '/homework' ? homeworkLabel : link.label;
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={isHomeworkToggle ? (e) => { e.preventDefault(); onHomeworkClick(); } : undefined}
              className={`hw-topbar-link ${isActive ? 'hw-topbar-link--active' : ''}`}
            >
              {label}
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