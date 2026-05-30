import { useState, useCallback } from 'react';
import { TASKS } from '../data/mockData';

export function useHomeworkLab() {
  const [tasks, setTasks] = useState(TASKS);
  const [activeTaskId, setActiveTaskId] = useState('paris');

  const selectTask = useCallback((id) => {
    setActiveTaskId(id);
    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        status: t.id === id ? 'active' : 'idle',
      }))
    );
  }, []);

  const activeTask = tasks.find((t) => t.id === activeTaskId) || tasks[1];

  return {
    tasks,
    activeTaskId,
    activeTask,
    selectTask,
  };
}
