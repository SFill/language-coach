import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import MarkdownContent from '../../notewindow/components/MarkdownContent.jsx';
import { reconcileHighlights } from '../utils/reconcileHighlights';

// Tooltip shown when hovering/clicking a highlight span
function FeedbackTooltip({ anchor, data, editorRect, onMouseEnter, onMouseLeave }) {
  if (!anchor || !data) return null;

  const rect = anchor.getBoundingClientRect();
  // Position tooltip below the span, relative to the editor container
  const left = rect.left - editorRect.left;
  const top = rect.bottom - editorRect.top + 6; // 6px gap below span

  const typeConfig = {
    suggestion: { label: '✏️ Suggestion', accentClass: 'hw-feedback-tooltip--suggestion' },
    vocab:      { label: '📖 Vocabulary', accentClass: 'hw-feedback-tooltip--vocab' },
    correct:    { label: '✅ Correct', accentClass: 'hw-feedback-tooltip--correct' },
  };
  const config = typeConfig[data.type] || typeConfig.correct;

  return (
    <div
      className={`hw-feedback-tooltip ${config.accentClass}`}
      style={{ left: `${Math.min(left, editorRect.width - 280)}px`, top: `${top}px` }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="hw-feedback-tooltip-label">{config.label}</div>
      {data.type === 'suggestion' && data.annotation && (
        <div className="hw-feedback-tooltip-body">{data.annotation}</div>
      )}
      {data.type === 'vocab' && (
        <div className="hw-feedback-tooltip-body">
          {data.word && <strong>{data.word}</strong>}
          {data.phonetic && <span className="hw-feedback-tooltip-phonetic">{data.phonetic}</span>}
          {data.annotation && <span> — {data.annotation}</span>}
        </div>
      )}
      {data.type === 'correct' && data.annotation && (
        <div className="hw-feedback-tooltip-body">{data.annotation}</div>
      )}
    </div>
  );
}

function QATab({ qaBlocks, onSendQuestion, isSending, noteId }) {
  const [question, setQuestion] = useState('');

  const handleSend = () => {
    if (!question.trim() || isSending) return;
    onSendQuestion(question.trim());
    setQuestion('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="hw-qa-panel">
      <div className="hw-qa-list">
        {qaBlocks.length === 0 && (
          <p className="hw-qa-empty">No questions yet. Ask something about the assignment!</p>
        )}
        {qaBlocks.map((block) => (
          <div key={block.id} className="hw-qa-item">
            {block.question_title && (
              <div className="hw-qa-question">{block.question_title}</div>
            )}
            <div className="hw-qa-answer">
              {typeof block.content === 'string'
                ? <MarkdownContent content={block.content} noteId={noteId} />
                : Array.isArray(block.content)
                  ? block.content.map((seg, i) => <span key={i}>{seg.text || seg}</span>)
                  : '...'}
            </div>
          </div>
        ))}
      </div>
      <div className="hw-qa-input-row">
        <input
          type="text"
          className="hw-qa-input"
          placeholder="Ask a question about this assignment..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        <button
          className="hw-qa-send-btn"
          onClick={handleSend}
          disabled={!question.trim() || isSending}
        >
          <span className="hw-material-icon">send</span>
        </button>
      </div>
    </div>
  );
}

export default function DraftingArea({ activeNote, activeAssignmentId, submitDraft, runAICheck, sendQuestion }) {
  const [activeTab, setActiveTab] = useState('assignment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);
  const editorRef = useRef(null);
  const editorContainerRef = useRef(null);
  const [wordCount, setWordCount] = useState(0);

  // Tooltip state for highlight annotations
  const [tooltip, setTooltip] = useState({ anchor: null, data: null });
  const tooltipHideTimer = useRef(null);

  // Track whether the user has edited inside highlight spans since the last AI Check.
  // When true, segments are stale — the useEffect should render draft content instead.
  const segmentsStaleRef = useRef(false);
  // Remember which feedbackBlock.id the current segments correspond to,
  // so we can reset staleness when a new AI Check produces fresh segments.
  const renderedFeedbackIdRef = useRef(null);

  // Derive blocks from activeNote
  const noteBlocks = activeNote?.note_blocks || [];
  const assignmentBlock = activeAssignmentId
    ? noteBlocks.find((b) => b.id === activeAssignmentId)
    : noteBlocks.find((b) => b.block_type === 'assignment');
  const assignmentId = assignmentBlock?.id;
  // Draft is linked to the assignment via assignment_ref
  const draftBlock = noteBlocks.find((b) => b.block_type === 'simple_note' && b.role === 'user' && b.assignment_ref === assignmentId);
  // Feedback is linked to the draft block via assignment_ref (backend sets it to the draft block id)
  const feedbackBlock = noteBlocks.find((b) => b.block_type === 'ai_feedback' && (b.assignment_ref === assignmentId || b.assignment_ref === draftBlock?.id));
  const qaBlocks = noteBlocks.filter((b) => b.block_type === 'question');

  // Segments from ai_feedback block — memoized so the reference is stable
  // across re-renders when the feedback block hasn't changed.
  const segments = useMemo(() => {
    if (!feedbackBlock?.content || !Array.isArray(feedbackBlock.content)) return [];
    return feedbackBlock.content;
  }, [feedbackBlock?.id]);

  // Strip @image:X references and collapse excessive newlines for display
  const rawPromptText = assignmentBlock?.content || '';
  const promptText = typeof rawPromptText === 'string'
    ? rawPromptText.replace(/@image:\d+/g, '').replace(/\n{3,}/g, '\n\n').trim()
    : rawPromptText;

  // Calculate word count from editor
  const updateWordCount = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      setWordCount(words);
    }
  }, []);

  // Set editor content when the active note, assignment, or source blocks change.
  useEffect(() => {
    if (!editorRef.current) return;

    // When a fresh AI Check produces new segments, reset staleness.
    // Also reset when switching notes/assignments (no feedback block for this context).
    const feedbackId = feedbackBlock?.id;
    if (feedbackId && feedbackId !== renderedFeedbackIdRef.current) {
      segmentsStaleRef.current = false;
      renderedFeedbackIdRef.current = feedbackId;
    } else if (!feedbackId) {
      // No feedback block — clear staleness so a future AI Check starts fresh
      segmentsStaleRef.current = false;
      renderedFeedbackIdRef.current = null;
    }

    // Determine what to render:
    // 1. Fresh segments that match the draft → render all highlights
    // 2. Segments that differ from the draft → reconcile (keep unchanged highlights, drop stale ones)
    // 3. Stale segments (in-session edit) → skip, render draft content instead
    // 4. No segments → render draft content
    const draftText = typeof draftBlock?.content === 'string' ? draftBlock.content : '';
    const segmentsText = segments.map((s) => s.text || '').join('');

    if (segments.length > 0 && !segmentsStaleRef.current) {
      // Build render chunks: either all segments or reconciled highlights
      let chunks;
      if (segmentsText === draftText.replace(/\r\n/g, '\n').trim() || !draftText.trim()) {
        // No edits — all segments are fresh
        chunks = segments.map((seg) => ({
          text: seg.text,
          type: seg.type,
          highlight: seg.type !== 'plain',
          annotation: seg.annotation,
          word: seg.word,
          phonetic: seg.phonetic,
        }));
      } else {
        // Text was edited since last AI Check — reconcile highlights against draft
        chunks = reconcileHighlights(segments, draftText);
      }

      // Render chunks into the editor
      const container = document.createElement('div');
      chunks.forEach((chunk) => {
        if (chunk.highlight) {
          const span = document.createElement('span');
          if (chunk.type === 'vocab') {
            span.className = 'hw-vocab-highlight';
          } else if (chunk.type === 'correct') {
            span.className = 'hw-highlight-correct';
          } else if (chunk.type === 'suggestion') {
            span.className = 'hw-highlight-suggestion';
          }
          span.textContent = chunk.text;
          span.dataset.type = chunk.type;
          span.dataset.original = chunk.text;
          if (chunk.annotation) span.dataset.annotation = chunk.annotation;
          if (chunk.word) span.dataset.word = chunk.word;
          if (chunk.phonetic) span.dataset.phonetic = chunk.phonetic;
          container.appendChild(span);
        } else {
          // Plain text — convert \n to <br>
          const lines = chunk.text.split('\n');
          lines.forEach((line, i) => {
            if (line) container.appendChild(document.createTextNode(line));
            if (i < lines.length - 1) container.appendChild(document.createElement('br'));
          });
        }
      });
      editorRef.current.innerHTML = container.innerHTML;
      // Clear any stale tooltip
      setTooltip({ anchor: null, data: null });
    } else if (draftBlock?.content && typeof draftBlock.content === 'string') {
      // Stale segments or no segments — render draft content
      const html = /<[a-zA-Z]/.test(draftBlock.content)
        ? draftBlock.content
        : draftBlock.content.replace(/\n/g, '<br>');
      editorRef.current.innerHTML = html;
    } else {
      editorRef.current.innerHTML = '';
    }
    updateWordCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-set innerHTML when blocks actually change
  }, [activeNote?.id, activeAssignmentId, draftBlock?.id, feedbackBlock?.id]);

  const handleEditorInput = useCallback(() => {
    updateWordCount();

    // Per-span staleness: strip highlight styling from edited spans
    // Instead of replacing the node (which kills the cursor), just remove
    // the CSS class and data attributes so it renders as plain text.
    if (editorRef.current) {
      const highlights = editorRef.current.querySelectorAll(
        '.hw-vocab-highlight, .hw-highlight-correct, .hw-highlight-suggestion'
      );
      let changed = false;
      highlights.forEach(span => {
        if (span.textContent !== span.dataset.original) {
          // This span was edited — strip highlight styling, keep the node intact
          span.className = '';
          delete span.dataset.type;
          delete span.dataset.original;
          delete span.dataset.annotation;
          delete span.dataset.word;
          delete span.dataset.phonetic;
          changed = true;
        }
      });
      if (changed) {
        // Segments are now stale — the feedback no longer matches the editor text.
        // Future useEffect runs should render draft content, not segments.
        segmentsStaleRef.current = true;
        // If tooltip was showing on an edited span, hide it
        setTooltip({ anchor: null, data: null });
      }
    }
  }, [updateWordCount]);

  // Clean up stale (class-less) spans on blur to avoid DOM clutter.
  // We don't do this on every input to prevent cursor jumps.
  const handleEditorBlur = useCallback(() => {
    if (!editorRef.current) return;
    const staleSpans = editorRef.current.querySelectorAll('span:not([class])');
    if (staleSpans.length > 0) {
      staleSpans.forEach(span => {
        const textNode = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(textNode, span);
      });
      editorRef.current.normalize();
    }
  }, []);

  // Tooltip handlers: show on hover, hide with delay, toggle on click
  const handleEditorMouseOver = useCallback((e) => {
    const span = e.target.closest('.hw-vocab-highlight, .hw-highlight-correct, .hw-highlight-suggestion');
    if (!span) return;
    clearTimeout(tooltipHideTimer.current);
    setTooltip({
      anchor: span,
      data: {
        type: span.dataset.type,
        annotation: span.dataset.annotation || '',
        word: span.dataset.word || '',
        phonetic: span.dataset.phonetic || '',
      },
    });
  }, []);

  const handleEditorMouseOut = useCallback((e) => {
    const span = e.target.closest('.hw-vocab-highlight, .hw-highlight-correct, .hw-highlight-suggestion');
    if (!span) return;
    // Delay hide to allow mouse to reach the tooltip
    tooltipHideTimer.current = setTimeout(() => {
      setTooltip(prev => prev.anchor === span ? { anchor: null, data: null } : prev);
    }, 200);
  }, []);

  const handleEditorClick = useCallback((e) => {
    const span = e.target.closest('.hw-vocab-highlight, .hw-highlight-correct, .hw-highlight-suggestion');
    if (!span) {
      // Clicked outside any highlight — dismiss tooltip
      setTooltip({ anchor: null, data: null });
      return;
    }
    // Toggle tooltip on click
    setTooltip(prev => {
      if (prev.anchor === span) return { anchor: null, data: null };
      return {
        anchor: span,
        data: {
          type: span.dataset.type,
          annotation: span.dataset.annotation || '',
          word: span.dataset.word || '',
          phonetic: span.dataset.phonetic || '',
        },
      };
    });
  }, []);

  // Submit draft text
  const handleSubmit = async () => {
    if (!activeNote || !editorRef.current) return;
    const text = editorRef.current.innerText || '';
    if (!text.trim()) return;

    setIsSubmitting(true);
    try {
      await submitDraft(activeNote.id, text, draftBlock?.id, assignmentId);
    } finally {
      setIsSubmitting(false);
    }
  };

  // AI Check: first ensure draft is saved, then analyze
  const handleAICheck = async () => {
    if (!activeNote) return;

    setIsAnalyzing(true);
    try {
      // If no draft block yet, save the current text first
      let draftId = draftBlock?.id;
      if (!draftId) {
        const text = editorRef.current?.innerText || '';
        if (text.trim()) {
          const result = await submitDraft(activeNote.id, text, undefined, assignmentId);
          draftId = result?.blockId;
        }
      }

      if (!draftId) {
        console.error('No draft block to analyze');
        setIsAnalyzing(false);
        return;
      }

      await runAICheck(activeNote.id, draftId);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Send Q&A question
  const handleSendQuestion = async (question) => {
    if (!activeNote) return;
    setIsSendingQuestion(true);
    try {
      await sendQuestion(activeNote.id, question, assignmentId);
    } finally {
      setIsSendingQuestion(false);
    }
  };

  const targetWords = assignmentBlock?.metadata_?.targetLength
    ? parseInt(assignmentBlock.metadata_.targetLength, 10) || 0
    : 0;


  if (!activeNote) {
    return (
      <section className="hw-draft-section">
        <div className="hw-draft-empty">
          <span className="hw-material-icon" style={{ fontSize: 48, color: 'var(--hw-outline-variant)' }}>
            edit_note
          </span>
          <p>Select an assignment to begin writing</p>
        </div>
      </section>
    );
  }

  return (
    <section className="hw-draft-section">
      {/* Tabs Header */}
      <div className="hw-tabs">
        <button
          className={`hw-tab ${activeTab === 'assignment' ? 'hw-tab--active' : ''}`}
          onClick={() => setActiveTab('assignment')}
        >
          Assignment
        </button>
        <button
          className={`hw-tab ${activeTab === 'qa' ? 'hw-tab--active' : ''}`}
          onClick={() => setActiveTab('qa')}
        >
          AI Q&A
        </button>
      </div>

      {/* Assignment tab — always in DOM, hidden via CSS to preserve editor state */}
      <div style={{ display: activeTab === 'assignment' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Assignment Prompt */}
        {promptText && (
          <div className="hw-assignment-prompt">
            <div className="hw-assignment-prompt-label">
              <span className="hw-material-icon">description</span>
              Assignment Prompt
            </div>
            <div className="hw-assignment-prompt-text"><MarkdownContent content={promptText} noteId={activeNote?.id} /></div>
          </div>
        )}

        {/* Editor Toolbar */}
        <div className="hw-toolbar">
          <div className="hw-toolbar-group">
            <button className="hw-tool-btn" title="Bold">
              <span className="hw-material-icon">format_bold</span>
            </button>
            <button className="hw-tool-btn" title="Italic">
              <span className="hw-material-icon">format_italic</span>
            </button>
            <button className="hw-tool-btn" title="Underline">
              <span className="hw-material-icon">format_underlined</span>
            </button>
          </div>
          <div className="hw-toolbar-group">
            <button className="hw-tool-btn" title="Bullet List">
              <span className="hw-material-icon">format_list_bulleted</span>
            </button>
            <button className="hw-tool-btn" title="Numbered List">
              <span className="hw-material-icon">format_list_numbered</span>
            </button>
          </div>
          <div className="hw-toolbar-autosave">
            <span className="hw-autosave-dot" />
            Autosaved
          </div>
        </div>

        {/* Rich Text Editor */}
        <div className="hw-editor" ref={editorContainerRef}>
          <div
            ref={editorRef}
            className="hw-editor-content"
            contentEditable
            suppressContentEditableWarning
            style={{ outline: 'none' }}
            onInput={handleEditorInput}
            onBlur={handleEditorBlur}
            onMouseOver={handleEditorMouseOver}
            onMouseOut={handleEditorMouseOut}
            onClick={handleEditorClick}
          />
          {tooltip.anchor && tooltip.data && editorContainerRef.current && (
            <FeedbackTooltip
              anchor={tooltip.anchor}
              data={tooltip.data}
              editorRect={editorContainerRef.current.getBoundingClientRect()}
              onMouseEnter={() => clearTimeout(tooltipHideTimer.current)}
              onMouseLeave={() => {
                tooltipHideTimer.current = setTimeout(() => {
                  setTooltip({ anchor: null, data: null });
                }, 200);
              }}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="hw-draft-footer">
          <span className="hw-word-count">
            Word count: {wordCount}{targetWords ? ` / ${targetWords}` : ''}
          </span>
          <div className="hw-draft-actions">
            <button
              className="hw-ai-check-btn"
              onClick={handleAICheck}
              disabled={isAnalyzing || isSubmitting}
            >
              <span className="hw-material-icon">neurology</span>
              {isAnalyzing ? 'Analyzing...' : 'AI Check'}
            </button>
            <button
              className="hw-submit-btn"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              <span className="hw-material-icon">send</span>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>

      {/* Q&A tab — always in DOM, hidden via CSS */}
      <div style={{ display: activeTab === 'qa' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <QATab
          qaBlocks={qaBlocks}
          onSendQuestion={handleSendQuestion}
          isSending={isSendingQuestion}
          noteId={activeNote?.id}
        />
      </div>
    </section>
  );
}