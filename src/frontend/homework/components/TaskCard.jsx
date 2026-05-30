import React from 'react';

/**
 * @typedef {{ id: string, title: string, image: string, category: string, categoryColor: string, duration: number, description: string, status: 'idle' | 'active' }} Task
 * @param {{ task: Task, onSelect: (id: string) => void }} props
 */
export default function TaskCard({ task, onSelect }) {
  const isActive = task.status === 'active';

  return (
    <div className={`hw-task-card ${isActive ? 'hw-task-card--active' : ''}`}>
      <div className="hw-card-image-wrap">
        <img src={task.image} alt={task.title} className="hw-card-image" loading="lazy" />
      </div>
      <div className="hw-card-body">
        <div className="hw-card-meta">
          <span className={`hw-card-tag hw-card-tag--${task.categoryColor}`}>{task.category}</span>
          <span className="hw-card-time">
            <span className="hw-material-icon">schedule</span> {task.duration} mins
          </span>
        </div>
        <h4 className="hw-card-title">{task.title}</h4>
        <p className="hw-card-desc">{task.description}</p>
        {isActive ? (
          <div className="hw-current-badge">Current Task</div>
        ) : (
          <button
            className="hw-select-btn"
            onClick={() => onSelect(task.id)}
          >
            Select Task
          </button>
        )}
      </div>
    </div>
  );
}
