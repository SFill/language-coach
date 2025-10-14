import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import MessageBubble from './components/MessageBubble';
import TranslatableContent from './components/TranslatableContent';
import MessageInput from '../MessageInput';
import ChatTile from './ChatTile';
import './ChatMessage.css';
import './ChatTile.css';
import deleteIcon from '../assets/delete-message.png';
import editIcon from '../assets/edit-mesage.png';
import { deleteMessage, updateMessage } from '../api';

const FOLD_THRESHOLD = 300; // Character threshold to consider a message long

/**
 * Complete chat message component
 */
const ChatMessage = React.forwardRef(({
  msg,
  onTextSelect,
  chatId,
  onDelete,
  onEdit,
  tiles = [],
  onSendQuestion,
  onRetryTile
}, ref) => {
  const isBot = msg.sender === 'bot';
  const isNote = msg.is_note || false;
  const messageId = msg.id;
  const contentRef = useRef(null);
  const [displayText, setDisplayText] = useState(msg.content);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(msg.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const canManageNote = true;

  useEffect(() => {
    setDisplayText(msg.content);
    setDraftText(msg.content);
  }, [msg.content]);

  useImperativeHandle(ref, () => ({
    get currentRange() {
      return contentRef.current?.currentRange;
    },
    handleTranslate: (...args) => contentRef.current?.handleTranslate?.(...args),
    handleRollback: (...args) => contentRef.current?.handleRollback?.(...args),
    handleGlobalSelection: (...args) => contentRef.current?.handleGlobalSelection?.(...args),
    checkSelectionWithinContainer: (...args) => contentRef.current?.checkSelectionWithinContainer?.(...args)
  }));

  const handleEditToggle = () => {
    if (isDeleting || isEditing) return;
    setDraftText(displayText);
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setDraftText(displayText);
  };

  const handleEditSave = async () => {
    const trimmed = draftText.trim();
    if (!trimmed || trimmed === displayText || isWorking) {
      setIsEditing(false);
      setDraftText(displayText);
      return;
    }

    try {
      setIsWorking(true);
      await updateMessage(chatId, messageId, trimmed);
      setDisplayText(trimmed);
      setDraftText(trimmed);
      setIsEditing(false);
      if (onEdit) onEdit(trimmed);
    } catch (error) {
      console.error('Failed to update note', error);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting || isWorking) return;

    try {
      setIsWorking(true);
      await deleteMessage(chatId, messageId);
      setIsDeleting(true);
      setTimeout(() => {
        setIsRemoved(true);
        if (onDelete) onDelete(messageId);
      }, 220);
    } catch (error) {
      console.error('Failed to delete note', error);
      setIsDeleting(false);
    } finally {
      setIsWorking(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!questionText.trim() || isAskingQuestion || !onSendQuestion) return;

    try {
      setIsAskingQuestion(true);
      await onSendQuestion(questionText.trim(), messageId);
      setQuestionText('');
    } catch (error) {
      console.error('Failed to ask question:', error);
    } finally {
      setIsAskingQuestion(false);
    }
  };

  const handleQuestionKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  if (isRemoved) return null;

  return (
    <div className={`note-container${isDeleting ? ' note-container--deleting' : ''}`}>
      <div className={`note-actions${isNote ? ' note-actions--sticky' : ''}`} aria-hidden={isEditing}>
        <button
          type="button"
          className="note-action-button"
          onClick={handleEditToggle}
          disabled={isEditing || isWorking}
          title="Edit note"
          style={{ backgroundImage: `url(${editIcon})` }}
        >
          <span className="visually-hidden">Edit note</span>
        </button>
        <button
          type="button"
          className="note-action-button"
          onClick={handleDelete}
          disabled={isWorking}
          title="Delete note"
          style={{ backgroundImage: `url(${deleteIcon})` }}
        >
          <span className="visually-hidden">Delete note</span>
        </button>
      </div>

      <MessageBubble sender={msg.sender}>
        <div className={`note-content${isEditing ? ' note-content--hidden' : ''}`}>
          <TranslatableContent
            ref={contentRef}
            content={displayText}
            onTextSelect={onTextSelect}
            chatId={chatId}
          />
        </div>

        {isEditing && (
          <div className="note-edit-panel">
            <MessageInput
              onSend={() => {}}
              onAttachImage={() => {}}
              initialValue={displayText}
              onInputChange={(value) => setDraftText(value)}
              hideToolbar
              autoFocus
              placeholder="Edit note..."
            />
            <div className="note-edit-controls">
              <button
                type="button"
                className="note-edit-button note-edit-button--secondary"
                onClick={handleEditCancel}
                disabled={isWorking}
              >
                Cancel
              </button>
              <button
                type="button"
                className="note-edit-button"
                onClick={handleEditSave}
                disabled={isWorking}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Question input section for notes */}
        {isNote && !isEditing && (
          <div className="question-input-section">
            <div className="question-input-row">
              <textarea
                className="question-input"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                onKeyPress={handleQuestionKeyPress}
                placeholder="Ask a question about this note..."
                disabled={isAskingQuestion}
                rows={1}
              />
              <button
                className="question-ask-button"
                onClick={handleAskQuestion}
                disabled={!questionText.trim() || isAskingQuestion}
              >
                {isAskingQuestion ? 'Asking...' : 'Ask'}
              </button>
            </div>
          </div>
        )}

        {/* Render tiles for this note */}
        {isNote && tiles.length > 0 && (
          <div className="tiles-container">
            <h4>Questions & Answers</h4>
            {tiles.map((tile) => (
              <ChatTile
                key={tile.id}
                tile={tile}
                onRetry={onRetryTile}
                chatId={chatId}
              />
            ))}
          </div>
        )}
      </MessageBubble>
    </div>
  );
});

ChatMessage.propTypes = {
  msg: PropTypes.shape({
    sender: PropTypes.oneOf(['user', 'bot']).isRequired,
    content: PropTypes.string.isRequired,
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    is_note: PropTypes.bool,
  }).isRequired,
  onTextSelect: PropTypes.func,
  chatId: PropTypes.string,
  onDelete: PropTypes.func,
  onEdit: PropTypes.func,
  tiles: PropTypes.array,
  onSendQuestion: PropTypes.func,
  onRetryTile: PropTypes.func
};

ChatMessage.displayName = 'ChatMessage';

export default React.memo(ChatMessage);
