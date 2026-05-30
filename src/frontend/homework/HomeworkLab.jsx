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
          {/* Left Pane: Task Feed */}
          <section className="hw-task-pane">
            <div className="hw-task-pane-header">
              <h3 className="hw-pane-title">Visual Writing Prompts</h3>
              <p className="hw-pane-subtitle">
                Select a scene and describe it in detail to practice descriptive vocabulary.
              </p>
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

          {/* Right Pane: Drafting Area */}
          <DraftingArea />
        </main>
      </div>
    </div>
  );
}
