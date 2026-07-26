import React, { useSyncExternalStore } from 'react';
import { Link, useLocation } from 'react-router';
import { USER } from '../data/mockData';
import LanguagePicker from '../../LanguagePicker';

const NAV_LINKS = [
  { to: '/wordlist', label: 'My words' },
  { to: '/', label: 'Homework' },
];

export default function TopNavBar({ onHomeworkClick, homeworkStore, user = USER }) {
  const location = useLocation();
  // Only the picker flag is needed here; subscribe to just that boolean so the
  // topbar re-renders only when it flips (not on every draft/note change).
  const showPicker = useSyncExternalStore(
    homeworkStore.subscribe,
    () => homeworkStore.getSnapshot().showPicker,
    () => homeworkStore.getSnapshot().showPicker,
  );

  // Homework lives at "/" (picker: ImportWorkspace / NoteListView) and at
  // "/homework/:noteId" (selected note split-pane). On "/" the Homework link
  // toggles between ImportWorkspace and NoteListView instead of navigating.
  // On "/homework/:noteId" it navigates back to "/".
  const onHomeworkRoute = location.pathname === '/' || location.pathname.startsWith('/homework/');
  const inPicker = location.pathname === '/' && showPicker;
  const homeworkLabel = onHomeworkRoute && !inPicker ? 'All homeworks' : 'Homework';

  return (
    <header className="hw-topbar">
      <div className="hw-topbar-title" />

      <nav className="hw-topbar-nav">
        {NAV_LINKS.map((link) => {
          const isActive = link.to === '/'
            ? onHomeworkRoute
            : location.pathname === link.to || location.pathname.startsWith(link.to);
          // When on "/" exactly, clicking the Homework link toggles between
          // ImportWorkspace and NoteListView instead of navigating.
          const isHomeworkToggle = link.to === '/' && onHomeworkClick &&
            location.pathname === '/';
          const label = link.to === '/' ? homeworkLabel : link.label;
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