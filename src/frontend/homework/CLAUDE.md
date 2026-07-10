# Homework Frontend — Agent Reference

## Button → API Mapping

| UI Action | Function | API Endpoint(s) |
|---|---|---|
| **Autosave** (replaces the old Submit button) | `SyncCoordinator` persister → `submitDraft(noteId, text, blockId, assignmentRef)` | `PATCH /coach/notes/{noteId}/block/{blockId}` → `GET /coach/notes/{noteId}` |
| **AI Check** | `runAICheck(noteId, blockId)` *(flushes pending autosave first via `coordinator.flush()`)* | `PATCH .../block/{blockId}` (if dirty) → `POST /coach/notes/{noteId}/block/{blockId}/analyze` → `GET /coach/notes/{noteId}` |
| **Q&A Send** | `sendQuestion(noteId, question, assignmentRef)` | `POST /coach/notes/{noteId}/question` → `GET /coach/notes/{noteId}` |
| **Select assignment** | `selectNote(id)` (route change) | `GET /coach/notes/{noteId}` |
| **Page load** | `fetchAssignments()` (auto) | `GET /coach/notes/?block_type=assignment` |

The Submit button was **removed** — the draft now syncs via a debounced autosave (5s after
the user stops typing) through the shared `SyncCoordinator` (see `sync/SyncCoordinator.js`,
also used by wordlist). Autosave also flushes immediately on context switch (assignment
change) and unmount (navigate-away). The AI Check button is disabled while a save is in
flight (`autosaveStatus === 'saving'`).

All endpoints are prefixed with `API_BASE_URL` (`http://localhost:8000/api/` in dev).

## Key Files

| File | Purpose |
|---|---|
| `HomeworkListManager.js` | Plain domain class: list, current note, route sync, delete. Owns a HomeworkManager. No React code — pokes `onChange` after each mutation (and propagates `HomeworkManager.onChange` upward). Methods are arrow class fields so they can be passed straight as React callbacks. |
| `HomeworkManager.js` | Plain domain class for the active note: loadNote, submitDraft, runAICheck, sendQuestion, reset. Pokes `onChange` after each mutation. No React code. Methods are arrow class fields. |
| `HomeworkListStore.js` | The only React-facing piece. Owns a `HomeworkListManager`, caches one stable snapshot, exposes `subscribe`/`getSnapshot` for `useSyncExternalStore`. Actions are called directly on `store.mgr` / `store.mgr.homeworkManager` (stable prototype methods) — no delegation layer. |
| `viewModel.js` | Pure `buildCards(currentNoteId, noteBlocks)` — the assignment-card view model. |
| `HomeworkLab.jsx` | Page shell. Subscribes to the store via `useSyncExternalStore` inline, derives `activeNote` + `cards` (`buildCards`), and calls domain actions on `store.mgr` / `store.mgr.homeworkManager` directly. Shows `NoteListView` picker when no noteId; split-pane view (cards + drafting area) when one is selected. |
| `components/DraftingArea.tsx` | Thin orchestrator: derives blocks, wires the 5 hooks below, renders tabs + editor + footer. Reads `activeNote` only. |
| `hooks/useDraftEditor.ts` | Owns the Tiptap `useEditor` instance + extension config; wires onTransaction/onSelectionUpdate/handleDOMEvents to stable refs+setters from the other hooks. |
| `hooks/useDraftAutosave.ts` | Debounced draft autosave: owns the `SyncCoordinator` (created once), `scheduleAutosave`, context/submitDraft sync effects, unmount flush. Returns `coordinator`, `scheduleAutosaveRef`, `autosaveStatus`, `lastSavedTextRef`. |
| `hooks/useDraftContentLoader.ts` | The content-load effect (clobber guard + suppress flag + `reconcileHighlights` + context-switch flush). Owns `prevDepsRef`/`renderedFeedbackIdRef`. |
| `hooks/useDraftTooltip.ts` | Feedback-highlight tooltip interaction: hover/click handlers, `useFloating` positioning, hints toggle. Owns `getFeedbackMarkAt`. |
| `hooks/useDraftSelectionToolbar.ts` | Selection-toolbar state + wordlist add/move/create handlers (calls `useWordlist()`). |
| `components/FeedbackTooltip.tsx`, `components/QATab.tsx` | Presentational sub-components extracted from DraftingArea. |
| `components/AssignmentCard.jsx` | Assignment card in the feed (one per assignment block). |
| `components/SideNavBar.jsx` | Left sidebar with inquiries. |
| `components/TopNavBar.jsx` | Top bar with user info. |
| `HomeworkLab.css` | All homework styles (design tokens + components). |

