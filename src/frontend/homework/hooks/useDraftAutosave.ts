import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { SyncCoordinator } from '../../sync/SyncCoordinator';
import { useSyncStatus } from '../../sync/useSyncStatus';
import { docToPlainText } from '../utils/draftDoc';

// Delay after the user stops editing before the draft is synced to the server.
const AUTOSAVE_DELAY = 5000;

export type AutosaveStatus = 'idle' | 'pending' | 'saving';

interface ActiveNote {
  id: number | string;
}

interface PendingJob {
  noteId: number | string;
  assignmentId: string | undefined;
  draftId: string | undefined;
  text: string;
}

interface ContextSnapshot {
  noteId: number | string | undefined;
  assignmentId: string | undefined;
  draftId: string | undefined;
}

// submitDraft comes from HomeworkListStore (a stable class-method reference); the
// hook still keeps a ref so the once-created coordinator's persister is decoupled
// from the render lifecycle.
type SubmitDraft = (
  noteId: number | string,
  text: string,
  blockId: string,
  assignmentRef?: string,
) => Promise<{ blockId: string } | null | undefined>;

export interface UseDraftAutosaveResult {
  coordinator: SyncCoordinator;
  scheduleAutosave: () => void;
  scheduleAutosaveRef: RefObject<() => void>;
  autosaveStatus: AutosaveStatus;
  lastSavedTextRef: MutableRefObject<string>;
}

/**
 * Debounced draft autosave. The editor is the source of truth while editing;
 * the server is synced 5s after the user stops typing via a SyncCoordinator
 * (same executor the wordlist dirty-sync uses). The coordinator owns the
 * in-flight guard + status; the caller owns the trigger policy (schedule on
 * edit, flush on context switch / AI-Check / unmount).
 *
 * `scheduleAutosaveRef.current` is reassigned every render (NOT in an effect) so
 * the editor's onTransaction — which closes over the ref — always dispatches to
 * the latest `scheduleAutosave`.
 */
export function useDraftAutosave({
  editorInstRef,
  activeNote,
  assignmentId,
  draftBlockId,
  submitDraft,
}: {
  editorInstRef: RefObject<Editor | null>;
  activeNote: ActiveNote | null;
  assignmentId: string | undefined;
  draftBlockId: string | undefined;
  submitDraft: SubmitDraft;
}): UseDraftAutosaveResult {
  const lastSavedTextRef = useRef('');   // last draft text confirmed on the server
  const pendingJobRef = useRef<PendingJob | null>(null); // queued for sync
  // Live context for scheduling — updated whenever the active note/assignment/draft change.
  const contextRef = useRef<ContextSnapshot>({ noteId: undefined, assignmentId: undefined, draftId: undefined });
  const scheduleAutosaveRef = useRef<() => void>(() => {});

  // Keep the live context ref in sync so the debounce timer (scheduled from
  // onTransaction, which can't see fresh props) always saves against the
  // current note/assignment/draft.
  useEffect(() => {
    contextRef.current = { noteId: activeNote?.id, assignmentId, draftId: draftBlockId };
  }, [activeNote?.id, assignmentId, draftBlockId]);

  const submitDraftRef = useRef<SubmitDraft>(submitDraft);
  useEffect(() => { submitDraftRef.current = submitDraft; }, [submitDraft]);

  // One coordinator for the life of this DraftingArea. Its getPayload/persister
  // read refs, so they always see fresh state despite being created once.
  const coordinatorRef = useRef<SyncCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = new SyncCoordinator({
      delay: AUTOSAVE_DELAY,
      // Payload = the queued draft job, but only if it's actually dirty vs the
      // last server-confirmed snapshot (so no-op flushes resolve to idle).
      getPayload: () => {
        const job = pendingJobRef.current;
        if (!job || !job.text?.trim()) return null;
        if (job.text === lastSavedTextRef.current && job.draftId) return null;
        return job;
      },
      // Persist one draft: PATCH the block, then remember the confirmed text.
      // Returns the block id so AI-Check (which calls flush()) can use it.
      persister: async (job: PendingJob) => {
        const blockId = job.draftId || crypto.randomUUID();
        await submitDraftRef.current(job.noteId, job.text, blockId, job.assignmentId);
        lastSavedTextRef.current = job.text;
        return { blockId };
      },
    });
  }
  const coordinator = coordinatorRef.current;
  const autosaveStatus = useSyncStatus(coordinator) as AutosaveStatus;

  // Schedule a debounced save: capture the editor text + context NOW so the
  // timer still saves the right thing if the user switches assignment before it fires.
  const scheduleAutosave = useCallback(() => {
    const e = editorInstRef.current;
    if (!e) return;
    const ctx = contextRef.current;
    if (ctx.noteId == null) return;
    const text = docToPlainText(e.state.doc);
    if (!text.trim()) return;
    pendingJobRef.current = {
      noteId: ctx.noteId,
      assignmentId: ctx.assignmentId,
      draftId: ctx.draftId,
      text,
    };
    coordinator.schedule();
  }, [coordinator, editorInstRef]);
  scheduleAutosaveRef.current = scheduleAutosave;

  // Flush any pending edit on unmount (navigate-away) — like the wordlist
  // beforeunload sync. Fire-and-forget: in-SPA navigation doesn't unload the
  // page, so the PATCH completes.
  useEffect(() => () => {
    void coordinator.flush();
  }, [coordinator]);

  return {
    coordinator,
    scheduleAutosave,
    scheduleAutosaveRef,
    autosaveStatus,
    lastSavedTextRef,
  };
}

export default useDraftAutosave;