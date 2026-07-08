import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Editor } from '@tiptap/react';
import type { SyncCoordinator } from '../../sync/SyncCoordinator';
import type { TooltipState } from './useDraftTooltip';
import {
  plainTextToDocJSON,
  chunksToDocJSON,
  docToPlainText,
  loadEditorContent,
  countWords,
} from '../utils/draftDoc';
import { reconcileHighlights } from '../utils/reconcileHighlights';

interface NoteBlockLike {
  id?: string;
  content?: string | unknown[];
}

interface ActiveNote {
  id: number | string;
}

export interface UseDraftContentLoaderArgs {
  editor: Editor | null;
  activeNote: ActiveNote | null;
  activeAssignmentId: string | undefined;
  assignmentId: string | undefined;
  draftBlock: NoteBlockLike | undefined;
  feedbackBlock: NoteBlockLike | undefined;
  segments: Array<{ text?: string; type?: string; annotation?: string; word?: string; phonetic?: string }>;
  coordinator: SyncCoordinator;
  setTooltip: Dispatch<SetStateAction<TooltipState>>;
  setWordCount: Dispatch<SetStateAction<number>>;
  lastWordCountRef: MutableRefObject<number>;
  lastSavedTextRef: MutableRefObject<string>;
  segmentsStaleRef: MutableRefObject<boolean>;
  suppressAutosaveRef: MutableRefObject<boolean>;
}

interface DepsSnapshot {
  noteId: number | string | undefined;
  assignmentId: string | undefined;
  draftId: string | undefined;
  feedbackId: string | undefined;
}

/**
 * Reloads editor content when the active note / assignment / draft / feedback
 * changes. Builds the doc from feedback segments (with LCS reconciliation) or
 * the draft text, applies the first-save clobber guard, suppresses the autosave
 * schedule during the programmatic load, and flushes the autosave on context
 * switch. `prevDepsRef` and `renderedFeedbackIdRef` are owned here; the autosave
 * refs are borrowed (shared with useDraftAutosave / useDraftEditor).
 */
export function useDraftContentLoader({
  editor,
  activeNote,
  activeAssignmentId,
  assignmentId,
  draftBlock,
  feedbackBlock,
  segments,
  coordinator,
  setTooltip,
  setWordCount,
  lastWordCountRef,
  lastSavedTextRef,
  segmentsStaleRef,
  suppressAutosaveRef,
}: UseDraftContentLoaderArgs): void {
  const prevDepsRef = useRef<DepsSnapshot>({ noteId: undefined, assignmentId: undefined, draftId: undefined, feedbackId: undefined });
  const renderedFeedbackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editor) return;

    const noteId = activeNote?.id;
    const draftId = draftBlock?.id;
    const feedbackId = feedbackBlock?.id;
    const prev = prevDepsRef.current;
    const isContextSwitch = noteId !== prev.noteId || assignmentId !== prev.assignmentId;
    const isFeedbackChange = feedbackId !== prev.feedbackId;
    // First save creates the draft block: draftId goes undefined -> defined.
    const isDraftCreate = !!draftId && !prev.draftId;

    // On context switch, flush any pending autosave for the previous assignment
    // so unsaved edits aren't lost when we swap the editor content.
    if (isContextSwitch) {
      void coordinator.flush();
    }

    if (feedbackId && feedbackId !== renderedFeedbackIdRef.current) {
      segmentsStaleRef.current = false;
      renderedFeedbackIdRef.current = feedbackId;
    } else if (!feedbackId) {
      segmentsStaleRef.current = false;
      renderedFeedbackIdRef.current = null;
    }

    // Normalize once: \r\n -> \n. This normalized value is used both for the
    // exact-match check and passed to reconcileHighlights, so a backend that
    // returns \r\n doesn't cause the LCS diff to drop every highlight.
    const draftText = typeof draftBlock?.content === 'string'
      ? draftBlock.content.replace(/\r\n/g, '\n')
      : '';
    let docJSON;
    if (segments.length > 0 && !segmentsStaleRef.current) {
      const segmentsText = segments.map((s) => s.text || '').join('');
      // Use segments directly only on an EXACT (un-trimmed) match, so any
      // leading/trailing whitespace present in the draft but not in the segments
      // isn't silently dropped. Otherwise reconcile against the draft text,
      // which rebuilds from the draft (preserving its whitespace) and drops
      // only stale highlights.
      const chunks = (segmentsText === draftText || !draftText.trim())
        ? segments.map((seg) => ({
            text: seg.text,
            type: seg.type,
            highlight: seg.type !== 'plain',
            annotation: seg.annotation,
            word: seg.word,
            phonetic: seg.phonetic,
          }))
        : reconcileHighlights(segments, draftText);
      docJSON = chunksToDocJSON(chunks);
    } else if (draftText) {
      docJSON = plainTextToDocJSON(draftText);
    } else {
      docJSON = plainTextToDocJSON('');
    }

    // Clobber guard: the only reload triggered by our own autosave is the
    // first save creating the draft block. If the user kept typing while that
    // save's PATCH was in flight, the editor is now ahead of the just-saved
    // snapshot — preserve the editor instead of overwriting it. AI-Check
    // reloads (feedbackId change) and context switches are never skipped.
    if (isDraftCreate && !isContextSwitch && !isFeedbackChange) {
      const currentEditorText = docToPlainText(editor.state.doc);
      if (currentEditorText && currentEditorText !== draftText) {
        lastSavedTextRef.current = draftText;
        prevDepsRef.current = { noteId, assignmentId, draftId, feedbackId };
        return;
      }
    }

    // Suppress the autosave schedule while programmatically loading content:
    // setContent fires onTransaction with docChanged=true, but a server-snapshot
    // load is not a user edit and must not re-arm the debounce.
    suppressAutosaveRef.current = true;
    loadEditorContent(editor, docJSON);
    suppressAutosaveRef.current = false;
    setTooltip({ anchorEl: null, data: null });
    const wc = countWords(editor.getText());
    lastWordCountRef.current = wc;
    setWordCount(wc);
    // The editor now mirrors the server snapshot — mark it in sync.
    lastSavedTextRef.current = draftText;
    prevDepsRef.current = { noteId, assignmentId, draftId, feedbackId };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when blocks change
  }, [editor, activeNote?.id, activeAssignmentId, draftBlock?.id, feedbackBlock?.id]);
}

export default useDraftContentLoader;