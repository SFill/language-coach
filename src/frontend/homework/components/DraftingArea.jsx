import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

function QATab({ qaBlocks, onSendQuestion, isSending }) {
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
                ? block.content
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

export default function DraftingArea({ activeNote, submitDraft, runAICheck, sendQuestion }) {
  const [activeTab, setActiveTab] = useState('assignment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);
  const editorRef = useRef(null);
  const [wordCount, setWordCount] = useState(0);
  // Local draft state — survives tab switches (contentEditable gets unmounted)
  const [localDraft, setLocalDraft] = useState(null);

  // Derive blocks from activeNote
  const noteBlocks = activeNote?.note_blocks || [];
  const assignmentBlock = noteBlocks.find((b) => b.block_type === 'assignment');
  const assignmentId = assignmentBlock?.id;
  // Draft and feedback are linked to the active assignment via assignment_ref
  const draftBlock = noteBlocks.find((b) => b.block_type === 'simple_note' && b.role === 'user' && b.assignment_ref === assignmentId);
  const feedbackBlock = noteBlocks.find((b) => b.block_type === 'ai_feedback' && b.assignment_ref === assignmentId);
  const qaBlocks = noteBlocks.filter((b) => b.block_type === 'question');

  // Segments from ai_feedback block — memoized so the reference is stable
  // across re-renders when the feedback block hasn't changed.
  const segments = useMemo(() => {
    if (!feedbackBlock?.content || !Array.isArray(feedbackBlock.content)) return [];
    return feedbackBlock.content;
  }, [feedbackBlock?.id]);

  // Clear local draft when switching to a different note
  useEffect(() => {
    setLocalDraft(null);
  }, [activeNote?.id]);

  // Strip @image:X references from prompt text for display
  const rawPromptText = assignmentBlock?.content || '';
  const promptText = typeof rawPromptText === 'string'
    ? rawPromptText.replace(/@image:\d+/g, '').trim()
    : rawPromptText;

  // Calculate word count from editor
  const updateWordCount = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      setWordCount(words);
    }
  }, []);

  // Set editor content only when the source blocks change (new note selected,
  // draft saved, AI feedback arrived). Not on every re-render from word count etc.
  useEffect(() => {
    if (!editorRef.current) return;

    // Priority: server draft > local unsaved draft > segments > nothing
    if (draftBlock?.content && typeof draftBlock.content === 'string') {
      editorRef.current.innerHTML = draftBlock.content;
      setLocalDraft(null); // server draft overrides local
    } else if (localDraft) {
      // Restore unsaved local text after tab switch remount
      editorRef.current.innerHTML = localDraft;
    } else if (segments.length > 0) {
      // Render segmented content imperatively
      const container = document.createElement('div');
      segments.forEach((seg) => {
        const span = document.createElement('span');
        if (seg.type === 'vocab') {
          span.className = 'hw-vocab-highlight';
          span.textContent = seg.text;
          container.appendChild(span);
        } else if (seg.type === 'correct') {
          span.className = 'hw-highlight-correct';
          span.textContent = seg.text;
          container.appendChild(span);
        } else if (seg.type === 'suggestion') {
          span.className = 'hw-highlight-suggestion';
          span.textContent = seg.text;
          container.appendChild(span);
        } else {
          span.textContent = seg.text;
          container.appendChild(span);
        }
      });
      editorRef.current.innerHTML = container.innerHTML;
    }
    updateWordCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-set innerHTML when blocks actually change
  }, [activeNote?.id, draftBlock?.id, feedbackBlock?.id]);

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      setLocalDraft(editorRef.current.innerHTML);
    }
    updateWordCount();
  }, [updateWordCount]);

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
            <p className="hw-assignment-prompt-text">{promptText}</p>
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
        <div className="hw-editor">
          <div
            ref={editorRef}
            className="hw-editor-content"
            contentEditable
            suppressContentEditableWarning
            style={{ outline: 'none' }}
            onInput={handleEditorInput}
          />
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
        />
      </div>
    </section>
  );
}