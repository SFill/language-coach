import { createNewNote, sendNoteBlock, uploadNoteImage } from '../../api';
import { imageSrcToFile } from './importPaste';

/**
 * Import parsed clipboard segments as assignment blocks in a new Note.
 *
 * @param {Array<{ type: 'text'|'image', content: string, src?: string }>} segments
 * @param {string} [noteName] — name for the new note
 * @returns {Promise<{ noteId: number, note: object }>} — the created note
 */
export async function importAssignments(segments, noteName = 'Imported Homework') {
  // 1. Create a new Note
  const note = await createNewNote({ name: noteName });
  if (!note) {
    throw new Error('Failed to create note');
  }
  const noteId = note.id;

  // 2. For each segment, create an assignment block
  for (const segment of segments) {
    if (segment.type === 'text') {
      const truncated = segment.content.length > 120
        ? segment.content.slice(0, 120) + '…'
        : segment.content;
      await sendNoteBlock(noteId, {
        block: segment.content,
        block_type: 'assignment',
        metadata_: { description: truncated, category: 'Writing' },
      });
    } else if (segment.type === 'image' && segment.src) {
      // Upload image first
      const file = await imageSrcToFile(segment.src);
      if (!file) continue; // skip failed image fetches

      const uploaded = await uploadNoteImage(noteId, file);
      if (!uploaded) continue;

      // Create assignment block referencing the image
      await sendNoteBlock(noteId, {
        block: `@image:${uploaded.id}`,
        block_type: 'assignment',
        image_ids: [uploaded.id],
        metadata_: { description: 'Image assignment', category: 'Visual' },
      });
    }
  }

  return { noteId, note };
}