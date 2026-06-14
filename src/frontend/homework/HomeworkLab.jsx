import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './HomeworkLab.css';
import { useHomeworkLab } from './hooks/useHomeworkLab';
import SideNavBar from './components/SideNavBar';
import AssignmentCard from './components/AssignmentCard';
import DraftingArea from './components/DraftingArea';
import ImportWorkspace from './components/ImportWorkspace';
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
    showPicker,
    togglePicker,
  } = useHomeworkLab(homeworkListManager);

  const [activeAssignmentId, setActiveAssignmentId] = useState(null);
  const [expandedCardId, setExpandedCardId] = useState(null);

  // Auto-select first assignment when note changes or cards first become available
  useEffect(() => {
    if (!activeNote?.id) {
      setActiveAssignmentId(null);
      return;
    }
    // Keep current selection if it's still valid, otherwise pick first card
    if (activeAssignmentId && cards.some((c) => c.blockId === activeAssignmentId)) return;
    setActiveAssignmentId(cards[0]?.blockId || null);
  }, [activeNote?.id, cards]);

  // ESC key closes expanded card
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && expandedCardId) {
        setExpandedCardId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedCardId]);

  const handleExpandCard = useCallback((cardId) => {
    setExpandedCardId((prev) => (prev === cardId ? null : cardId));
  }, []);

  const handleCloseExpanded = useCallback(() => {
    setExpandedCardId(null);
  }, []);

  // After importing assignments, refresh list and navigate to the new note
  const handleImportComplete = useCallback(async (newNoteId) => {
    await homeworkListManager.loadNotes();
    homeworkListManager.selectNote(String(newNoteId));
  }, [homeworkListManager]);

  // Derive inquiries from activeNote's question blocks
  const inquiries = (activeNote?.note_blocks || [])
    .filter((b) => b.block_type === 'question')
    .map((b) => ({
      id: b.id,
      name: b.question_title || 'Question',
      status: 'resolved',
      time: 'just now',
    }));

  // No note selected — show either ImportWorkspace or NoteListView
  if (!noteId) {
    return (
      <div className="hw-page">
        <div className="hw-content-wrapper hw-content-wrapper--no-sidebar">
          <main className="hw-pick-main">
            {showPicker ? (
              <div className="hw-pick-container">
                <h2 className="hw-pick-title">Homework</h2>
                <NoteListView
                  noteList={notes}
                  currentNoteId={null}
                  onSelectNote={selectNote}
                  onDeleteNote={deleteNote}
                />
              </div>
            ) : (
              <ImportWorkspace onImportComplete={handleImportComplete} />
            )}
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
                  key={card.blockId}
                  assignment={card}
                  isActive={card.blockId === activeAssignmentId}
                  isExpanded={expandedCardId === card.blockId}
                  onExpand={() => handleExpandCard(card.blockId)}
                  onSelect={() => setActiveAssignmentId(card.blockId)}
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
            activeAssignmentId={activeAssignmentId}
            submitDraft={submitDraft}
            runAICheck={runAICheck}
            sendQuestion={sendQuestion}
          />
        </main>

        {/* Expanded card image — portal overlays the task pane column only */}
        {expandedCardId && ReactDOM.createPortal(
          <div className="hw-card-expanded-overlay" onClick={handleCloseExpanded}>
            <div className="hw-card-expanded-container" onClick={(e) => e.stopPropagation()}>
              <img
                src={cards.find((c) => c.blockId === expandedCardId)?.image}
                alt="Expanded view"
                className="hw-card-expanded-image"
              />
              <button
                className="hw-card-expanded-close"
                onClick={handleCloseExpanded}
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}