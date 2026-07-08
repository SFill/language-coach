import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import MarkdownContent from '../../notewindow/components/MarkdownContent';
import HomeworkToolbar from './HomeworkToolbar.jsx';
import FeedbackTooltip from './FeedbackTooltip';
import QATab from './QATab';
import { useDraftTooltip } from '../hooks/useDraftTooltip';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { useDraftSelectionToolbar } from '../hooks/useDraftSelectionToolbar';
import { useDraftEditor } from '../hooks/useDraftEditor';
import { useDraftContentLoader } from '../hooks/useDraftContentLoader';

interface NoteBlock {
  id: string;
  block_type?: string;
  role?: string;
  assignment_ref?: string;
  content?: string | unknown[];
  metadata_?: { targetLength?: string | number; [key: string]: unknown };
}

interface ActiveNote {
  id: number | string;
  note_blocks?: NoteBlock[];
}

type SubmitDraft = (
  noteId: number | string,
  text: string,
  blockId: string,
  assignmentRef?: string,
) => Promise<{ blockId: string } | null | undefined>;

interface DraftingAreaProps {
  activeNote: ActiveNote | null;
  activeAssignmentId: string | undefined;
  submitDraft: SubmitDraft;
  runAICheck: (noteId: number | string, blockId: string) => Promise<unknown>;
  sendQuestion: (noteId: number | string, question: string, assignmentRef?: string) => Promise<unknown>;
}

export default function DraftingArea({
  activeNote,
  activeAssignmentId,
  submitDraft,
  runAICheck,
  sendQuestion,
}: DraftingAreaProps) {
  const [activeTab, setActiveTab] = useState<'assignment' | 'qa'>('assignment');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const lastWordCountRef = useRef(0);

  // Selection toolbar state + wordlist wiring for the editor's BubbleMenu.
  const {
    hwToolbarRef,
    hwSelectedText,
    setHwSelectedText,
    setHwSelectedSentence,
    handleToolbarAddToList,
    handleToolbarMoveToList,
    handleToolbarCreateNewList,
    wordlists,
  } = useDraftSelectionToolbar();

  // Tiptap editor instance ref (the editor is null on first render). Shared by
  // the tooltip hook (hover/click handlers), the editor sync effect, and the
  // content loader.
  const editorInstRef = useRef<Editor | null>(null);
  // True while a programmatic editor load (loadEditorContent) is replacing the
  // doc. The content loader sets it so the resulting onTransaction — which has
  // docChanged=true even when the content is identical — does NOT re-schedule a
  // spurious autosave (the cause of the "Editing → saving → Editing → saved"
  // flicker: the autosave's own refresh reloaded the editor and re-armed itself).
  const suppressAutosaveRef = useRef(false);

  // Hover/click tooltip state for highlight annotations
  const {
    tooltip,
    setTooltip,
    hintsEnabled,
    toggleHints,
    handleHighlightHover,
    handleHighlightClick,
    floatingRefs: tooltipRefs,
    floatingStyles: tooltipFloatingStyles,
    tooltipHideTimerRef,
  } = useDraftTooltip({ editorInstRef });

  // Staleness: tracks in-session edits to highlights so a re-render doesn't
  // re-apply stale segments. Shared with the editor (FeedbackStaleness onStale)
  // and the content loader (reset on feedbackId change / clean slate).
  const segmentsStaleRef = useRef(false);

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

  const rawPromptText = assignmentBlock?.content;
  const promptText = typeof rawPromptText === 'string'
    ? rawPromptText.replace(/@image:\d+/g, '').replace(/\n{3,}/g, '\n\n').trim()
    : '';

  const targetWords = assignmentBlock?.metadata_?.targetLength
    ? parseInt(String(assignmentBlock.metadata_.targetLength), 10) || 0
    : 0;

  // Debounced draft autosave. Runs before useEditor so the editor's onTransaction
  // can dispatch through scheduleAutosaveRef. The coordinator + refs live in the
  // hook; lastSavedTextRef is borrowed by the content-load effect below.
  const {
    coordinator,
    scheduleAutosaveRef,
    autosaveStatus,
    lastSavedTextRef,
  } = useDraftAutosave({ editorInstRef, activeNote, assignmentId, draftBlockId: draftBlock?.id, submitDraft });

  const editor = useDraftEditor({
    handleHighlightHover,
    handleHighlightClick,
    scheduleAutosaveRef,
    suppressAutosaveRef,
    lastWordCountRef,
    setWordCount,
    setHwSelectedText,
    setHwSelectedSentence,
    segmentsStaleRef,
  });

  useEffect(() => { editorInstRef.current = editor; }, [editor]);

  // Load editor content when the active note / assignment / draft / feedback
  // changes (clobber guard + suppress flag + reconcile + context-switch flush).
  useDraftContentLoader({
    editor,
    activeNote,
    activeAssignmentId,
    assignmentId,
    draftBlock,
    feedbackBlock,
    segments,
    coordinator,
    setTooltip,
    setWordCount,
    lastWordCountRef,
    lastSavedTextRef,
    segmentsStaleRef,
    suppressAutosaveRef,
  });

  const handleAICheck = async () => {
    if (!activeNote || !editor) return;
    setIsAnalyzing(true);
    try {
      // Flush any pending autosave so AI analyzes the latest draft text, not a
      // stale server snapshot. flush() returns { blockId } when it persisted a
      // draft, or null when nothing was dirty (AI Check is disabled while a save
      // is in flight, so we never hit the in-flight null case here).
      const result = await coordinator.flush();
      const draftId = result?.blockId || draftBlock?.id;
      if (!draftId) {
        // No draft to analyze (empty editor, no existing draft) — not a system
        // error. Warn rather than console.error so it doesn't trip console.spec.ts.
        console.warn('No draft block to analyze');
        return;
      }
      await runAICheck(activeNote.id, draftId);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendQuestion = async (question: string) => {
    if (!activeNote) return;
    setIsSendingQuestion(true);
    try {
      await sendQuestion(activeNote.id, question, assignmentId);
    } finally {
      setIsSendingQuestion(false);
    }
  };

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

  const bubbleMenuShouldShow = ({ state }: { state: { selection: { empty: boolean; from: number; to: number } } }) => {
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
          <div className={`hw-toolbar-autosave hw-autosave--${autosaveStatus}`}>
            <span className="hw-autosave-dot" />
            {autosaveStatus === 'saving' ? 'Saving…' : autosaveStatus === 'pending' ? 'Editing…' : 'Saved'}
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
              onClick={toggleHints}
              title={hintsEnabled ? 'Hide hints on hover' : 'Show hints on hover'}
            >
              <span className="hw-material-icon">{hintsEnabled ? 'visibility' : 'visibility_off'}</span>
            </button>
          </div>
          <div className="hw-draft-actions">
            <button
              className="hw-ai-check-btn"
              onClick={handleAICheck}
              disabled={isAnalyzing || autosaveStatus === 'saving'}
            >
              {isAnalyzing ? <span className="hw-spinner" /> : <span className="hw-material-icon">neurology</span>}
              {isAnalyzing ? 'Analyzing...' : 'AI Check'}
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
          setFloating={tooltipRefs.setFloating}
          style={tooltipFloatingStyles}
          onMouseEnter={() => { if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current); }}
          onMouseLeave={() => {
            tooltipHideTimerRef.current = setTimeout(() => setTooltip({ anchorEl: null, data: null }), 200);
          }}
        />,
        document.body
      )}
    </section>
  );
}