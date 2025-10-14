import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import MessageBubble from './components/MessageBubble';
import ExpandableContent from './components/ExpandableContent';
import TranslatableContent from './components/TranslatableContent';
import MessageInput from '../MessageInput';
import './ChatMessage.css';
import deleteIcon from '../assets/delete-message.png';
import editIcon from '../assets/edit-mesage.png';
import { deleteMessage, updateMessage } from '../api';

const FOLD_THRESHOLD = 300; // Character threshold to consider a message long

/**
 * Complete chat message component
 */
const ChatMessage = React.forwardRef(({ msg, onTextSelect, chatId, onDelete, onEdit }, ref) => {
  const isBot = msg.sender === 'bot';
  const isLong = msg.content.length > FOLD_THRESHOLD;
  const messageId = msg.id;
  const contentRef = useRef(null);
  const [displayText, setDisplayText] = useState(msg.content);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(msg.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
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

  if (isRemoved) return null;

  return (
    <div className={`note-container${isDeleting ? ' note-container--deleting' : ''}`}>
      (
        <div className="note-actions" aria-hidden={isEditing}>
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
      )

      <MessageBubble sender={msg.sender}>
        <div className={`note-content${isEditing ? ' note-content--hidden' : ''}`}>
          {isBot ? (
            <ExpandableContent isLong={isLong}>
              <TranslatableContent 
                ref={contentRef}
                content={displayText}
                onTextSelect={onTextSelect}
                chatId={chatId}
              />
            </ExpandableContent>
          ) : (
            <TranslatableContent 
              ref={contentRef}
              content={displayText}
              onTextSelect={onTextSelect}
              chatId={chatId}
            />
          )}
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
      </MessageBubble>
    </div>
  );
});

ChatMessage.propTypes = {
  msg: PropTypes.shape({
    sender: PropTypes.oneOf(['user', 'bot']).isRequired,
    content: PropTypes.string.isRequired,
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  onTextSelect: PropTypes.func,
  chatId: PropTypes.string,
  onDelete: PropTypes.func,
  onEdit: PropTypes.func
};

ChatMessage.displayName = 'ChatMessage';

export default React.memo(ChatMessage);
