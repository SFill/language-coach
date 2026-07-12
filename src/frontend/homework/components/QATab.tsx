import { useRef, useState, type KeyboardEvent } from 'react';
import MarkdownContent from '../../notewindow/components/MarkdownContent';

interface QaSegment {
  text?: string;
}

interface QaBlock {
  id: string;
  question_title?: string;
  question?: string;
  content?: string | QaSegment[];
}

interface QATabProps {
  qaBlocks: QaBlock[];
  onSendQuestion: (question: string, priorQaId?: string) => void;
  onDeleteInquiry: (blockId: string) => void;
  isSending: boolean;
  noteId: number | string;
}

export default function QATab({ qaBlocks, onSendQuestion, onDeleteInquiry, isSending, noteId }: QATabProps) {
  const [question, setQuestion] = useState('');
  // UUID of the Q&A block the user is "editing" (pencil) — sent as prior_qa_id so
  // the backend uses that specific Q&A as follow-up context, not just the last one.
  const [followUpBlockId, setFollowUpBlockId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!question.trim() || isSending) return;
    onSendQuestion(question.trim(), followUpBlockId ?? undefined);
    setQuestion('');
    setFollowUpBlockId(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const originalQuestion = (block: QaBlock) => block.question || block.question_title || '';

  const handleCopyQuestion = (block: QaBlock) => {
    const text = originalQuestion(block);
    if (!text) return;
    navigator.clipboard?.writeText(text);
  };

  const handleEditAgain = (block: QaBlock) => {
    setQuestion(originalQuestion(block));
    setFollowUpBlockId(block.id);
    inputRef.current?.focus();
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
                  ? block.content.map((seg, i) => <span key={i}>{seg.text || ''}</span>)
                  : '...'}
            </div>
            <div className="hw-qa-actions">
              <button
                type="button"
                className="hw-qa-action-btn"
                title="Copy question"
                onClick={() => handleCopyQuestion(block)}
              >
                <span className="hw-material-icon">content_copy</span>
              </button>
              <button
                type="button"
                className="hw-qa-action-btn"
                title="Edit and ask again"
                onClick={() => handleEditAgain(block)}
              >
                <span className="hw-material-icon">edit</span>
              </button>
              <button
                type="button"
                className="hw-qa-action-btn hw-qa-action-btn--danger"
                title="Delete inquiry"
                onClick={() => onDeleteInquiry(block.id)}
              >
                <span className="hw-material-icon">delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="hw-qa-input-row">
        <textarea
          ref={inputRef}
          className="hw-qa-input"
          placeholder="Ask a question about this assignment… (Enter to send, Shift+Enter for a new line)"
          value={question}
          rows={1}
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