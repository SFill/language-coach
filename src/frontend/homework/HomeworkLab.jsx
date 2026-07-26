import React, { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import ReactDOM from 'react-dom';
import './HomeworkLab.css';
import { parseClipboardHTML } from './utils/importPaste';
import { buildCards } from './viewModel';
import SideNavBar from './components/SideNavBar';
import AssignmentCard from './components/AssignmentCard';
import DraftingArea from './components/DraftingArea';
import ImportWorkspace from './components/ImportWorkspace';
import NoteListView from '../NoteListView';

export default function HomeworkLab({ homeworkStore }) {
  // Subscribe to the store; URL→manager sync is handled in App.jsx.
  const state = useSyncExternalStore(
    homeworkStore.subscribe,
    homeworkStore.getSnapshot,
    homeworkStore.getSnapshot,
  );
  const { mgr } = homeworkStore;
  const hm = mgr.homeworkManager;

  const notes = state.noteList;
  const noteId = state.currentNoteId;
  const showPicker = state.showPicker;

  // DraftingArea expects { id, note_blocks }; cards are the pure view model.
  const activeNote = useMemo(
    () => (noteId ? { id: noteId, note_blocks: state.noteBlocks } : null),
    [noteId, state.noteBlocks],
  );
  const cards = useMemo(() => buildCards(noteId, state.noteBlocks), [noteId, state.noteBlocks]);

  const [activeAssignmentId, setActiveAssignmentId] = useState(null);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSegments, setAddSegments] = useState([]);
  const [isAddingAssignment, setIsAddingAssignment] = useState(false);

  // Resizable split: task-pane width in px. null → fall back to CSS (35%).
  const splitRef = useRef(null);
  const [taskPaneWidth, setTaskPaneWidth] = useState(null);
  const dragStateRef = useRef(null);

  const onResize = useCallback((e) => {
    const st = dragStateRef.current;
    if (!st) return;
    const next = st.startWidth + (e.clientX - st.startX);
    setTaskPaneWidth(Math.max(st.minWidth, Math.min(next, st.maxWidth)));
  }, []);

  const stopResize = useCallback(() => {
    dragStateRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onResize);
    window.removeEventListener('mouseup', stopResize);
  }, [onResize]);

  const startResize = useCallback((e) => {
    const split = splitRef.current;
    const pane = split?.querySelector('.hw-task-pane');
    if (!split || !pane) return;
    e.preventDefault();
    dragStateRef.current = {
      startX: e.clientX,
      startWidth: pane.getBoundingClientRect().width,
      minWidth: 240,
      maxWidth: split.getBoundingClientRect().width - 420, // keep draft ≥ 420px
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onResize);
    window.addEventListener('mouseup', stopResize);
  }, [onResize, stopResize]);

  useEffect(() => () => stopResize(), [stopResize]);

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false);
    setAddSegments([]);
  }, []);

  // Auto-select assignment: prefer URL hash, then keep current, then first card
  useEffect(() => {
    if (!activeNote?.id) {
      setActiveAssignmentId(null);
      return;
    }
    // Check URL hash for persisted selection
    const hashId = window.location.hash.slice(1); // remove leading '#'
    if (hashId && cards.some((c) => c.blockId === hashId)) {
      setActiveAssignmentId(hashId);
      return;
    }
    // Keep current selection if it's still valid
    if (activeAssignmentId && cards.some((c) => c.blockId === activeAssignmentId)) return;
    setActiveAssignmentId(cards[0]?.blockId || null);
  }, [activeNote?.id, cards]);

  // Persist selection to URL hash
  const handleSelectAssignment = useCallback((blockId) => {
    setActiveAssignmentId(blockId);
    window.location.hash = blockId;
  }, []);

  // ESC key closes expanded card or add modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showAddModal) {
          handleCloseAddModal();
        } else if (expandedCardId) {
          setExpandedCardId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedCardId, showAddModal, handleCloseAddModal]);

  const handleExpandCard = useCallback((cardId) => {
    setExpandedCardId((prev) => (prev === cardId ? null : cardId));
  }, []);

  const handleCloseExpanded = useCallback(() => {
    setExpandedCardId(null);
  }, []);

  const handleAddPaste = useCallback((e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    let parsed = [];
    if (html) {
      parsed = parseClipboardHTML(html);
    }
    if (parsed.length === 0 && text?.trim()) {
      parsed = [{ type: 'exercise', text: text.trim(), images: [] }];
    }
    if (parsed.length > 0) {
      setAddSegments(parsed);
    }
  }, []);

  const handleAddAssignment = useCallback(async () => {
    if (addSegments.length === 0 || isAddingAssignment) return;
    setIsAddingAssignment(true);
    try {
      await hm.addAssignment(noteId, addSegments);
      setAddSegments([]);
      setShowAddModal(false);
    } finally {
      setIsAddingAssignment(false);
    }
  }, [noteId, addSegments, isAddingAssignment, hm]);

  // After importing assignments, refresh list and navigate to the new note
  const handleImportComplete = useCallback(async (newNoteId) => {
    await homeworkStore.mgr.loadNotes();
    homeworkStore.mgr.selectNote(String(newNoteId));
  }, [homeworkStore]);

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
                  onSelectNote={mgr.selectNote}
                  onDeleteNote={mgr.deleteNote}
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

        <main className="hw-split-layout" ref={splitRef}>
          {/* Left Pane: Assignment cards (one per assignment block in the active note) */}
          <section className="hw-task-pane" style={taskPaneWidth ? { width: taskPaneWidth } : undefined}>
            <div className="hw-task-pane-header">
              <h2 className="hw-pane-title">Assignments</h2>
              <div className="hw-pane-header-actions">
                <button className="hw-gallery-btn" onClick={() => setShowAddModal(true)}>
                  <span className="hw-material-icon">add</span>
                  Add
                </button>
                <button className="hw-gallery-btn">
                  <span className="hw-material-icon">view_cozy</span>
                  Gallery
                </button>
              </div>
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
                  onSelect={() => handleSelectAssignment(card.blockId)}
                />
              ))}
            </div>
          </section>

          {/* Drag Handle Divider */}
          <div
            className="hw-drag-handle"
            onMouseDown={startResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize assignment and drafting panes"
          >
            <div className="hw-drag-handle-dot" />
          </div>

          {/* Right Pane: Drafting Area */}
          <DraftingArea
            activeNote={activeNote}
            activeAssignmentId={activeAssignmentId}
            submitDraft={hm.submitDraft}
            runAICheck={hm.runAICheck}
            sendQuestion={hm.sendQuestion}
            deleteInquiry={hm.deleteInquiry}
          />
        </main>

        {/* Expanded card image — portal overlays the task pane column only */}
        {expandedCardId && ReactDOM.createPortal(
          <div
            className="hw-card-expanded-overlay"
            style={taskPaneWidth ? { width: `calc(var(--hw-sidebar-width) + ${taskPaneWidth}px)` } : undefined}
            onClick={handleCloseExpanded}
          >
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

        {/* Add Assignment Modal */}
        {showAddModal && (
          <div className="hw-paste-modal-overlay" onClick={handleCloseAddModal}>
            <div className="hw-paste-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="hw-paste-modal-title">Add Assignment</h3>

              {addSegments.length === 0 ? (
                <div
                  className="hw-paste-area"
                  contentEditable
                  suppressContentEditableWarning
                  onPaste={handleAddPaste}
                  data-placeholder="Paste text or image here (Ctrl+V)..."
                />
              ) : (
                <div className="hw-import-preview">
                  <h4 className="hw-import-preview-title">
                    Detected {addSegments.length} exercise{addSegments.length !== 1 ? 's' : ''}
                  </h4>
                  <div className="hw-import-preview-list">
                    {addSegments.map((ex, i) => (
                      <div key={i} className="hw-import-preview-item hw-import-preview-item--exercise">
                        <span className="hw-import-preview-type">
                          {ex.images.length ? '🖼 Exercise' : '📝 Exercise'}
                        </span>
                        {ex.text && (
                          <p className="hw-import-preview-content">
                            {ex.text.length > 120 ? ex.text.slice(0, 120) + '…' : ex.text}
                          </p>
                        )}
                        {ex.images[0] && (
                          <img src={ex.images[0]} alt="" className="hw-import-preview-thumb" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="hw-paste-modal-actions">
                <button
                  className="hw-paste-cancel-btn"
                  onClick={handleCloseAddModal}
                  disabled={isAddingAssignment}
                >
                  Cancel
                </button>
                {addSegments.length > 0 && (
                  <button
                    className="hw-paste-import-btn"
                    disabled={isAddingAssignment}
                    onClick={handleAddAssignment}
                  >
                    {isAddingAssignment ? 'Adding…' : `Add ${addSegments.length} exercise${addSegments.length !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}