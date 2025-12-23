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
      setExpanded(!expanded)
    }
  };

  const renderLoadingState = () => (
  <>
    <div className="chat-tile__spinner"></div>
    <span>Loading answer...</span>
  </>
  
  );

  const renderErrorState = () => (
      <span>Error</span>
  )

  const toneBg = {
    blue: "chat-tile--tone-blue",
    green: "chat-tile--tone-green",
    rose: "chat-tile--tone-rose",
    amber: "chat-tile--tone-amber",
    slate: "chat-tile--tone-slate",
  };

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}


  const renderReadyState = () => (
    <>
      <header className="chat-tile__header">
        <time className="chat-tile__time">{createdAt}</time>
      </header>

      <h3
      onClick={handleHeaderClick}
      className="chat-tile__title">{title}</h3>


      <div
        id={'tile ' + id}
        aria-hidden={!expanded}
        className={classNames(
          "chat-tile__content",
          expanded ? "chat-tile__content--expanded" : "chat-tile__content--collapsed"
        )}
      >
        <div className="chat-tile__content-inner">
          <h4 className="chat-tile__answer-label">Answer</h4>
          <p className="chat-tile__answer-text">
            <MarkdownContent content={content} chatId={chatId} />

          </p>
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


  return (
    <article 
      // ref={refFn}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-controls={'tile ' + id}
      className={classNames(
        "chat-tile__article",
        expanded ? "chat-tile__article--expanded" : "chat-tile__article--collapsed",
        toneBg['blue']
      )}
    >
      {renderContent()}
    </article>
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

