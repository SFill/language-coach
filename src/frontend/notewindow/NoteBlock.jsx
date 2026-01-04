import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import MessageBubble from './components/MessageBubble';
import TranslatableContent from './components/TranslatableContent';
import MessageInput from '../MessageInput';
import NoteTile from './NoteTile';
import './NoteBlock.css';
import './NoteTile.css';
import deleteIcon from '../assets/delete-message.png';
import editIcon from '../assets/edit-mesage.png';
import { deleteNoteBlock, updateNoteBlock } from '../api';

const FOLD_THRESHOLD = 300; // Character threshold to consider a note block long

/**
 * Complete note block component
 */
const NoteBlock = React.forwardRef(({
  block,
  onTextSelect,
  noteId,
  onDelete,
  onEdit,
  tiles = [],
  onSendQuestion,
  onRetryTile,
  isHighlighted = false,
  noteBlockId: dataBlockId
}, ref) => {
  const isBot = block.sender === 'bot';
  const isNote = block.is_note || false;
  const noteBlockId = block.id;
  const contentRef = useRef(null);
  const containerRef = useRef(null);
  const [displayText, setDisplayText] = useState(block.content);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(block.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const canManageNote = true;
  
  // State for tracking which content is displayed: null = main note, tileId = selected tile
  const [activeContentId, setActiveContentId] = useState(null);
  
  // State for tracking deleted tiles (to hide them immediately)
  const [deletedTileIds, setDeletedTileIds] = useState(new Set());
  
  // Filter out deleted tiles
  const visibleTiles = useMemo(() => {
    return tiles.filter(t => !deletedTileIds.has(t.id));
  }, [tiles, deletedTileIds]);
  
  // Get the currently displayed content based on activeContentId
  const currentContent = useMemo(() => {
    if (activeContentId === null) {
      return { id: noteBlockId, content: displayText, type: 'note' };
    }
    const selectedTile = visibleTiles.find(t => t.id === activeContentId);
    if (selectedTile) {
      return { id: selectedTile.id, content: selectedTile.content, type: 'tile' };
    }
    // Fallback to main note if tile not found
    return { id: noteBlockId, content: displayText, type: 'note' };
  }, [activeContentId, displayText, visibleTiles, noteBlockId]);

  useEffect(() => {
    setDisplayText(block.content);
    setDraftText(block.content);
  }, [block.content]);

  useImperativeHandle(ref, () => ({
    get currentRange() {
      return contentRef.current?.currentRange;
    },
    handleTranslate: (...args) => contentRef.current?.handleTranslate?.(...args),
    handleRollback: (...args) => contentRef.current?.handleRollback?.(...args),
    handleGlobalSelection: (...args) => contentRef.current?.handleGlobalSelection?.(...args),
    checkSelectionWithinContainer: (...args) => contentRef.current?.checkSelectionWithinContainer?.(...args),
    // Expose container element for scrolling
    get containerElement() {
      return containerRef.current;
    }
  }));

  // Handle tile click - toggle between tile and main note
  const handleTileClick = (tileId) => {
    if (activeContentId === tileId) {
      // Clicking active tile returns to main note
      setActiveContentId(null);
    } else {
      // Switch to selected tile
      setActiveContentId(tileId);
    }
  };

  const handleEditToggle = () => {
    if (isDeleting || isEditing) return;
    setDraftText(currentContent.content);
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setDraftText(currentContent.content);
  };

  const handleEditSave = async () => {
    const trimmed = draftText.trim();
    if (!trimmed || trimmed === currentContent.content || isWorking) {
      setIsEditing(false);
      setDraftText(currentContent.content);
      return;
    }

    try {
      setIsWorking(true);
      
      if (currentContent.type === 'note') {
        // Update main note block
        await updateNoteBlock(noteId, noteBlockId, trimmed);
        setDisplayText(trimmed);
        setDraftText(trimmed);
        if (onEdit) onEdit(trimmed);
      } else {
        // Update tile content
        await updateNoteBlock(noteId, currentContent.id, trimmed);
        // Update the tile in the tiles array
        const updatedTiles = tiles.map(t =>
          t.id === currentContent.id ? { ...t, content: trimmed } : t
        );
        // Note: We need to notify parent to update tiles, but for now just update draft
        setDraftText(trimmed);
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update note block', error);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting || isWorking) return;

    try {
      setIsWorking(true);
      
      if (currentContent.type === 'tile') {
        // Delete the selected tile
        await deleteNoteBlock(noteId, currentContent.id);
        // Mark tile as deleted to hide it immediately
        setDeletedTileIds(prev => new Set([...prev, currentContent.id]));
        // Return to main note content after deleting tile
        setActiveContentId(null);
      } else {
        // Delete the main note block
        await deleteNoteBlock(noteId, noteBlockId);
        setIsDeleting(true);
        setTimeout(() => {
          setIsRemoved(true);
          if (onDelete) onDelete(noteBlockId);
        }, 220);
      }
    } catch (error) {
      console.error('Failed to delete note block', error);
      setIsDeleting(false);
    } finally {
      setIsWorking(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!questionText.trim() || isAskingQuestion || !onSendQuestion) return;

    try {
      setIsAskingQuestion(true);
      await onSendQuestion(questionText.trim(), noteBlockId);
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
    <div
      ref={containerRef}
      data-note-block-id={dataBlockId}
      className={`note-container${isDeleting ? ' note-container--deleting' : ''}${isHighlighted ? ' note-container--highlighted' : ''}`}
    >
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

      <MessageBubble sender={block.sender}>

          {/* Render tiles for this note */}
          {visibleTiles.length > 0 && (
            <section
              className="note-tiles-section"
              aria-label="Questions"
            >
              {visibleTiles.map((tile, idx) => (
                <NoteTile
                  key={tile.id}
                  tile={tile}
                  onRetry={onRetryTile}
                  noteId={noteId}
                  onClick={() => handleTileClick(tile.id)}
                  isSelected={activeContentId === tile.id}
                />
              ))}
            </section>
          )}

        <div className={`note-content${isEditing ? ' note-content--hidden' : ''}`}>
          <TranslatableContent
            ref={contentRef}
            content={currentContent.content}
            onTextSelect={onTextSelect}
            noteId={noteId}
          />
        </div>

        {isEditing && (
          <div className="note-edit-panel">
            <MessageInput
              onSend={() => {}}
              onAttachImage={() => {}}
              initialValue={currentContent.content}
              onInputChange={(value) => setDraftText(value)}
              hideToolbar
              autoFocus
              placeholder={currentContent.type === 'note' ? "Edit note..." : "Edit question..."}
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

NoteBlock.propTypes = {
  block: PropTypes.shape({
    content: PropTypes.string.isRequired,
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    is_note: PropTypes.bool,
  }).isRequired,
  onTextSelect: PropTypes.func,
  noteId: PropTypes.string,
  onDelete: PropTypes.func,
  onEdit: PropTypes.func,
  tiles: PropTypes.array,
  onSendQuestion: PropTypes.func,
  onRetryTile: PropTypes.func,
  isHighlighted: PropTypes.bool,
  noteBlockId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};

NoteBlock.displayName = 'NoteBlock';

export default React.memo(NoteBlock);
