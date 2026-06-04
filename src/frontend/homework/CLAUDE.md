# Homework Frontend — Agent Reference

## Button → API Mapping

| UI Button | Hook Function | API Endpoint(s) |
|---|---|---|
| **Submit** | `submitDraft(noteId, text, blockId, assignmentRef)` | `PATCH /coach/notes/{noteId}/block/{blockId}` → `GET /coach/notes/{noteId}` |
| **AI Check** | `runAICheck(noteId, blockId)` *(auto-saves draft first if needed)* | (optional) `PATCH .../block/{blockId}` → `POST /coach/notes/{noteId}/block/{blockId}/analyze` → `GET /coach/notes/{noteId}` |
| **Q&A Send** | `sendQuestion(noteId, question, assignmentRef)` | `POST /coach/notes/{noteId}/question` → `GET /coach/notes/{noteId}` |
| **Select assignment** | `selectNote(id)` (route change) | `GET /coach/notes/{noteId}` |
| **Page load** | `fetchAssignments()` (auto) | `GET /coach/notes/?block_type=assignment` |

All endpoints are prefixed with `API_BASE_URL` (`http://localhost:8000/api/` in dev).

## Key Files

| File | Purpose |
|---|---|
| `HomeworkListManager.js` | Singleton class: list, current note, route sync, delete. Owns a HomeworkManager. |
| `HomeworkManager.js` | Singleton class per active note: loadNote, submitDraft, runAICheck, sendQuestion, reset. |
| `hooks/useHomeworkLab.js` | React adapter: `useSyncExternalStore` on the manager. Returns activeNote + action callbacks. |
| `HomeworkLab.jsx` | Page shell. Shows `NoteListView` picker when no noteId; split-pane view (cards + drafting area) when one is selected. |
| `components/DraftingArea.jsx` | Editor + AI Check + Q&A tabs. Reads `activeNote` only. |
| `components/AssignmentCard.jsx` | Assignment card in the feed (one per assignment block). |
| `components/SideNavBar.jsx` | Left sidebar with inquiries. |
| `components/TopNavBar.jsx` | Top bar with user info. |
| `HomeworkLab.css` | All homework styles (design tokens + components). |

## State Management Pattern

Mirrors the notewindow `NoteListManager` + `NoteManager` pair:

- `App.jsx` creates the `HomeworkListManager` once via `useMemo`, wires `setNavigateCallback(navigate)`, calls `loadNotes()` on mount, and re-runs `setCurrentNoteFromPath(location.pathname)` on every route change.
- `useHomeworkLab` subscribes via `useSyncExternalStore` — the snapshot is cached so React doesn't infinite-loop.
- The hook syncs the manager to the URL on `noteId` change via a `useEffect`, then derives `activeNote` from `currentNoteId` + `homeworkManager.getState().noteBlocks`.
- The route `/homework` shows `NoteListView` (same component as `/notelist`); `/homework/:noteId` shows the split-pane view.

## URL → Entity Mapping

| URL segment | Represents | Entity |
|---|---|---|
| `homework` | frontend route/tab | (frontend scope) |
| `<noteId>` | task id | `Note.id` |
| `assignment` | block scope within a task | `NoteBlock` (filtered by `block_type="assignment"`) |
| `<blockId>` | block id | `NoteBlock.id` |

A homework task IS a `Note`. It contains blocks: one `assignment` block (the prompt) and child blocks (drafts, feedback, Q&A) linked back via `assignment_ref`.

## Data Model

- **Note** — the homework task itself, fetched via `/coach/notes/{id}`. One Note = one homework task.
- **NoteBlock** — child of Note, has `block_type`, `role`, `assignment_ref`
  - `block_type="assignment"` — the prompt/instructions
  - `block_type="simple_note"` `role="user"` — student draft (linked via `assignment_ref`, one per assignment block)
  - `block_type="ai_feedback"` — AI analysis result (linked via `assignment_ref`)
  - `block_type="question"` — Q&A pair (NOT filtered by `assignment_ref`)
- Relationship: `Note` (1) → `NoteBlock` (N). `assignment_ref` is a self-referential pointer from child blocks back to their `assignment` block.
- Block IDs are UUID strings (client-generated via `crypto.randomUUID()` for new drafts)

## Layout Constraints

- Page must not scroll vertically (`document.scrollingElement.scrollHeight === clientHeight`)
- All scroll happens inside nested flex containers with `overflow-y: auto`
- Tab content wrappers must use `display: flex; flex-direction: column; flex: 1; min-height: 0` to prevent overflow clipping
- `.hw-page` and `.hw-content-wrapper` use `height: 100%` (not `100vh`) to respect parent constraints