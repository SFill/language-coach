import { fetchAssignments, deleteNote as deleteNoteAPI } from '../api';
import HomeworkManager from './HomeworkManager';

/**
 * HomeworkListManager - Manages the list of homework notes and the active note.
 * Mirrors NoteListManager: owns a HomeworkManager instance, exposes subscribe/notify,
 * handles route-driven note selection and deletion.
 */
class HomeworkListManager {
  constructor() {
    this.noteList = [];
    this.currentNoteId = null;
    this.currentNoteName = null;
    this.homeworkManager = new HomeworkManager();
    this.listeners = [];
    this.navigateCallback = null;
  }

  setNavigateCallback(callback) {
    this.navigateCallback = callback;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  /**
   * Load the list of homework notes.
   */
  async loadNotes() {
    try {
      this.noteList = await fetchAssignments();
      this.updateCurrentNoteName();
      this.notifyListeners();
    } catch (error) {
      console.error('Error loading homework notes:', error);
    }
  }

  updateCurrentNoteName() {
    let found = null;
    if (this.noteList.length > 0 && this.currentNoteId != null) {
      const current = this.noteList.find(
        (note) => String(note.id) === String(this.currentNoteId),
      );
      if (current) found = current.name;
    }
    this.currentNoteName = found;
  }

  /**
   * Sync the current note from the URL path.
   * @param {string} pathname
   */
  async setCurrentNoteFromPath(pathname) {
    const match = pathname.match(/\/homework\/(\d+)/);
    const noteIdFromPath = match ? match[1] : null;

    if (noteIdFromPath === this.currentNoteId) return;

    this.currentNoteId = noteIdFromPath;
    this.updateCurrentNoteName();
    this.homeworkManager.reset();

    if (this.currentNoteId) {
      await this.homeworkManager.loadNote(this.currentNoteId);
    }

    this.notifyListeners();
  }

  /**
   * Click a note in the picker — navigates and loads it.
   * @param {string|number} noteId
   */
  async selectNote(noteId) {
    const id = String(noteId);
    this.currentNoteId = id;
    this.updateCurrentNoteName();

    if (this.navigateCallback) {
      this.navigateCallback(`/homework/${id}`);
    }

    this.homeworkManager.reset();
    await this.homeworkManager.loadNote(id);

    this.notifyListeners();
  }

  /**
   * Delete a homework note and remove it from the list.
   * @param {string|number} noteId
   */
  async deleteNote(noteId) {
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

      this.notifyListeners();
    } catch (error) {
      console.error('Error deleting homework note:', error);
    }
  }

  getHomeworkManager() {
    return this.homeworkManager;
  }

  getState() {
    return {
      noteList: this.noteList,
      currentNoteId: this.currentNoteId,
      currentNoteName: this.currentNoteName,
      homeworkManager: this.homeworkManager,
    };
  }
}

export default HomeworkListManager;
