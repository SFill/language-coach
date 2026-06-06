# 2026-06-06 — Homework Assignment Selection & Fixes

## What was done

1. **Removed ImportWorkspace from DraftingArea** — The editor (contentEditable) now always shows when a note is selected, instead of showing ImportWorkspace when there's no draft content.

2. **Implemented assignment selection** — Added `activeAssignmentId` state to `HomeworkLab.jsx`. Clicking a card sets it as active. DraftingArea receives the prop and uses it to find the correct assignment block, draft, and feedback (instead of always showing the first assignment).

3. **Assignment prompt scrollable** — Added `max-height: 300px; overflow-y: auto; flex-shrink: 0` to `.hw-assignment-prompt`.

4. **Wrote test** `tests/assignment-selection.spec.ts` — Tests switching assignments, verifying prompts/drafts update independently, Submit saves with correct `assignment_ref`.

5. **Bug: first assignment not auto-selected from NoteListView** — Navigating from NoteListView to a note left no card active. Started fixing with ref-based approach in `useEffect`, but `cards` array reference instability caused the effect to misfire. **This bug is still open** — the `initializedForNoteRef` approach needs further debugging.

6. **Changed image upload directory** — `upload_dir` default changed from `/tmp/note_images` to `data/note_images` in `settings.py`. Updated backend CLAUDE.md docs.

7. **Added File & Image Storage section** to `docs/chat-bot-backend.md` — documents upload/serve/delete flows, storage location, MIME allowlist, size limit.

## Bug fix: first assignment not auto-selected

Root cause: Two issues in `useHomeworkLab` state propagation:

1. **`HomeworkListManager` didn't propagate `HomeworkManager` state changes** — When `loadNote` completed, `HomeworkManager.notifyListeners()` fired but `HomeworkListManager` subscribers (including `useSyncExternalStore`) weren't notified, so React never re-rendered to pick up the loaded blocks.

2. **`getSnapshot` caching didn't compare `hmRevision`** — Even if notified, the snapshot comparison skipped internal manager state changes since `homeworkManager` is the same object reference. Added `hmRevision` to the comparison and snapshot object.

Fix: Added `this.homeworkManager.subscribe(() => this.notifyListeners())` in `HomeworkListManager` constructor, and included `hmRevision` in `getSnapshot` comparison. Simplified the `useEffect` in `HomeworkLab.jsx` — removed the `useRef` hack, now just checks if current selection is still valid.

- `src/frontend/homework/HomeworkLab.jsx` — added `activeAssignmentId` state, `useRef` for initialization tracking, wired `isActive`/`onSelect` on cards, passed prop to DraftingArea
- `src/frontend/homework/components/DraftingArea.jsx` — accepted `activeAssignmentId` prop, uses it for block lookups, removed `localDraft` state, clears editor on assignment switch
- `src/frontend/homework/HomeworkLab.css` — made `.hw-assignment-prompt` scrollable with `max-height: 300px`
- `src/backend/settings.py` — changed `upload_dir` default to `data/note_images`
- `docs/chat-bot-backend.md` — added File & Image Storage section
- `tests/assignment-selection.spec.ts` — new test file

## Open issues

_(none — all issues resolved)_