import {
  fetchNoteById,
  updateNoteBlock,
  analyzeDraft,
  sendQuestion as apiSendQuestion,
  sendNoteBlock,
  uploadNoteImage,
} from '../api';

/**
 * HomeworkManager - Single source of truth for homework note operations.
 * Mirrors NoteManager's subscribe/notify pattern, extended with homework-specific
 * methods (submitDraft, runAICheck, sendQuestion with assignment_ref).
 */
class HomeworkManager {
  constructor() {
    this.noteBlocks = [];
    this.maxNoteBlockId = 0;
    this.isLoadingNote = false;
    this.listeners = [];
    this.revision = 0;
  }

  /**
   * Subscribe to state changes.
   * @param {Function} listener
   * @returns {Function} unsubscribe
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notifyListeners() {
    this.revision++;
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  /**
   * Load a note by id and broadcast its blocks.
   * @param {string|number} noteId
   */
  async loadNote(noteId) {
    if (this.isLoadingNote) return;
    try {
      this.isLoadingNote = true;
      const noteData = await fetchNoteById(noteId);
      if (noteData) {
        this.noteBlocks = noteData.note_blocks || [];
        this.maxNoteBlockId = this.noteBlocks.length;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      this.isLoadingNote = false;
    }
  }

  /**
   * Re-fetch the active note (after a write) and broadcast.
   * @param {string|number} noteId
   */
  async refreshNote(noteId) {
    try {
      const noteData = await fetchNoteById(noteId);
      if (noteData) {
        this.noteBlocks = noteData.note_blocks || [];
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error refreshing note:', error);
    }
  }

  /**
   * Submit/update a student draft — idempotent PATCH upsert with client-generated UUID.
   * @param {string|number} noteId
   * @param {string} text
   * @param {string|undefined} blockId
   * @param {string|undefined} assignmentRef
   */
  async submitDraft(noteId, text, blockId, assignmentRef) {
    if (!noteId || !text?.trim()) return null;
    const id = blockId || crypto.randomUUID();
    try {
      await updateNoteBlock(noteId, id, {
        block: text,
        role: 'user',
        block_type: 'simple_note',
        assignment_ref: assignmentRef || undefined,
      });
      await this.refreshNote(noteId);
      return { status: 'ok', blockId: id };
    } catch (error) {
      console.error('Error submitting draft:', error);
      return null;
    }
  }

  /**
   * Run AI Check on a draft block.
   * @param {string|number} noteId
   * @param {string} blockId
   */
  async runAICheck(noteId, blockId) {
    if (!noteId || !blockId) return null;
    try {
      const result = await analyzeDraft(noteId, blockId);
      await this.refreshNote(noteId);
      return result;
    } catch (error) {
      console.error('Error running AI Check:', error);
      return null;
    }
  }

  /**
   * Send a Q&A question about an assignment.
   * @param {string|number} noteId
   * @param {string} question
   * @param {string|undefined} assignmentRef
   */
  async sendQuestion(noteId, question, assignmentRef) {
    if (!noteId || !question?.trim()) return null;
    try {
      const qaBlock = await apiSendQuestion(noteId, {
        question,
        assignment_ref: assignmentRef,
      });
      await this.refreshNote(noteId);
      return qaBlock;
    } catch (error) {
      console.error('Error sending question:', error);
      return null;
    }
  }

  /**
   * Add a new assignment block to an existing note.
   * Accepts either plain text, or an array of parsed segments
   * (text + image) from the paste modal.
   * @param {string|number} noteId
   * @param {string|Array<{ type: 'text'|'image', content: string, src?: string }>} input
   * @param {object} [metadata]
   */
  async addAssignment(noteId, input, metadata = {}) {
    if (!noteId) return null;

    const segments = Array.isArray(input) ? input : (input?.trim() ? [{ type: 'text', content: input.trim() }] : []);
    if (segments.length === 0) return null;

    try {
      const { imageSrcToFile } = await import('./utils/importPaste');

      for (const segment of segments) {
        if (segment.type === 'text' && segment.content?.trim()) {
          const text = segment.content.trim();
          const description = text.length > 120 ? text.slice(0, 120) + '…' : text;
          await sendNoteBlock(noteId, {
            block: text,
            block_type: 'assignment',
            metadata_: { description, category: 'Writing', ...metadata },
          });
        } else if (segment.type === 'image' && segment.src) {
          const file = await imageSrcToFile(segment.src);
          if (!file) continue;
          const uploaded = await uploadNoteImage(noteId, file);
          if (!uploaded) continue;
          await sendNoteBlock(noteId, {
            block: `@image:${uploaded.id}`,
            block_type: 'assignment',
            image_ids: [uploaded.id],
            metadata_: { description: 'Image assignment', category: 'Visual', ...metadata },
          });
        }
      }

      await this.refreshNote(noteId);
      return { status: 'ok' };
    } catch (error) {
      console.error('Error adding assignment:', error);
      return null;
    }
  }

  reset() {
    this.noteBlocks = [];
    this.maxNoteBlockId = 0;
    this.isLoadingNote = false;
    this.notifyListeners();
  }

  getState() {
    return {
      noteBlocks: this.noteBlocks,
      maxNoteBlockId: this.maxNoteBlockId,
      revision: this.revision,
    };
  }
}

export default HomeworkManager;