## State Management Pattern

Domain/reactivity split (intentionally diverges from the notewindow `NoteListManager` + `NoteManager` pair, which still bakes `subscribe`/`notifyListeners` into the domain classes):

- **`HomeworkListManager` / `HomeworkManager`** — plain domain classes. Hold state, run operations, poke a single `onChange` callback after each mutation. `HomeworkListManager` propagates `HomeworkManager.onChange` upward, so one listener covers both levels. No `listeners` array, no `subscribe`, no `revision` counter.
- **`HomeworkListStore`** — the only React-facing piece. Owns the manager, caches one stable snapshot, and rebuilds it inside `#commit` (wired to `mgr.onChange`). Exposes `subscribe`/`getSnapshot` for `useSyncExternalStore`. No action delegation — consumers call `store.mgr` / `store.mgr.homeworkManager` directly.
- `App.jsx` creates the `HomeworkListStore` once via `useMemo`, wires `setNavigateCallback(navigate)`, calls `loadNotes()` on mount, and re-runs `setCurrentNoteFromPath(location.pathname)` on every route change — this is the single URL→manager sync (no per-component route effect).
- `HomeworkLab` subscribes inline via `useSyncExternalStore` and derives `activeNote`/`cards` from the snapshot (`cards` via the pure `buildCards`). `noteBlocks` is flattened up from `HomeworkManager` in `getState`, so no component reaches across class boundaries.
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

## Grammarly-style Inline Feedback (DraftingArea)

AI Check produces annotated segments (`vocab`, `suggestion`, `correct`, `plain`). These render as colored `<span>` highlights directly inside the contentEditable editor — same div, no separate view. Each highlight carries `data-*` attributes for tooltips and staleness tracking.

### Segment Rendering (useEffect)

```
on block deps change (activeNote.id, activeAssignmentId, draftBlock.id, feedbackBlock.id):
    if feedbackBlock.id is NEW (≠ renderedFeedbackIdRef):
        segmentsStaleRef ← false          // fresh AI Check — reset staleness
        renderedFeedbackIdRef ← feedbackBlock.id
    else if no feedbackBlock:
        segmentsStaleRef ← false          // switched assignment — clean slate
        renderedFeedbackIdRef ← null

    if segments.length > 0 AND NOT segmentsStaleRef:
        // Build DOM: one <span> per segment
        for each seg in segments:
            span ← createElement('span')
            span.className ← highlight class per seg.type
                "vocab"      → "hw-vocab-highlight"     (purple)
                "correct"    → "hw-highlight-correct"   (green)
                "suggestion" → "hw-highlight-suggestion" (red)
            span.textContent ← seg.text
            if seg.type IN {vocab, correct, suggestion}:
                span.dataset.type       ← seg.type
                span.dataset.original   ← seg.text       // snapshot at render time
                span.dataset.annotation ← seg.annotation  // correction / definition
                span.dataset.word       ← seg.word        // vocab word
                span.dataset.phonetic   ← seg.phonetic    // IPA
            container.appendChild(span)
        editor.innerHTML ← container.innerHTML
        clear tooltip

    else if draftBlock.content exists:
        editor.innerHTML ← draft text (\n → <br>)
    else:
        editor.innerHTML ← ""

    updateWordCount()
```

### Per-Span Staleness (onInput)

When the user types inside a highlight span, only **that span** loses its highlight. Others stay intact. This avoids the Grammarly problem where fixing one error removes only that underline.

```
on editor input:
    updateWordCount()

    highlights ← querySelectorAll('.hw-vocab-highlight, .hw-highlight-correct, .hw-highlight-suggestion')
    changed ← false
    for each span in highlights:
        if span.textContent ≠ span.dataset.original:
            // User edited this span — strip styling but KEEP the DOM node
            // (replaceWith kills the cursor; stripping class keeps cursor in place)
            span.className ← ""                  // remove highlight color
            delete span.dataset.type              // remove all data attrs
            delete span.dataset.original
            delete span.dataset.annotation
            delete span.dataset.word
            delete span.dataset.phonetic
            changed ← true

    if changed:
        segmentsStaleRef ← true    // prevent useEffect from re-applying old segments
        clear tooltip
```

### Stale Span Cleanup (onBlur)

Class-less `<span>` elements from stripped highlights are DOM clutter. Clean them up on blur (not on input — that would cause cursor jumps via `replaceWith`):

