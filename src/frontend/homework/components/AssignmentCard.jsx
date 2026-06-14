import React from 'react';

export default function AssignmentCard({ assignment, isActive, isExpanded, onExpand, onSelect }) {
  return (
    <div className={`hw-task-card ${isActive ? 'hw-task-card--active' : ''}`}>
      <div className="hw-card-image-wrap">
        {assignment.image ? (
          <img src={assignment.image} alt="" className="hw-card-image" loading="lazy" />
        ) : (
          <div className="hw-card-image-placeholder">
            <span className="hw-material-icon" style={{ fontSize: 48, color: 'var(--hw-outline-variant)' }}>
              image
            </span>
          </div>
        )}
        {assignment.image && (
          <button
            className="hw-card-expand-btn"
            onClick={(e) => { e.stopPropagation(); onExpand?.(); }}
            title="Expand image"
          >
            🔍
          </button>
        )}
        {isActive && (
          <div className="hw-card-current-badge">
            <span className="hw-card-current-dot" />
            Current Assignment
          </div>
        )}
      </div>
      <div className="hw-card-body">
        {assignment.category && (
          <span className="hw-card-category">{assignment.category}</span>
        )}
        <p className="hw-card-desc">{assignment.description}</p>
        <div className="hw-card-footer">
          {assignment.targetLength && (
            <span className="hw-card-meta-label">Target Length: {assignment.targetLength}</span>
          )}
          {assignment.difficulty && (
            <span className="hw-card-meta-label">Difficulty: {assignment.difficulty}</span>
          )}
        </div>
      </div>
      {!isActive && (
        <button
          className="hw-select-btn"
          onClick={() => onSelect(assignment.id)}
        >
          Select
        </button>
      )}
    </div>
  );
}