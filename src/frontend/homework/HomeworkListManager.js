import { fetchAssignments, deleteNote as deleteNoteAPI } from '../api';
import HomeworkManager from './HomeworkManager';

/**
 * HomeworkListManager — plain domain class: the list of homework notes, the
 * active note, and route-driven selection. Knows nothing about React. Methods
 * are arrow class fields so `this` is bound to the instance — they can be
 * passed straight as React callbacks without detaching the receiver. After
 * any mutation (or a nested HomeworkManager mutation) it pokes `onChange`,
 * which a reactive store wires up to broadcast to subscribers.
 */
class HomeworkListManager {
  noteList = [];
  currentNoteId = null;
  currentNoteName = null;
  homeworkManager = new HomeworkManager();
  navigateCallback = null;
  showPicker = false;
  onChange = null;

  constructor() {
    // Propagate HomeworkManager state changes (e.g. loadNote completing)
    // upward so a single onChange listener covers both levels.
    this.homeworkManager.onChange = () => this.onChange?.();
  }

  setNavigateCallback = (callback) => {
    this.navigateCallback = callback;
  };

  /**
   * Load the list of homework notes.
   */
  loadNotes = async () => {
    try {
      this.noteList = await fetchAssignments();
      this.updateCurrentNoteName();
      this.onChange?.();
    } catch (error) {
      console.error('Error loading homework notes:', error);
    }
  };

  updateCurrentNoteName = () => {
    let found = null;
    if (this.noteList.length > 0 && this.currentNoteId != null) {
      const current = this.noteList.find(
        (note) => String(note.id) === String(this.currentNoteId),
      );
      if (current) found = current.name;
    }
    this.currentNoteName = found;
  };

  /**
   * Sync the current note from the URL path.
   * @param {string} pathname
   */
  setCurrentNoteFromPath = async (pathname) => {
    const match = pathname.match(/\/homework\/(\d+)/);
    const noteIdFromPath = match ? match[1] : null;

    if (noteIdFromPath === this.currentNoteId) return;

    this.currentNoteId = noteIdFromPath;
    this.updateCurrentNoteName();
    this.homeworkManager.reset();

    if (this.currentNoteId) {
      await this.homeworkManager.loadNote(this.currentNoteId);
    }

    this.onChange?.();
  };

  /**
   * Click a note in the picker — navigates and loads it.
   * @param {string|number} noteId
   */
  selectNote = async (noteId) => {
    const id = String(noteId);
    this.currentNoteId = id;
    this.updateCurrentNoteName();

    if (this.navigateCallback) {
      this.navigateCallback(`/homework/${id}`);
    }

    this.homeworkManager.reset();
    await this.homeworkManager.loadNote(id);

    this.onChange?.();
  };

  /**
   * Delete a homework note and remove it from the list.
   * @param {string|number} noteId
   */
  deleteNote = async (noteId) => {
    if (!noteId) return;
    const id = String(noteId);
    try {
      await deleteNoteAPI(id);
      this.noteList = this.noteList.filter((note) => String(note.id) !== id);

      if (this.currentNoteId === id) {
        this.currentNoteId = null;
        this.currentNoteName = null;
        if (this.navigateCallback) {
          this.navigateCallback('/homework');
        }
        this.homeworkManager.reset();
      }

      this.onChange?.();
    } catch (error) {
      console.error('Error deleting homework note:', error);
    }
  };

  /** Toggle between ImportWorkspace and NoteListView on /homework. */
  togglePicker = () => {
    this.showPicker = !this.showPicker;
    this.onChange?.();
  };

  /**
   * Plain snapshot of the current state. Note blocks are flattened up from the
   * owned HomeworkManager so consumers never reach across class boundaries.
   */
  getState = () => ({
    noteList: this.noteList,
    currentNoteId: this.currentNoteId,
    currentNoteName: this.currentNoteName,
    noteBlocks: this.homeworkManager.noteBlocks,
    showPicker: this.showPicker,
  });
}

export default HomeworkListManager;