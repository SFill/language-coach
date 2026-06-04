import React from 'react';
import './HomeworkLab.css';
import { useHomeworkLab } from './hooks/useHomeworkLab';
import SideNavBar from './components/SideNavBar';
import AssignmentCard from './components/AssignmentCard';
import DraftingArea from './components/DraftingArea';
import NoteListView from '../NoteListView';

export default function HomeworkLab({ homeworkListManager }) {
  const {
    notes,
    cards,
    noteId,
    activeNote,
    selectNote,
    deleteNote,
    submitDraft,
    runAICheck,
    sendQuestion,
  } = useHomeworkLab(homeworkListManager);

  // Derive inquiries from activeNote's question blocks
  const inquiries = (activeNote?.note_blocks || [])
    .filter((b) => b.block_type === 'question')
    .map((b) => ({
      id: b.id,
      name: b.question_title || 'Question',
      status: 'resolved',
      time: 'just now',
    }));

  // No note selected — show the picker (uses NoteListView like /notelist).
  if (!noteId) {
    return (
      <div className="hw-page">
        <div className="hw-content-wrapper hw-content-wrapper--no-sidebar">
          <main className="hw-pick-main">
            <div className="hw-pick-container">
              <h2 className="hw-pick-title">Homework</h2>
              <NoteListView
                noteList={notes}
                currentNoteId={null}
                onSelectNote={selectNote}
                onDeleteNote={deleteNote}
              />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="hw-page">
      <SideNavBar inquiries={inquiries} />

      <div className="hw-content-wrapper">

        <main className="hw-split-layout">
          {/* Left Pane: Assignment cards (one per assignment block in the active note) */}
          <section className="hw-task-pane">
            <div className="hw-task-pane-header">
              <h2 className="hw-pane-title">Assignments</h2>
              <button className="hw-gallery-btn">
                <span className="hw-material-icon">view_cozy</span>
                Gallery
              </button>
            </div>
            <div className="hw-task-feed">
              {cards.length === 0 && (
                <div className="hw-loading">No assignments in this note yet.</div>
              )}
              {cards.map((card) => (
                <AssignmentCard
                  key={`${card.id}-${card.blockId}`}
                  assignment={card}
                  isActive
                  onSelect={selectNote}
                />
              ))}
            </div>
          </section>

          {/* Drag Handle Divider */}
          <div className="hw-drag-handle">
            <div className="hw-drag-handle-dot" />
          </div>

          {/* Right Pane: Drafting Area */}
          <DraftingArea
            activeNote={activeNote}
            submitDraft={submitDraft}
            runAICheck={runAICheck}
            sendQuestion={sendQuestion}
          />
        </main>
      </div>
    </div>
  );
}
