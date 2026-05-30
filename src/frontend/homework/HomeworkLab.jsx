import React from 'react';
import './HomeworkLab.css';
import { useHomeworkLab } from './hooks/useHomeworkLab';
import SideNavBar from './components/SideNavBar';
import TopNavBar from './components/TopNavBar';
import AssignmentCard from './components/AssignmentCard';
import DraftingArea from './components/DraftingArea';

export default function HomeworkLab() {
  const {
    cards,
    noteId,
    activeNote,
    selectNote,
    submitDraft,
    runAICheck,
    sendQuestion,
    loading,
    error,
  } = useHomeworkLab();

  // Derive inquiries from activeNote's question blocks
  const inquiries = (activeNote?.note_blocks || [])
    .filter((b) => b.block_type === 'question')
    .map((b) => ({
      id: b.id,
      name: b.question_title || 'Question',
      status: 'resolved',
      time: 'just now',
    }));

  return (
    <div className="hw-page">
      <SideNavBar inquiries={inquiries} />

      <div className="hw-content-wrapper">
        <TopNavBar />

        <main className="hw-split-layout">
          {/* Left Pane: Assignment cards */}
          <section className="hw-task-pane">
            <div className="hw-task-pane-header">
              <h2 className="hw-pane-title">Visual Prompts</h2>
              <button className="hw-gallery-btn">
                <span className="hw-material-icon">view_cozy</span>
                Gallery
              </button>
            </div>
            <div className="hw-task-feed">
              {loading && !cards.length && (
                <div className="hw-loading">Loading assignments...</div>
              )}
              {error && <div className="hw-error">{error}</div>}
              {cards.map((card) => (
                <AssignmentCard
                  key={card.blockId ? `${card.id}-${card.blockId}` : card.id}
                  assignment={card}
                  isActive={String(card.id) === String(noteId)}
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