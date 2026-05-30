import React from 'react';
import './HomeworkLab.css';
import { useHomeworkLab } from './hooks/useHomeworkLab';
import SideNavBar from './components/SideNavBar';
import TopNavBar from './components/TopNavBar';
import TaskCard from './components/TaskCard';
import DraftingArea from './components/DraftingArea';

export default function HomeworkLab() {
  const { tasks, activeTaskId, activeTask, selectTask } = useHomeworkLab();

  return (
    <div className="hw-page">
      <SideNavBar />

      <div className="hw-content-wrapper">
        <TopNavBar />

        <main className="hw-split-layout">
          {/* Left Pane: Visual Writing Prompts */}
          <section className="hw-task-pane">
            <div className="hw-task-pane-header">
              <h2 className="hw-pane-title">Visual Prompts</h2>
              <button className="hw-gallery-btn">
                <span className="hw-material-icon">view_cozy</span>
                Gallery
              </button>
            </div>
            <div className="hw-task-feed">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSelect={selectTask}
                />
              ))}
            </div>
          </section>

          {/* Drag Handle Divider */}
          <div className="hw-drag-handle">
            <div className="hw-drag-handle-dot" />
          </div>

          {/* Right Pane: Drafting Area */}
          <DraftingArea />
        </main>
      </div>
    </div>
  );
}