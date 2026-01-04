import { fetchNotes, deleteNote as deleteNoteAPI } from '../api';
import NoteManager from './NoteManager';

/**
 * NoteListManager - Manages the list of notes and provides NoteManager instances
 * Handles note list operations, selection, and provides current note context
 */
class NoteListManager {
  constructor() {
    this.noteList = [];
    this.currentNoteId = null;
    this.currentNoteName = null;
    this.noteManager = new NoteManager(); // Always have a NoteManager instance
    this.listeners = [];
    this.navigateCallback = null;
    
    // Set up callback for note creation
    this.noteManager.setOnNoteCreated((newNoteId, message) => {
      this.handleNoteCreated(newNoteId, message);
    });
  }

  /**
   * Set navigation callback
   * @param {Function} callback - Navigation function from React Router
   */
  setNavigateCallback(callback) {
    this.navigateCallback = callback;
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function that receives updated state
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  notifyListeners() {
    const state = {
      noteList: this.noteList,
      currentNoteId: this.currentNoteId,
      currentNoteName: this.currentNoteName,
      noteManager: this.noteManager
    };
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Load the list of notes
   * @returns {Promise<void>}
   */
  async loadNotes() {
    try {
      const notes = await fetchNotes();
      this.noteList = notes;
      this.updateCurrentNoteName();
      this.notifyListeners();
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  }

  /**
   * Update current note name based on current note ID
   */
  updateCurrentNoteName() {
    let foundNoteName = null;
    if (this.noteList.length > 0 && this.currentNoteId) {
      const currentNote = this.noteList.find(note => note.id === this.currentNoteId);
      if (currentNote) {
        foundNoteName = currentNote.name;
      }
    }
    this.currentNoteName = foundNoteName;
  }

  /**
   * Set current note ID from URL path and load the note
   *
   * FLOW SEQUENCE:
   * 1. Called from App.jsx useEffect when pathname or location.state changes
   * 2. Extracts noteId from URL path (e.g., /note/63 → 63)
   * 3. If noteId changed:
   *    a. Updates currentNoteId
   *    b. Updates currentNoteName from noteList
   *    c. Resets NoteManager state (clears noteBlocks, maxNoteBlockId)
   *    d. If noteId exists:
   *       - Extracts initialMessage from locationState (for new note flow)
   *       - Calls noteManager.loadNote(noteId, initialMessage)
   *         * Fetches note data from backend via fetchNoteById
   *         * Sets noteBlocks and maxNoteBlockId from response
   *         * If initialMessage exists, calls handleSend to send it
   *    e. Notifies all listeners with updated state
   *
   * @param {string} pathname - Current URL pathname
   * @param {Object} locationState - Location state from React Router (for initialMessage)
   */
  async setCurrentNoteFromPath(pathname, locationState = null) {
    if (pathname.match(/\/note\/(\d+)/) || pathname === '/') {
      const match = pathname.match(/\/note\/(\d+)/);
      const noteIdFromPath = match ? parseInt(match[1]) : null;
      console.log(`setCurrentNoteFromPath:`)
      console.log([this.noteManager,noteIdFromPath,this.currentNoteId])
      if (noteIdFromPath !== this.currentNoteId) {
        this.currentNoteId = noteIdFromPath;
        this.updateCurrentNoteName();
        
        // Reset NoteManager state when switching notes or going to home
        this.noteManager.reset();
        console.log(`setCurrentNoteFromPath: ${this.noteManager},`)
        // Load the note if we have a noteId
        if (this.currentNoteId) {
          const initialMessage = locationState?.initialMessage;
          await this.noteManager.loadNote(this.currentNoteId, initialMessage);
          console.log(`setCurrentNoteFromPath: ${this.noteManager}, ${initialMessage}`)
        }
        
        this.notifyListeners();
      }
    }
  }

  /**
   * Handle note selection
   *
   * FLOW SEQUENCE (EXISTING NOTE FLOW):
   * 1. Called when user clicks a note in the note list
   * 2. Updates currentNoteId and currentNoteName
   * 3. Navigates to /note/{noteId}
   * 4. Resets NoteManager state (clears noteBlocks)
   * 5. Loads note via noteManager.loadNote(noteId)
   *    - Fetches note data from backend
   *    - Sets noteBlocks and maxNoteBlockId
   * 6. Notifies listeners with updated state
   *
   * @param {number} noteId - The note ID to select
   */
  async selectNote(noteId) {
    this.currentNoteId = noteId;
    this.updateCurrentNoteName();
    
    // Navigate to the note
    if (this.navigateCallback) {
      this.navigateCallback(`/note/${noteId}`);
    }
    // Reset NoteManager state when switching notes or going to home
    this.noteManager.reset();
    // Load the note
    await this.noteManager.loadNote(this.currentNoteId);
    
    this.notifyListeners();
  }

  /**
   * Handle note deletion
   * @param {number} noteId - The note ID to delete
   */
  async deleteNote(noteId) {
    if (!noteId) return;
    
    try {
      await deleteNoteAPI(noteId);
      this.noteList = this.noteList.filter(note => note.id !== noteId);
      
      if (this.currentNoteId === noteId) {
        this.currentNoteId = null;
        this.currentNoteName = null;
        // Navigate to note list if we deleted the current note
        if (this.navigateCallback) {
          this.navigateCallback('/notelist');
        }
        this.noteManager.reset();
      }
      
      this.notifyListeners();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  }

  /**
   * Handle note creation
   *
   * FLOW SEQUENCE (NEW NOTE FLOW):
   * 1. User sends message from home page (noteId is null)
   * 2. NoteManager.handleSend() called with null noteId
   * 3. NoteManager creates new note via createNewNote() API
   * 4. NoteManager resets its state and calls this callback with newNoteId and initialMessage
   * 5. This method:
   *    a. Reloads note list via loadNotes() to include new note
   *    b. Navigates to /note/{newNoteId} with initialMessage in state
   * 6. Navigation triggers setCurrentNoteFromPath (see above):
   *    a. Updates currentNoteId to newNoteId
   *    b. Resets NoteManager state
   *    c. Calls noteManager.loadNote(newNoteId, initialMessage)
   * 7. loadNote():
   *    a. Fetches note data from backend (empty note_blocks)
   *    b. Sets noteBlocks and maxNoteBlockId
   *    c. Calls handleSend(newNoteId, message, isNote) with the initialMessage
   * 8. handleSend() now has noteId, so calls sendBlock():
   *    a. Adds user message to UI optimistically
   *    b. Sends to backend via sendNoteBlock()
   *    c. Adds bot reply to UI
   *
   * @param {number} newNoteId - The newly created note ID
   * @param {Object} message - The initial message to send {message: string, isNote: boolean}
   */
  handleNoteCreated(newNoteId, message) {
    // Reload the note list to include the new note
    this.loadNotes();
    
    
    // Navigate to the new note with initial message
    // it will reload note with new ID, and do the rest init
    if (this.navigateCallback) {
      this.navigateCallback(`/note/${newNoteId}`, {
        state: { initialMessage: message },
        replace: true
      });
    }
    
  }

  /**
   * Handle note name click in header
   * @param {string} currentPath - Current URL pathname
   */
  handleNoteNameClick(currentPath) {
    // Check if we're already on a note page
    if (currentPath === '/' || currentPath.startsWith('/note/')) {
      // If on home or note page, go to note list
      if (this.navigateCallback) {
        this.navigateCallback('/notelist');
      }
    } else {
      // If we have a current note ID, go to that note
      if (this.currentNoteId) {
        if (this.navigateCallback) {
          this.navigateCallback(`/note/${this.currentNoteId}`);
        }
      } else {
        // Otherwise go to home page
        if (this.navigateCallback) {
          this.navigateCallback('/');
        }
      }
    }
  }

  /**
   * Get the current NoteManager instance
   * @returns {NoteManager|null}
   */
  getNoteManager() {
    return this.noteManager;
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return {
      noteList: this.noteList,
      currentNoteId: this.currentNoteId,
      currentNoteName: this.currentNoteName,
      noteManager: this.noteManager
    };
  }
}

export default NoteListManager;
