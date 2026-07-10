import {
  fetchNoteById,
  updateNoteBlock,
  analyzeDraft,
  sendQuestion as apiSendQuestion,
  sendNoteBlock,
  uploadNoteImage,
  deleteNoteBlock,
} from '../api';

/**
 * HomeworkManager — plain domain class: holds a note's blocks and the operations
 * on them. Knows nothing about React. Methods are arrow class fields so `this` is
 * bound to the instance — they can be passed straight as React callbacks without
 * detaching the receiver. After any mutation it pokes `onChange`, which a
 * reactive store wires up to broadcast to subscribers.
 */
class HomeworkManager {
  noteBlocks = [];
  maxNoteBlockId = 0;
  isLoadingNote = false;
  onChange = null;

  /**
   * Load a note by id and broadcast its blocks.
   * @param {string|number} noteId
   */
  loadNote = async (noteId) => {
    if (this.isLoadingNote) return;
    try {
      this.isLoadingNote = true;
      const noteData = await fetchNoteById(noteId);
      if (noteData) {
        this.noteBlocks = noteData.note_blocks || [];
        this.maxNoteBlockId = this.noteBlocks.length;
        this.onChange?.();
      }
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      this.isLoadingNote = false;
    }
  };

  /**
   * Re-fetch the active note (after a write) and broadcast.
   * @param {string|number} noteId
   */
  refreshNote = async (noteId) => {
    try {
      const noteData = await fetchNoteById(noteId);
      if (noteData) {
        this.noteBlocks = noteData.note_blocks || [];
        this.onChange?.();
      }
    } catch (error) {
      console.error('Error refreshing note:', error);
    }
  };

  /**
   * Submit/update a student draft — idempotent PATCH upsert with client-generated UUID.
   * @param {string|number} noteId
   * @param {string} text
   * @param {string|undefined} blockId
   * @param {string|undefined} assignmentRef
   */
  submitDraft = async (noteId, text, blockId, assignmentRef) => {
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
  };

  /**
   * Run AI Check on a draft block.
   * @param {string|number} noteId
   * @param {string} blockId
   */
  runAICheck = async (noteId, blockId) => {
    if (!noteId || !blockId) return null;
    try {
      const result = await analyzeDraft(noteId, blockId);
      await this.refreshNote(noteId);
      return result;
    } catch (error) {
      console.error('Error running AI Check:', error);
      return null;
    }
  };

  /**
   * Send a Q&A question about an assignment.
   * @param {string|number} noteId
   * @param {string} question
   * @param {string|undefined} assignmentRef
   */
  sendQuestion = async (noteId, question, assignmentRef) => {
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
  };

  /**
   * Delete a Q&A inquiry block from a note's history.
   * @param {string|number} noteId
   * @param {string} blockId — UUID of the question block
   */
  deleteInquiry = async (noteId, blockId) => {
    if (!noteId || !blockId) return null;
    try {
      await deleteNoteBlock(noteId, blockId);
      await this.refreshNote(noteId);
      return { status: 'ok' };
    } catch (error) {
      console.error('Error deleting inquiry:', error);
      return null;
    }
  };

  /**
   * Add assignment blocks to an existing note — one per exercise. Accepts
   * either plain text (a single text-only exercise) or an array of parsed
   * exercises from the paste modal.
   * @param {string|number} noteId
   * @param {string|Array<{ type: 'exercise', text: string, images: string[] }>} input
   * @param {object} [metadata]
   */
  addAssignment = async (noteId, input, metadata = {}) => {
    if (!noteId) return null;

    const exercises = Array.isArray(input)
      ? input
      : (input?.trim() ? [{ type: 'exercise', text: input.trim(), images: [] }] : []);
    if (exercises.length === 0) return null;

    try {
      const { imageSrcToFile } = await import('./utils/importPaste');

      for (const exercise of exercises) {
        const text = exercise.text?.trim() || '';

        if (exercise.images.length > 0) {
          const imageIds = [];
          for (const src of exercise.images) {
            const file = await imageSrcToFile(src);
            if (!file) continue;
            const uploaded = await uploadNoteImage(noteId, file);
            if (uploaded) imageIds.push(uploaded.id);
          }
          if (imageIds.length === 0) continue;

          const description = text.length > 120 ? text.slice(0, 120) + '…' : (text || 'Image assignment');
          await sendNoteBlock(noteId, {
            block: text,
            block_type: 'assignment',
            image_ids: imageIds,
            metadata_: { description, category: 'Visual', ...metadata },
          });
        } else if (text) {
          const description = text.length > 120 ? text.slice(0, 120) + '…' : text;
          await sendNoteBlock(noteId, {
            block: text,
            block_type: 'assignment',
            metadata_: { description, category: 'Writing', ...metadata },
          });
        }
      }

      await this.refreshNote(noteId);
      return { status: 'ok' };
    } catch (error) {
      console.error('Error adding assignment:', error);
      return null;
    }
  };

  reset = () => {
    this.noteBlocks = [];
    this.maxNoteBlockId = 0;
    this.isLoadingNote = false;
    this.onChange?.();
  };

  getState = () => ({
    noteBlocks: this.noteBlocks,
    maxNoteBlockId: this.maxNoteBlockId,
    isLoadingNote: this.isLoadingNote,
  });
}

export default HomeworkManager;