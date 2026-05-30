import React from 'react';

export default function TaskCard({ task, onSelect }) {
  const isActive = task.status === 'active';

  return (
    <div className={`hw-task-card ${isActive ? 'hw-task-card--active' : ''}`}>
      <div className="hw-card-image-wrap">
        <img src={task.image} alt={task.title} className="hw-card-image" loading="lazy" />
        {isActive && (
          <div className="hw-card-current-badge">
            <span className="hw-card-current-dot" />
            Current Task
          </div>
        )}
      </div>
      <div className="hw-card-body">
        <h3 className="hw-card-title">{task.title}</h3>
        <p className="hw-card-desc">{task.description}</p>
        <div className="hw-card-footer">
          <span className="hw-card-meta-label">Target Length: {task.targetLength}</span>
          <span className="hw-card-meta-label">Difficulty: {task.difficulty}</span>
        </div>
      </div>
      {!isActive && (
        <button
          className="hw-select-btn"
          onClick={() => onSelect(task.id)}
        >
          Select Task
        </button>
      )}
    </div>
  );
}