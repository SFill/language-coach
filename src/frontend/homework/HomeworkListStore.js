import HomeworkListManager from './HomeworkListManager';

/**
 * HomeworkListStore — the only React-facing piece. Owns a plain
 * HomeworkListManager, caches one stable snapshot, and exposes the
 * `useSyncExternalStore` contract (subscribe / getSnapshot). The manager pokes
 * `onChange` after every mutation; the store rebuilds and caches the snapshot
 * there so React sees a stable reference.
 *
 * Actions are not re-exposed here — consumers call them on `store.mgr`
 * (list-level) or `store.mgr.homeworkManager` (per-note). Those are stable
 * prototype methods, so handing them straight to React preserves referential
 * stability without a delegation layer.
 */
class HomeworkListStore {
  constructor() {
    this.mgr = new HomeworkListManager();
    this.listeners = new Set();
    this.snapshot = this.mgr.getState();
    this.mgr.onChange = () => this.#commit();
  }

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  #commit = () => {
    this.snapshot = this.mgr.getState();
    this.listeners.forEach((listener) => listener());
  };
}

export default HomeworkListStore;