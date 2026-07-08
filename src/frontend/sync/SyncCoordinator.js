/**
 * SyncCoordinator — a plain-JS sync executor shared by homework (draft autosave)
 * and wordlist (dirty-list sync). Not a React component; consumers own their own
 * trigger policy and inject two things:
 *
 *   - getPayload(): () => payload | null
 *       Reads the CURRENT dirty state. Returning null means "nothing to sync".
 *       Read fresh at flush time so the persister always sees the latest data.
 *   - persister(payload): async (payload) => result | undefined
 *       Does the actual API writes for one sync and may return a value (e.g. the
 *       saved block id) which `flush()` forwards to its caller.
 *
 * What the coordinator owns:
 *   - an in-flight guard (never runs two persister calls at once),
 *   - a debounced `schedule()` helper (used by homework; wordlist drives its own
 *     interval and just calls `flush()`),
 *   - edit-during-sync safety: if a sync is requested while one is running, it
 *     is re-queued and drained after the current one finishes,
 *   - observable status ('idle' | 'pending' | 'saving') for React via subscribe.
 *
 * The consumer decides WHEN to sync (debounce, interval, on switch, on unload).
 * The coordinator decides HOW (guard, drain, status).
 */
export class SyncCoordinator {
  constructor({ getPayload, persister, delay = 0 }) {
    if (typeof getPayload !== 'function' || typeof persister !== 'function') {
      throw new Error('SyncCoordinator requires getPayload and persister');
    }
    this.getPayload = getPayload;
    this.persister = persister;
    this.delay = delay;

    this.timer = null;
    this.inFlight = false;
    this._pending = false;      // a sync was requested while one was already running
    this.status = 'idle';
    this._listeners = new Set();
  }

  // --- Observer glue (React reads status via useSyncExternalStore) ---
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  getSnapshot() {
    return this.status;
  }

  _setStatus(s) {
    if (this.status === s) return;
    this.status = s;
    this._listeners.forEach((fn) => fn(s));
  }

  // --- Triggers ---

  /**
   * Debounced: (re)arm a timer to flush after `delay`. Call this after an edit.
   * Rapid edits coalesce into one sync. If a sync is already running, the edit
   * is remembered via _pending and drained after the current sync — we do NOT
   * arm a second timer (the running sync's drain re-arms).
   */
  schedule() {
    this._setStatus('pending');
    if (this.inFlight) {
      // Edit arrived mid-sync — re-queue once the current sync finishes.
      this._pending = true;
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
  }

  /**
   * Immediate: run the persister now with the current payload. Returns the
   * persister's result (or null if nothing was dirty / a sync was already
   * running). Use on context switch, navigate-away, AI-Check, interval tick.
   */
  async flush() {
    if (this.inFlight) {
      // A sync is running — don't start a second; drain will pick up the latest
      // payload after it finishes.
      this._pending = true;
      return null;
    }
    return this._drain();
  }

  /**
   * Cancel a pending debounced sync (e.g. when an external action takes over).
   * Does not interrupt a sync already in flight.
   */
  cancel() {
    clearTimeout(this.timer);
    this.timer = null;
    this._pending = false;
    if (!this.inFlight) this._setStatus('idle');
  }

  async _drain() {
    clearTimeout(this.timer);
    this.timer = null;

    const payload = this.getPayload();
    if (!payload) {
      this._pending = false;
      this._setStatus('idle');
      return null;
    }

    this.inFlight = true;
    this._setStatus('saving');
    try {
      const result = await this.persister(payload);
      return result;
    } catch (err) {
      console.error('Sync failed:', err);
      this._pending = true; // stay dirty — next schedule/flush retries
      return null;
    } finally {
      this.inFlight = false;
      if (this._pending) {
        // Edits arrived during the sync — re-queue. Consumers with delay>0
        // (homework) re-arm the debounce; interval-driven consumers (wordlist)
        // just mark pending and let the next tick flush.
        this._pending = false;
        this._setStatus('pending');
        if (this.delay > 0) {
          clearTimeout(this.timer);
          this.timer = setTimeout(() => this.flush(), this.delay);
        }
      } else {
        this._setStatus('idle');
      }
    }
  }

  dispose() {
    clearTimeout(this.timer);
    this.timer = null;
    this._listeners.clear();
  }
}

export default SyncCoordinator;