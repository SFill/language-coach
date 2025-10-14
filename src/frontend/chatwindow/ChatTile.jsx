import React, { useState } from 'react';
import PropTypes from 'prop-types';
import MarkdownContent from './components/MarkdownContent';
import './ChatTile.css';

/**
 * ChatTile component - Card-style design that expands to fill container
 * States: loading, ready, error
 * Modes: expanded, collapsed
 */
const ChatTile = ({ tile, onRetry, chatId }) => {
  const { id, title, content, createdAt,state, error } = tile;
  const [expanded, setExpanded] = useState(tile.expanded)

  const handleHeaderClick = () => {
    if (state === 'ready') {
      setExpanded(true)
    }
  };

  const handleHideClick = (e) => {
    e.stopPropagation();
    setExpanded(false)
  };

  const handleRetryClick = (e) => {
    e.stopPropagation();
    if (onRetry) {
      onRetry(id);
    }
  };

  const renderLoadingState = () => (
    <div className="chat-tile__loading">
      <div className="chat-tile__spinner"></div>
      <span>Loading answer...</span>
    </div>
  );

  const renderErrorState = () => (
    <div className="chat-tile__error">
      <div className="chat-tile__error-icon">⚠️</div>
      <div className="chat-tile__error-content">
        <div className="chat-tile__error-message">
          {error?.message || 'Failed to get answer'}
        </div>
        {error?.retriable && (
          <button 
            className="chat-tile__retry-button"
            onClick={handleRetryClick}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );

  const renderReadyState = () => (
    <>
      <div 
        className="chat-tile__header"
        onClick={handleHeaderClick}
      >
        <div className="chat-tile__title">
          Q: {title}
        </div>
        <div className="chat-tile__actions">
          <button 
            className="chat-tile__hide-button"
            onClick={handleHideClick}
            title="Hide"
          >
            Hide
          </button>
          <div className="chat-tile__expand-icon">
            {expanded ? '▲' : '▼'}
          </div>
        </div>
      </div>
      
      <div className="chat-tile__content">
        <div className="chat-tile__question">
          <div className="chat-tile__question-label">Question</div>
          <div className="chat-tile__question-text">{title}</div>
        </div>
        
        <div className="chat-tile__answer">
          <div className="chat-tile__answer-label">Answer</div>
          <div className="chat-tile__answer-content">
            <MarkdownContent content={content} chatId={chatId} />
          </div>
        </div>
        
        <div className="chat-tile__timestamp">
          {new Date(createdAt).toLocaleString()}
        </div>
      </div>
    </>
  );

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return renderLoadingState();
      case 'error':
        return renderErrorState();
      case 'ready':
        return renderReadyState();
      default:
        return null;
    }
  };

  const tileClasses = [
    'chat-tile',
    `chat-tile--${state}`,
    expanded ? 'chat-tile--expanded' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={tileClasses}>
      {renderContent()}
    </div>
  );
};

ChatTile.propTypes = {
  tile: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    state: PropTypes.oneOf(['loading', 'ready', 'error']).isRequired,
    expanded: PropTypes.bool.isRequired,
    createdAt: PropTypes.string.isRequired,
    error: PropTypes.shape({
      code: PropTypes.string,
      message: PropTypes.string,
      retriable: PropTypes.bool
    })
  }).isRequired,
  onRetry: PropTypes.func,
  chatId: PropTypes.string
};

export default ChatTile;