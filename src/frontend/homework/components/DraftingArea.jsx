import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { useFloating, autoUpdate, offset, flip, shift } from '@floating-ui/react';
import StarterKit from '@tiptap/starter-kit';
import MarkdownContent from '../../notewindow/components/MarkdownContent.jsx';
import { reconcileHighlights } from '../utils/reconcileHighlights';
import HomeworkToolbar from './HomeworkToolbar.jsx';
import { useWordlist } from '../../wordlist/WordlistContext';
import { FeedbackMark } from '../extensions/FeedbackMark';
import { PlainTextPaste } from '../extensions/PlainTextPaste';
import { FeedbackStaleness } from '../extensions/FeedbackStaleness';
import {
  plainTextToDocJSON,
  chunksToDocJSON,
  docToPlainText,
  sentenceAtPos,
  loadEditorContent,
  countWords,
} from '../utils/draftDoc';

const FEEDBACK_HIGHLIGHT_SELECTOR = '[data-feedback]';

// Read the `feedback` mark at a hovered/clicked highlight DOM span.
function getFeedbackMarkAt(editor, target) {
  if (!editor) return null;
  const view = editor.view;
  const pos = view.posAtDOM(target, 0);
  if (pos == null) return null;
  const doc = editor.state.doc;
  const max = doc.content.size;
  const candidates = [pos + 1, pos, Math.max(pos - 1, 0)].filter((p) => p <= max);
  for (const p of candidates) {
    const resolved = doc.resolve(p);
    const mark = resolved.marks().find((m) => m.type.name === 'feedback');
    if (mark) return mark;
  }
  const node = doc.nodeAt(pos);
  if (node) {
    const mark = node.marks.find((m) => m.type.name === 'feedback');
    if (mark) return mark;
  }
  return null;
}

