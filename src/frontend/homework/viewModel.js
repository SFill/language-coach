import { getNoteImageUrl } from '../api';

/**
 * Build the assignment-card view model for the active note — one card per
 * `assignment` block. Pure function of (currentNoteId, noteBlocks); empty when
 * no note is active (the picker uses NoteListView, not the card grid).
 */
export function buildCards(currentNoteId, noteBlocks) {
  if (!currentNoteId) return [];
  return noteBlocks
    .filter((b) => b.block_type === 'assignment')
    .map((block) => ({
      id: String(currentNoteId),
      blockId: String(block.id),
      image: block.image_ids?.length ? getNoteImageUrl(currentNoteId, block.image_ids[0]) : null,
      category: block.metadata_?.category || '',
      categoryColor: block.metadata_?.categoryColor || 'primary',
      duration: block.metadata_?.duration || 0,
      description: block.metadata_?.description || '',
      targetLength: block.metadata_?.targetLength || '',
      difficulty: block.metadata_?.difficulty || '',
    }));
}