```
on editor blur:
    staleSpans ← querySelectorAll('span:not([class])')
    for each span in staleSpans:
        textNode ← createTextNode(span.textContent)
        span.parentNode.replaceWith(textNode, span)
    editor.normalize()    // merge adjacent text nodes
```

### Tooltip Interaction

```
on mouseover highlight span:
    clearTimeout(hideTimer)
    show tooltip anchored below span
    tooltip data ← { type, annotation, word, phonetic } from span.dataset

on mouseout highlight span:
    hideTimer ← setTimeout(200ms, → hide tooltip if same anchor)   // delay allows mouse→tooltip travel

on click highlight span:
    toggle tooltip (show if hidden, hide if same anchor)
on click outside highlight:
    hide tooltip
```

### Highlight Reconciliation on Reload

After a page reload, `segmentsStaleRef` resets to `false` (refs don't persist). The segments text may differ from the draft text (user edited and submitted). Instead of re-applying all highlights or dropping all of them, we **reconcile** — preserve highlights whose text is unchanged, drop highlights whose surrounding context was edited.

Algorithm (`reconcileHighlights.js`):

```
function reconcileHighlights(segments, draftText):
    originalText ← concatenate all segment.text
    
    if originalText === draftText:
        return segments as-is (all highlights fresh)
    
    // Build position map via LCS diff
    posMap ← buildPositionMap(originalText, draftText)
    // posMap: original position → draft position (only for "equal" chars)
    
    for each highlight segment:
        segStart ← sum of preceding segment lengths
        segEnd ← segStart + segment.text.length
        
        // Check if ALL characters in this segment map to contiguous draft positions
        allKept ← true
        draftStart ← -1
        for pos from segStart to segEnd:
            if pos not in posMap:
                allKept ← false    // character was deleted/changed
                break
            if draftStart == -1:
                draftStart ← posMap[pos]
            else if posMap[pos] ≠ posMap[pos-1] + 1:
                allKept ← false    // not contiguous — characters rearranged
                break
        
        // Verify draft text matches segment text at the mapped position
        if allKept AND draftText[draftStart : draftStart + segment.text.length] === segment.text:
            preserved ← { draftStart, draftEnd, segment }
        else:
            // Highlight is stale — skip it
    
    // Build render chunks from draft text, inserting preserved highlights
    for each preserved highlight (sorted by draftStart):
        emit plain text before highlight
        emit highlight span with data attributes
    emit remaining plain text
    
    return chunks
```

Example — original: `"Si mañana va llover, nosotros quedamos en casa"`, draft: `"Si mañana va a llover, nosotros quedamos en casa"`:

```
LCS diff maps "va" at original position 10 to draft position 10,
but the next chars don't match (" " vs " a") → "va" highlight is STALE.
"quedamos" at original position 30 maps contiguously to draft position 32 → PRESERVED.

Result: "Si mañana va a llover, nosotros [quedamos] en casa"
                                             ^highlighted
```

### Staleness Lifecycle

```
segmentsStaleRef tracks in-session edits (ref resets on reload):

  AI Check runs        → feedbackBlock.id changes → segmentsStaleRef = false  (fresh)
  User edits highlight → span.textContent ≠ data-original   → segmentsStaleRef = true   (stale)
  Submit after edits   → autosave fires, refresh re-runs the content-load effect; segmentsStaleRef=true → renders draft, NOT segments
  Re-run AI Check      → feedbackBlock.id changes → segmentsStaleRef = false  (fresh)
  Switch assignment    → no feedbackBlock          → segmentsStaleRef = false  (clean slate)
  Page reload          → segmentsStaleRef = false, BUT segmentsText ≠ draftText
                       → reconciliation runs: preserved highlights kept, stale ones dropped
```

### Tooltip Types

| Type | Label | Accent | Body Content |
|---|---|---|---|
| `suggestion` | ✏️ Suggestion | `--hw-error` (red) | `annotation` (correction + explanation) |
| `vocab` | 📖 Vocabulary | `--hw-primary` (purple) | `word` (bold) + `phonetic` (italic) + `annotation` (definition) |
| `correct` | ✅ Correct | `--hw-secondary` (green) | `annotation` (praise) |

## Layout Constraints

- Page must not scroll vertically (`document.scrollingElement.scrollHeight === clientHeight`)
- All scroll happens inside nested flex containers with `overflow-y: auto`
- Tab content wrappers must use `display: flex; flex-direction: column; flex: 1; min-height: 0` to prevent overflow clipping
- `.hw-page` and `.hw-content-wrapper` use `height: 100%` (not `100vh`) to respect parent constraints