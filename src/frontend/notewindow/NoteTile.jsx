import React, { useState } from 'react';
import PropTypes from 'prop-types';
import MarkdownContent from './components/MarkdownContent';
import './NoteTile.css';

/**
 * NoteTile component - Card-style design that expands to fill container
 * States: loading, ready, error
 * Modes: expanded, collapsed
 */
const NoteTile = ({ tile, onRetry, noteId }) => {
  const { id, title, content, createdAt,state, error } = tile;
  const [expanded, setExpanded] = useState(tile.expanded)

  const handleHeaderClick = () => {
    if (state === 'ready') {
      setExpanded(!expanded)
    }
  };

  const renderLoadingState = () => (
  <>
    <div className="note-tile__spinner"></div>
    <span>Loading answer...</span>
  </>
  
  );

  const renderErrorState = () => (
      <span>Error</span>
  )

  const toneBg = {
    blue: "note-tile--tone-blue",
    green: "note-tile--tone-green",
    rose: "note-tile--tone-rose",
    amber: "note-tile--tone-amber",
    slate: "note-tile--tone-slate",
  };

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}


  const renderReadyState = () => (
    <>
      <header className="note-tile__header">
        <time className="note-tile__time">{createdAt}</time>
      </header>

      <h3
      onClick={handleHeaderClick}
      className="note-tile__title">{title}</h3>


      <div
        id={'tile ' + id}
        aria-hidden={!expanded}
        className={classNames(
          "note-tile__content",
          expanded ? "note-tile__content--expanded" : "note-tile__content--collapsed"
        )}
      >
        <div className="note-tile__content-inner">
          <h4 className="note-tile__answer-label">Answer</h4>
          <p className="note-tile__answer-text">
            <MarkdownContent content={content} noteId={noteId} />

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
        "note-tile__article",
        expanded ? "note-tile__article--expanded" : "note-tile__article--collapsed",
        toneBg['blue']
      )}
    >
      {renderContent()}
    </article>
  );
};

NoteTile.propTypes = {
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
  noteId: PropTypes.string
};

export default NoteTile;

