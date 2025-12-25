import React from 'react';
import PropTypes from 'prop-types';
import './NoteTile.css';

/**
 * NoteTile component - Card-style design for questions
 * States: loading, ready
 */
const NoteTile = ({ tile, onClick, isSelected = false }) => {
  const { id, title, createdAt, state } = tile;

  const handleTileClick = (e) => {
    // Don't trigger if clicking on interactive elements
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    if (onClick) {
      onClick(id);
    }
  };

  const renderLoadingState = () => (
    <>
      <div className="note-tile__spinner"></div>
      <span>Loading answer...</span>
    </>
  );

  const renderReadyState = () => (
    <>
      <header className="note-tile__header">
        <time className="note-tile__time">{createdAt}</time>
      </header>

      <h3
        onClick={handleTileClick}
        className="note-tile__title">{title}</h3>
    </>
  );

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return renderLoadingState();
      case 'ready':
        return renderReadyState();
      default:
        return null;
    }
  };

  function classNames(...xs) {
    return xs.filter(Boolean).join(" ");
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-controls={'tile ' + id}
      onClick={handleTileClick}
      className={classNames(
        "note-tile__article",
        isSelected ? "note-tile__article--selected" : "",
        "note-tile--tone-blue"
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
    state: PropTypes.oneOf(['loading', 'ready']).isRequired,
    createdAt: PropTypes.string.isRequired,
  }).isRequired,
  onClick: PropTypes.func,
  isSelected: PropTypes.bool
};

export default NoteTile;

