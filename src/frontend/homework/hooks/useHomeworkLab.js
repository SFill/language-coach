import { useSyncExternalStore, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router';
import { getNoteImageUrl } from '../../api';

const EMPTY_STATE = Object.freeze({
  noteList: [],
  currentNoteId: null,
  currentNoteName: null,
  homeworkManager: null,
});

/**
 * useHomeworkLab — thin React adapter for HomeworkListManager.
 * Subscribes via useSyncExternalStore. Caches the snapshot so React doesn't
 * detect a "new" snapshot on every call (which would cause infinite renders).
 */
export function useHomeworkLab(homeworkListManager) {
  const { noteId } = useParams();
  const snapshotRef = useRef(EMPTY_STATE);

  const subscribe = useCallback(
    (cb) => {
      if (!homeworkListManager) return () => {};
      return homeworkListManager.subscribe(cb);
    },
    [homeworkListManager],
  );

  const getSnapshot = useCallback(() => {
    if (!homeworkListManager) return EMPTY_STATE;
    const next = homeworkListManager.getState();
    const hmRevision = next.homeworkManager?.getState().revision || 0;
    // Only return a new object reference if state actually changed.
    const prev = snapshotRef.current;
    if (
      prev === EMPTY_STATE ||
      prev.noteList !== next.noteList ||
      prev.currentNoteId !== next.currentNoteId ||
      prev.currentNoteName !== next.currentNoteName ||
      prev.hmRevision !== hmRevision ||
      prev.showPicker !== next.showPicker
    ) {
      snapshotRef.current = { ...next, hmRevision };
    }
    return snapshotRef.current;
  }, [homeworkListManager]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Keep the manager in sync with the URL on path/noteId change.
  useEffect(() => {
    if (!homeworkListManager) return;
    const path = window.location.pathname;
    homeworkListManager.setCurrentNoteFromPath(path);
  }, [noteId, homeworkListManager]);

  const hm = state.homeworkManager;
  const hmRevision = hm?.getState().revision || 0;

  // Reconstruct activeNote shape expected by DraftingArea.
  const activeNote = useMemo(() => {
    if (!state.currentNoteId) return null;
    const noteBlocks = hm?.getState().noteBlocks || [];
    return { id: state.currentNoteId, note_blocks: noteBlocks };
  }, [state.currentNoteId, hm, hmRevision]);

  // Cards: one per assignment block in the active note. Empty when no note is active
  // (the picker uses NoteListView, not the card grid).
  const cards = useMemo(() => {
    if (!state.currentNoteId) return [];
    const noteBlocks = hm?.getState().noteBlocks || [];
    return noteBlocks
      .filter((b) => b.block_type === 'assignment')
      .map((block) => ({
        id: String(state.currentNoteId),
        blockId: String(block.id),
        image: block.image_ids?.length ? getNoteImageUrl(state.currentNoteId, block.image_ids[0]) : null,
        category: block.metadata_?.category || '',
        categoryColor: block.metadata_?.categoryColor || 'primary',
        duration: block.metadata_?.duration || 0,
        description: block.metadata_?.description || '',
        targetLength: block.metadata_?.targetLength || '',
        difficulty: block.metadata_?.difficulty || '',
      }));
  }, [state.currentNoteId, hm, hmRevision]);

  return {
    notes: state.noteList,
    noteId: state.currentNoteId,
    activeNote,
    cards,
    showPicker: state.showPicker,
    selectNote: (id) => homeworkListManager?.selectNote(id),
    addAssignment: hm?.addAssignment.bind(hm) || (() => null),
    submitDraft: hm?.submitDraft.bind(hm) || (() => null),
    runAICheck: hm?.runAICheck.bind(hm) || (() => null),
    sendQuestion: hm?.sendQuestion.bind(hm) || (() => null),
    deleteNote: (id) => homeworkListManager?.deleteNote(id),
    togglePicker: () => homeworkListManager?.togglePicker(),
    loading: false,
    error: null,
  };
}
