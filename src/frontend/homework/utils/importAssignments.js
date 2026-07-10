import { createNewNote, sendNoteBlock, uploadNoteImage } from '../../api';
import { imageSrcToFile } from './importPaste';

/**
 * Import parsed clipboard exercises as assignment blocks in a new Note — one
 * block per exercise. An exercise's images are uploaded and attached via
 * `image_ids`; its text becomes the block content (and the card description).
 *
 * @param {Array<{ type: 'exercise', text: string, images: string[] }>} exercises
 * @param {string} [noteName] — name for the new note
 * @returns {Promise<{ noteId: number, note: object }>} — the created note
 */
export async function importAssignments(exercises, noteName = 'Imported Homework') {
  // 1. Create a new Note
  const note = await createNewNote({ name: noteName });
  if (!note) {
    throw new Error('Failed to create note');
  }
  const noteId = note.id;

  // 2. One assignment block per exercise
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
      if (imageIds.length === 0) continue; // all image uploads failed — skip

      const description = text.length > 120 ? text.slice(0, 120) + '…' : (text || 'Image assignment');
      await sendNoteBlock(noteId, {
        block: text,
        block_type: 'assignment',
        image_ids: imageIds,
        metadata_: { description, category: 'Visual' },
      });
    } else if (text) {
      const description = text.length > 120 ? text.slice(0, 120) + '…' : text;
      await sendNoteBlock(noteId, {
        block: text,
        block_type: 'assignment',
        metadata_: { description, category: 'Writing' },
      });
    }
  }

  return { noteId, note };
}