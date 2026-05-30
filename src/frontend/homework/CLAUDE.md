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
| `hooks/useHomeworkLab.js` | Hook: data fetching, state, API calls |
| `components/DraftingArea.jsx` | Editor + AI Check + Q&A tabs |
| `components/TaskCard.jsx` | Assignment card in the feed |
| `components/SideNavBar.jsx` | Left sidebar with inquiries |
| `components/TopNavBar.jsx` | Top bar with user info |
| `HomeworkLab.jsx` | Page shell: sidebar + cards + drafting area |
| `HomeworkLab.css` | All homework styles (design tokens + components) |

## Data Model

- **Note** — top-level container, fetched via `/coach/notes/{id}`
- **NoteBlock** — child of Note, has `block_type`, `role`, `assignment_ref`
  - `block_type="assignment"` — the prompt/instructions
  - `block_type="simple_note"` `role="user"` — student draft (linked via `assignment_ref`)
  - `block_type="ai_feedback"` — AI analysis result (linked via `assignment_ref`)
  - `block_type="question"` — Q&A pair (NOT filtered by `assignment_ref`)
- Block IDs are UUID strings (client-generated via `crypto.randomUUID()` for new drafts)

## Layout Constraints

- Page must not scroll vertically (`document.scrollingElement.scrollHeight === clientHeight`)
- All scroll happens inside nested flex containers with `overflow-y: auto`
- Tab content wrappers must use `display: flex; flex-direction: column; flex: 1; min-height: 0` to prevent overflow clipping
- `.hw-page` and `.hw-content-wrapper` use `height: 100%` (not `100vh`) to respect parent constraints