// Floating tooltip showing a highlight's annotation. Positioning is handled by
// @floating-ui/react (portaled to <body> with strategy:'fixed'), so it is no
// longer clipped by the .hw-editor scroll container.
function FeedbackTooltip({ data, setFloating, style, onMouseEnter, onMouseLeave }) {
  if (!data) return null;

  const typeConfig = {
    suggestion: { label: '✏️ Suggestion', accentClass: 'hw-feedback-tooltip--suggestion' },
    vocab:      { label: '📖 Vocabulary', accentClass: 'hw-feedback-tooltip--vocab' },
    correct:    { label: '✅ Correct', accentClass: 'hw-feedback-tooltip--correct' },
  };
  const config = typeConfig[data.type] || typeConfig.correct;

  return (
    <div
      ref={setFloating}
      style={style}
      className={`hw-feedback-tooltip ${config.accentClass}`}
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
          <p className="hw-qa-empty">No questions yet. Ask something about this assignment!</p>
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
          {isSending ? <span className="hw-spinner" /> : <span className="hw-material-icon">send</span>}
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
  const [wordCount, setWordCount] = useState(0);
  const lastWordCountRef = useRef(0);

  // Selection toolbar state (text + sentence come from the editor selection)
  const hwToolbarRef = useRef(null);
  const [hwSelectedText, setHwSelectedText] = useState('');
  const [hwSelectedSentence, setHwSelectedSentence] = useState(null);

  // Wordlist integration
  const {
    wordlists,
    addWordToList,
    moveWordBetweenLists,
    createNewListWithWord,
  } = useWordlist();

  // Hover/click tooltip state for highlight annotations
  const [tooltip, setTooltip] = useState({ anchorEl: null, data: null });
  const tooltipHideTimerRef = useRef(null);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const hintsEnabledRef = useRef(true);
  useEffect(() => { hintsEnabledRef.current = hintsEnabled; }, [hintsEnabled]);
  // Clear any pending tooltip hide timer on unmount (avoids a dangling setTimeout).
  useEffect(() => () => clearTimeout(tooltipHideTimerRef.current), []);

  // Staleness: tracks in-session edits to highlights so a re-render doesn't
  // re-apply stale segments. Reset when a fresh AI Check changes feedbackBlock.id.
  const segmentsStaleRef = useRef(false);
  const renderedFeedbackIdRef = useRef(null);

  // Derive blocks from activeNote
  const noteBlocks = activeNote?.note_blocks || [];
  const assignmentBlock = activeAssignmentId
    ? noteBlocks.find((b) => b.id === activeAssignmentId)
    : noteBlocks.find((b) => b.block_type === 'assignment');
  const assignmentId = assignmentBlock?.id;
  const draftBlock = noteBlocks.find((b) => b.block_type === 'simple_note' && b.role === 'user' && b.assignment_ref === assignmentId);
  const feedbackBlock = noteBlocks.find((b) => b.block_type === 'ai_feedback' && (b.assignment_ref === assignmentId || b.assignment_ref === draftBlock?.id));
  const qaBlocks = noteBlocks.filter((b) => b.block_type === 'question');

  const segments = useMemo(() => {
    if (!feedbackBlock?.content || !Array.isArray(feedbackBlock.content)) return [];
    return feedbackBlock.content;
  }, [feedbackBlock?.id]);

  const rawPromptText = assignmentBlock?.content || '';
  const promptText = typeof rawPromptText === 'string'
    ? rawPromptText.replace(/@image:\d+/g, '').replace(/\n{3,}/g, '\n\n').trim()
    : rawPromptText;

  const targetWords = assignmentBlock?.metadata_?.targetLength
    ? parseInt(assignmentBlock.metadata_.targetLength, 10) || 0
    : 0;

  // Tiptap editor instance ref (the editor is null on first render).
  const editorInstRef = useRef(null);

  // Tooltip hover/click handlers — stable, read state via refs so the DOM event
  // listeners bound once by ProseMirror keep working.
  const handleHighlightHover = useCallback((event, isOver) => {
    const target = event.target.closest(FEEDBACK_HIGHLIGHT_SELECTOR);
    if (!target) return;
    if (isOver) {
      if (!hintsEnabledRef.current) return;
      clearTimeout(tooltipHideTimerRef.current);
      const mark = getFeedbackMarkAt(editorInstRef.current, target);
      if (!mark) return;
      setTooltip({
        anchorEl: target,
        data: {
          type: mark.attrs.type,
          annotation: mark.attrs.annotation || '',
          word: mark.attrs.word || '',
          phonetic: mark.attrs.phonetic || '',
        },
      });
    } else {
      tooltipHideTimerRef.current = setTimeout(() => setTooltip({ anchorEl: null, data: null }), 200);
    }
  }, []);

  const handleHighlightClick = useCallback((event) => {
    const target = event.target.closest(FEEDBACK_HIGHLIGHT_SELECTOR);
    if (!target) {
      setTooltip({ anchorEl: null, data: null });
      return;
    }
    if (!hintsEnabledRef.current) return;
    const mark = getFeedbackMarkAt(editorInstRef.current, target);
    if (!mark) return;
    setTooltip((prev) => prev.anchorEl === target
      ? { anchorEl: null, data: null }
      : {
          anchorEl: target,
          data: {
            type: mark.attrs.type,
            annotation: mark.attrs.annotation || '',
            word: mark.attrs.word || '',
            phonetic: mark.attrs.phonetic || '',
          },
        });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Plain-text only: disable all formatting.
        bold: false, italic: false, strike: false, code: false, underline: false,
        heading: false, bulletList: false, orderedList: false, listItem: false,
        blockquote: false, horizontalRule: false, link: false, listKeymap: false,
        trailingNode: false,
        // Undo/redo: 100 entries, 500ms group delay (matches the old burst grouping).
        undoRedo: { depth: 100, newGroupDelay: 500 },
      }),
      FeedbackMark,
      FeedbackStaleness.configure({
        onStale: () => { segmentsStaleRef.current = true; },
      }),
      PlainTextPaste,
    ],
    content: '<p></p>',
    editorProps: {
      attributes: { class: 'hw-editor-content' },
      handleDOMEvents: {
        mouseover: (_view, event) => handleHighlightHover(event, true),
        mouseout: (_view, event) => handleHighlightHover(event, false),
        click: (_view, event) => handleHighlightClick(event),
      },
    },
    onTransaction: ({ editor: e, transaction }) => {
      if (!transaction.docChanged) return;
      // Guard: only setState when the count actually changed (React would bail
      // anyway, but this skips the getText() recompute on the next render path
      // and avoids needless DraftingArea re-renders for non-word-changing edits).
      const wc = countWords(e.getText());
      if (wc !== lastWordCountRef.current) {
        lastWordCountRef.current = wc;
        setWordCount(wc);
      }
    },
    onSelectionUpdate: ({ editor: e }) => {
      const { from, to, empty } = e.state.selection;
      if (empty || from === to) {
        setHwSelectedText('');
        setHwSelectedSentence(null);
        return;
      }
      setHwSelectedText(e.state.doc.textBetween(from, to, '\n').trim());
      setHwSelectedSentence(sentenceAtPos(e.state.doc, from));
    },
  });

  useEffect(() => { editorInstRef.current = editor; }, [editor]);

  // Floating tooltip positioning (portaled, fixed strategy -> no scroll clipping).
  const { refs, floatingStyles, update } = useFloating({
    placement: 'bottom',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => {
    if (tooltip.anchorEl) {
      refs.setReference(tooltip.anchorEl);
      // Compute now (the reference is already in the DOM) and again after paint,
      // in case fonts/layout shift the anchor's rect after first commit.
      update();
      const raf = requestAnimationFrame(update);
      return () => cancelAnimationFrame(raf);
    }
    refs.setReference(null);
  }, [tooltip.anchorEl, refs, update]);

  // Load content when the active note / assignment / draft / feedback changes.
  useEffect(() => {
    if (!editor) return;

    const feedbackId = feedbackBlock?.id;
    if (feedbackId && feedbackId !== renderedFeedbackIdRef.current) {
      segmentsStaleRef.current = false;
      renderedFeedbackIdRef.current = feedbackId;
    } else if (!feedbackId) {
      segmentsStaleRef.current = false;
      renderedFeedbackIdRef.current = null;
    }

    // Normalize once: \r\n -> \n. This normalized value is used both for the
    // exact-match check and passed to reconcileHighlights, so a backend that
    // returns \r\n doesn't cause the LCS diff to drop every highlight.
    const draftText = typeof draftBlock?.content === 'string'
      ? draftBlock.content.replace(/\r\n/g, '\n')
      : '';
    let docJSON;
    if (segments.length > 0 && !segmentsStaleRef.current) {
      const segmentsText = segments.map((s) => s.text || '').join('');
      // Use segments directly only on an EXACT (un-trimmed) match, so any
      // leading/trailing whitespace present in the draft but not in the segments
      // isn't silently dropped. Otherwise reconcile against the draft text,
      // which rebuilds from the draft (preserving its whitespace) and drops
      // only stale highlights.
      const chunks = (segmentsText === draftText || !draftText.trim())
        ? segments.map((seg) => ({
            text: seg.text,
            type: seg.type,
            highlight: seg.type !== 'plain',
            annotation: seg.annotation,
            word: seg.word,
            phonetic: seg.phonetic,
          }))
        : reconcileHighlights(segments, draftText);
      docJSON = chunksToDocJSON(chunks);
    } else if (draftText) {
      docJSON = plainTextToDocJSON(draftText);
    } else {
      docJSON = plainTextToDocJSON('');
    }

    loadEditorContent(editor, docJSON);
    setTooltip({ anchorEl: null, data: null });
    const wc = countWords(editor.getText());
    lastWordCountRef.current = wc;
    setWordCount(wc);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when blocks change
  }, [editor, activeNote?.id, activeAssignmentId, draftBlock?.id, feedbackBlock?.id]);

  const getDraftText = useCallback(() => {
    const e = editorInstRef.current;
    return e ? docToPlainText(e.state.doc) : '';
  }, []);

  const handleSubmit = async () => {
    if (!activeNote || !editor) return;
    const text = getDraftText();
    if (!text.trim()) return;
    setIsSubmitting(true);
    try {
      await submitDraft(activeNote.id, text, draftBlock?.id, assignmentId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAICheck = async () => {
    if (!activeNote || !editor) return;
    setIsAnalyzing(true);
    try {
      let draftId = draftBlock?.id;
      if (!draftId) {
        const text = getDraftText();
        if (text.trim()) {
          const result = await submitDraft(activeNote.id, text, undefined, assignmentId);
          draftId = result?.blockId;
        }
      }
      if (!draftId) {
        // No draft to analyze (empty editor, no existing draft) — not a system
        // error. Warn rather than console.error so it doesn't trip console.spec.ts.
        console.warn('No draft block to analyze');
        setIsAnalyzing(false);
        return;
      }
      await runAICheck(activeNote.id, draftId);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendQuestion = async (question) => {
    if (!activeNote) return;
    setIsSendingQuestion(true);
    try {
      await sendQuestion(activeNote.id, question, assignmentId);
    } finally {
      setIsSendingQuestion(false);
    }
  };

  // Selection toolbar handlers
  const handleToolbarAddToList = useCallback(async (text, listId) => {
    if (!text.trim()) return null;
    return addWordToList(text, listId, hwSelectedSentence);
  }, [addWordToList, hwSelectedSentence]);

  const handleToolbarMoveToList = useCallback(async (text, sourceListId, targetListId) => {
    if (!text.trim() || sourceListId === targetListId) return null;
    return moveWordBetweenLists(text, sourceListId, targetListId);
  }, [moveWordBetweenLists]);

  const handleToolbarCreateNewList = useCallback(async (text) => {
    if (!text.trim()) return null;
    return createNewListWithWord(text, null, hwSelectedSentence);
  }, [createNewListWithWord, hwSelectedSentence]);

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

  const bubbleMenuShouldShow = ({ state }) => {
    const { empty, from, to } = state.selection;
    return !empty && from !== to;
  };

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

        {/* Editor Toolbar (autosave indicator only — plain-text editor) */}
        <div className="hw-toolbar">
          <div className="hw-toolbar-autosave">
            <span className="hw-autosave-dot" />
            Autosaved
          </div>
        </div>

        {/* Tiptap editor */}
        <div className="hw-editor">
          <EditorContent editor={editor} />
          {editor && (
            <BubbleMenu editor={editor} shouldShow={bubbleMenuShouldShow}>
              <HomeworkToolbar
                toolbarRef={hwToolbarRef}
                style={{}}
                selectedText={hwSelectedText}
                wordLists={wordlists}
                onAddToList={handleToolbarAddToList}
                onMoveToList={handleToolbarMoveToList}
                onCreateNewList={handleToolbarCreateNewList}
                isVisible
              />
            </BubbleMenu>
          )}
        </div>

        {/* Footer Actions */}
        <div className="hw-draft-footer">
          <div className="hw-draft-footer-left">
            <span className="hw-word-count">
              Word count: {wordCount}{targetWords ? ` / ${targetWords}` : ''}
            </span>
            <button
              className={`hw-hints-toggle ${hintsEnabled ? 'hw-hints-toggle--active' : ''}`}
              onClick={() => {
                setHintsEnabled(prev => !prev);
                if (hintsEnabled) setTooltip({ anchorEl: null, data: null });
              }}
              title={hintsEnabled ? 'Hide hints on hover' : 'Show hints on hover'}
            >
              <span className="hw-material-icon">{hintsEnabled ? 'visibility' : 'visibility_off'}</span>
            </button>
          </div>
          <div className="hw-draft-actions">
            <button
              className="hw-ai-check-btn"
              onClick={handleAICheck}
              disabled={isAnalyzing || isSubmitting}
            >
              {isAnalyzing ? <span className="hw-spinner" /> : <span className="hw-material-icon">neurology</span>}
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

      {/* Feedback tooltip — portaled to <body> so .hw-editor overflow can't clip it */}
      {tooltip.anchorEl && tooltip.data && createPortal(
        <FeedbackTooltip
          data={tooltip.data}
          setFloating={refs.setFloating}
          style={floatingStyles}
          onMouseEnter={() => clearTimeout(tooltipHideTimerRef.current)}
          onMouseLeave={() => {
            tooltipHideTimerRef.current = setTimeout(() => setTooltip({ anchorEl: null, data: null }), 200);
          }}
        />,
        document.body
      )}
    </section>
  );
}