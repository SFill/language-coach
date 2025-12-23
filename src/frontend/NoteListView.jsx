import React from 'react';
import './NoteListView.css';

const NoteListView = ({ noteList, currentNoteId, onSelectNote, onDeleteNote }) => {
  return (
    <div className="note-list-view-container">
      {noteList.map(note => (
        <div
          key={note.id}
          className={`note-list-item ${currentNoteId === note.id ? 'active' : ''}`}
          onClick={() => onSelectNote(note.id)}
        >
          <div className="note-details">
            <span className="note-name">{note.name}</span>
            {/* Placeholder for future details */}
            <span className="note-placeholder">[Additional Info]</span>
          </div>
          <button
            className="delete-note-button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNote(note.id);
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};

export default NoteListView;
