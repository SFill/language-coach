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
      if (initialMessage) {
        await this.handleSend(noteId, initialMessage.message, initialMessage.isNote);
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
  async sendBlock(noteId, message, isNote = false) {
    if (!message.trim()) return;
    if (!noteId) {
      throw new Error('Note ID is required to send a block');
    }

    // Add user note block to UI immediately with optimistic ID
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

    try {
      const [userNoteBlock, botReply] = await sendNoteBlock(noteId, {
        block: message,
        is_note: isNote
      });

      if (botReply) {
        this.noteBlocks = [...this.noteBlocks, botReply];
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error sending note block:', error);
      // Add error message to UI
      this.noteBlocks = [...this.noteBlocks, {
        sender: 'bot',
        content: 'Error sending note block'
      }];
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Handle sending a question about a note
   * @param {number} noteId - The note ID
   * @param {string} questionText - The question text
   * @returns {Promise<void>}
   */
  async handleSendQuestion(noteId, questionText) {
    if (!questionText.trim() || !noteId) return;

    try {
      // Add user question to UI immediately
      const newNoteBlockId = this.maxNoteBlockId + 1;
      this.maxNoteBlockId = newNoteBlockId + 1; // Reserve ID for bot response too
      const userQuestion = {
        sender: 'user',
        content: questionText.trim(),
        id: newNoteBlockId,
        is_note: false,
        created_at: new Date().toISOString()
      };
      this.noteBlocks = [...this.noteBlocks, userQuestion];
      this.notifyListeners();

      // Send question and get response
      const [userNoteBlock, botReply] = await sendQuestion(noteId, questionText);

      // Update the user note block with server response and add bot reply
      if (botReply) {
        this.noteBlocks = this.noteBlocks.map(block =>
          block.id === newNoteBlockId ? { ...userNoteBlock, id: newNoteBlockId } : block
        );
        this.noteBlocks = [...this.noteBlocks, { ...botReply, id: newNoteBlockId + 1 }];
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error sending question:', error);
      // Add error note block
      this.noteBlocks = [...this.noteBlocks, {
        sender: 'bot',
        content: 'Error sending question. Please try again.',
        id: this.maxNoteBlockId + 2,
        created_at: new Date().toISOString()
      }];
      this.maxNoteBlockId = this.maxNoteBlockId + 2;
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
