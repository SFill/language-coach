import React from 'react';
import NoteListView from './NoteListView';

const NoteListPage = ({ noteList, currentNoteId, loadNote, deleteNote }) => {

  return (
    <div className="page">
      <NoteListView
        noteList={noteList}
        currentNoteId={currentNoteId}
        onSelectNote={loadNote}
        onDeleteNote={deleteNote}
      />
    </div>
  );
};

export default NoteListPage;
