import { useState, type KeyboardEvent } from 'react';
import MarkdownContent from '../../notewindow/components/MarkdownContent';

interface QaSegment {
  text?: string;
}

interface QaBlock {
  id: string;
  question_title?: string;
  content?: string | QaSegment[];
}

interface QATabProps {
  qaBlocks: QaBlock[];
  onSendQuestion: (question: string) => void;
  isSending: boolean;
  noteId: number | string;
}

export default function QATab({ qaBlocks, onSendQuestion, isSending, noteId }: QATabProps) {
  const [question, setQuestion] = useState('');

  const handleSend = () => {
    if (!question.trim() || isSending) return;
    onSendQuestion(question.trim());
    setQuestion('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
                  ? block.content.map((seg, i) => <span key={i}>{seg.text || ''}</span>)
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