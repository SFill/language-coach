import { fetchNoteById, sendNoteBlock, createNewNote, sendQuestion } from '../api';

/**
 * NoteManager - Single source of truth for note operations
 * Handles note loading, creation, and block management
 */
class NoteManager {
  constructor() {
    this.noteBlocks = [];
    this.maxNoteBlockId = 0;
    this.isLoadingNote = false;
    this.listeners = [];
    this.onNoteCreatedCallback = null;
  }

  /**
   * Set callback for when a new note is created
   * @param {Function} callback - Callback function (newNoteId, message) => void
   */
  setOnNoteCreated(callback) {
    this.onNoteCreatedCallback = callback;
  }

  /**
   * Subscribe to note state changes
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
      noteBlocks: this.noteBlocks,
      maxNoteBlockId: this.maxNoteBlockId,
    };
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Load a note by ID
   * @param {number} noteId - The note ID to load
   * @param {Object} initialMessage - Optional initial message to send after loading
   * @returns {Promise<void>}
   */
  async loadNote(noteId, initialMessage = null) {
    if (this.isLoadingNote) return;

    try {
      this.isLoadingNote = true;
      console.log('Loading note:', noteId);

      const noteData = await fetchNoteById(noteId);
      if (noteData) {
        this.noteBlocks = noteData.note_blocks || [];
        this.maxNoteBlockId = noteData.max_note_block_id ?? 0;
        this.notifyListeners();
      }

      // If there's an initial message, send it after loading
      // Only send if message is provided and not empty
      if (initialMessage && initialMessage.message && initialMessage.message.trim()) {
        await this.sendBlock(noteId, initialMessage.message, initialMessage.isNote);
      }
    } catch (error) {
      console.error('Error loading note:', error);
      throw error;
    } finally {
      this.isLoadingNote = false;
    }
  }

  /**
   * Handle sending a message - creates note if needed, otherwise sends block
   * @param {number|null} noteId - The note ID (null if creating new note)
   * @param {string} message - The message content
   * @param {boolean} isNote - Whether this is a note (true) or question (false)
   * @returns {Promise<void>}
   */
  async handleSend(noteId, message, isNote = false) {
    if (!message.trim()) return;

    // Flow 1: No noteId - create new note
    if (!noteId) {
      try {
        const newNote = await createNewNote();
        // Reset state for new note
        this.noteBlocks = [];
        this.maxNoteBlockId = 0;
        this.notifyListeners();
        
        // Notify parent component to navigate to new note with initial message
        if (this.onNoteCreatedCallback) {
          this.onNoteCreatedCallback(newNote.id, { message, isNote });
        }
        return;
      } catch (error) {
        console.error('Error creating note:', error);
        this.noteBlocks = [{
          sender: 'bot',
          content: 'Error: Could not create or find an active note.'
        }];
        this.notifyListeners();
        return;
      }
    }

    // Flow 2: Have noteId - send block
    await this.sendBlock(noteId, message, isNote);
  }

  /**
   * Send a block to a note
   * @param {number} noteId - The note ID
   * @param {string} message - The message content
   * @param {boolean} isNote - Whether this is a note (true) or question (false)
   * @returns {Promise<void>}
   */
  async sendBlock(noteId, message, isNote = false, parentNoteBlockId = null) {
    if (!message.trim()) return;
    if (!noteId) {
      throw new Error('Note ID is required to send a block');
    }

    // Add user block optimistically ONLY for notes
    if (isNote) {
      const newNoteBlockId = this.maxNoteBlockId + 1;
      this.maxNoteBlockId = newNoteBlockId;
      const userNoteBlock = {
        sender: 'user',
        content: message.trim(),
        id: newNoteBlockId,
        is_note: isNote
      };
      this.noteBlocks = [...this.noteBlocks, userNoteBlock];
      this.notifyListeners();
    }

    try {
      if (isNote) {
        // EXISTING: Note flow - returns [userBlock] (only 1 block)
        // Backend always returns userBlock, but for notes there's no assistant response
        const [userNoteBlock] = await sendNoteBlock(noteId, {
          block: message,
          is_note: isNote
        });
        
        // User block already added optimistically above, no need to add again
      } else {
        // NEW: Question flow - returns SINGLE Q&A block
        // REPLACES the old sendNoteBlock with is_note=false
        const qaBlock = await sendQuestion(noteId, {
          question: message,
          parent_note_block_id: parentNoteBlockId
        });

        if (qaBlock) {
          this.noteBlocks = [...this.noteBlocks, qaBlock];
          this.notifyListeners();
        }
      }
    } catch (error) {
      console.error('Error sending block:', error);
      // Add error message to UI
      this.noteBlocks = [...this.noteBlocks, {
        sender: 'bot',
        content: 'Error sending block'
      }];
      this.notifyListeners();
      throw error;
    }
  }


  /**
   * Reset the manager state
   */
  reset() {
    this.noteBlocks = [];
    this.maxNoteBlockId = 0;
    this.isLoadingNote = false;
    this.notifyListeners();
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return {
      noteBlocks: this.noteBlocks,
      maxNoteBlockId: this.maxNoteBlockId,
    };
  }
}

export default NoteManager;
