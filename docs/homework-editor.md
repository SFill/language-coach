# Homework Draft Editor — Components, Approach & Features

This document describes the homework draft editor (`/homework/:noteId` → `DraftingArea`): the components it's built from, the overall approach, and each feature with a short design description ("one feature, one design description").

## Overall approach

The draft editor is a **Tiptap v3** (ProseMirror) rich-text surface that is intentionally **plain-text only** — formatting is not persisted. It replaces an earlier hand-rolled `contentEditable` div with manual `innerHTML` rendering, a custom snapshot undo stack, and Range-based paste handling. Tiptap gives us a real document model, native transaction-based undo/redo, marks for inline feedback, a BubbleMenu for the selection toolbar, and Floating UI for the tooltip.

Key invariants:

- **Backend contract is unchanged.** Drafts are stored and submitted as plain text with `\n` line breaks. AI-feedback blocks are a `List[dict]` of segments `{ text, type, annotation?, word?, phonetic? }` whose concatenated `text` reproduces the draft exactly. Tiptap serializes to / from this via helpers in `utils/draftDoc.js`.
- **No formatting is carried.** `StarterKit` is configured with bold/italic/lists/headings/etc. disabled; only `Paragraph`, `Text`, `HardBreak`, and `UndoRedo` remain. Pasted content is stripped to plain text.
- **The editor is the source of truth while editing.** Highlight spans are ProseMirror marks, not DOM we mutate; ProseMirror owns the DOM.
- **Loading content is not undoable.** When the note/assignment changes, content is loaded with a fresh `EditorState` so the undo history is reset.

### Architecture at a glance

```
HomeworkLab (page shell)
└── DraftingArea
    ├── useEditor (Tiptap)
    │   ├── StarterKit (formatting disabled, UndoRedo depth=100, newGroupDelay=500)
    │   ├── FeedbackMark          (inline highlight marks)
    │   ├── FeedbackStaleness     (appendTransaction: strip edited marks)
    │   └── PlainTextPaste        (handlePaste: plain text only)
    ├── EditorContent             (the editable surface)
    ├── BubbleMenu + HomeworkToolbar   (selection toolbar)
    └── FeedbackTooltip (portaled)     (hover/click tooltip)
```

State is held outside React by singleton managers (`HomeworkListManager`, `HomeworkManager`) and bridged via `useHomeworkLab` (`useSyncExternalStore`); `DraftingArea` receives an `activeNote` and action callbacks (`submitDraft`, `runAICheck`, `sendQuestion`).

## Components

| Component / File | Purpose |
|---|---|
| `homework/components/DraftingArea.jsx` | The editor view. Owns the Tiptap `useEditor`, the BubbleMenu, the floating tooltip, tabs (Assignment / AI Q&A), word count, hints toggle, and Submit / AI Check actions. Derives the assignment / draft / feedback blocks from `activeNote`. |
| `homework/extensions/FeedbackMark.js` | Custom Tiptap **mark** `feedback` with attrs `{ type, original, annotation, word, phonetic }`. Renders the existing `hw-vocab-highlight` / `hw-highlight-correct` / `hw-highlight-suggestion` classes + `data-*` attributes. `inclusive: false`, `clearable: false`. |
| `homework/extensions/FeedbackStaleness.js` | ProseMirror `appendTransaction` plugin. After any doc change, removes a `feedback` mark whose covered text no longer equals its `original` attr — per-mark, others stay. Calls `onStale` so a stale flag is set. |
| `homework/extensions/PlainTextPaste.js` | ProseMirror `handlePaste` plugin. Reads `text/plain` (falls back to stripping `text/html`), builds one paragraph per line preserving blank lines, and dispatches it as a transaction (so it's undoable). |
| `homework/utils/draftDoc.js` | Conversion helpers: `plainTextToDocJSON`, `chunksToDocJSON`, `docToPlainText`, `sentenceAtPos`, `loadEditorContent` (load without polluting undo via a fresh `EditorState`), `countWords`. |
| `homework/utils/reconcileHighlights.js` | LCS-based reconciler. Given segments + edited draft text, returns render chunks preserving highlights whose text/context is unchanged and dropping stale ones. (Pre-existing; unchanged by the Tiptap migration.) |
| `homework/components/HomeworkToolbar.jsx` | The floating selection toolbar body: add-to-list / move-between-lists button, wordlist dropdown with exact/close match badges, "Create new list". Rendered inside the BubbleMenu. (A dictionary-lookup button was previously a `console.log` stub — dead UI — and has been removed; wire it to the dictionary endpoint if/when it's needed.) |
| `homework/components/TopNavBar.jsx` | App-wide top bar: nav links (New note / My words / Homework), language picker, level badge, notifications/help/avatar. Contains the only conditional heading (`<h3>` note name). |
| `homework/HomeworkLab.jsx` | Page shell: shows the assignment card feed + `DraftingArea` split-pane, or `ImportWorkspace` / `NoteListView` when no note is selected. |
| `homework/HomeworkManager.js` / `HomeworkListManager.js` | Singleton state owners per note / for the note list. `submitDraft`, `runAICheck`, `sendQuestion`, list/route sync. |
| `homework/hooks/useHomeworkLab.js` | React adapter over the managers via `useSyncExternalStore`. |
| `notewindow/components/MarkdownContent.jsx` | Read-only markdown renderer (react-markdown + remark-gfm/reaks). Used for the assignment prompt and Q&A answers (not the editor). |

## Features (one feature, one design description)

### 1. Plain-text editing
**Design:** Tiptap `StarterKit` with all formatting extensions disabled (`bold`, `italic`, `strike`, `code`, `underline`, `heading`, `bulletList`, `orderedList`, `listItem`, `blockquote`, `horizontalRule`, `link`, `listKeymap`, `trailingNode` all `false`). The schema is `doc > paragraph > text` with `HardBreak` for soft line breaks. The editable element gets `class="hw-editor-content"` via `editorProps.attributes` so the existing CSS applies; `.ProseMirror { outline: none }` is added.

### 2. Undo / redo
**Design:** Tiptap's `UndoRedo` extension (in StarterKit) with `depth: 100` and `newGroupDelay: 500`. Every mutation — typing, paste, mark stripping — is a ProseMirror transaction, so it's on the history stack. Typing bursts collapse into one undo entry via the 500ms group delay. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) are handled by Tiptap's keymaps. This replaces the earlier custom snapshot stack entirely.

### 3. Plain-text paste (and Ctrl+Z after paste)
**Design:** `PlainTextPaste` adds a ProseMirror `handlePaste` plugin. It reads `event.clipboardData.getData('text/plain')`; if absent, it reads `text/html` and strips it via a temp element's `textContent`. It splits the text on `\n`, creates one `paragraph` node per line (empty line → empty paragraph, preserving blank lines), wraps them in a `Slice`, and `replaceSelection`s it via a dispatched transaction. Because it's a transaction, **Ctrl+Z undoes the paste**. Returning `true` suppresses ProseMirror's default HTML-parsing paste.

### 4. AI-feedback highlights
**Design:** Segments from the `ai_feedback` block become a single `feedback` **mark** on the covered text, with attributes `{ type, original, annotation, word, phonetic }`. `renderHTML` emits `<span class="hw-vocab-highlight | hw-highlight-correct | hw-highlight-suggestion" data-type data-original data-annotation? data-word? data-phonetic? data-feedback>`. `parseHTML` matches `span[data-feedback]`. `inclusive: false` (typing at a boundary doesn't extend the mark), `exitable: true`, `clearable: false`. The doc is built from segments by `chunksToDocJSON` and loaded with `setContent` + a fresh `EditorState` (no history entry).

### 5. Per-mark staleness (edit a highlight → strip only it)
**Design:** `FeedbackStaleness` is an `appendTransaction` plugin. After any doc-changing transaction, it walks the doc; for each text node carrying a `feedback` mark whose `node.text !== mark.attrs.original`, it `removeMark`s over that range. Only the edited mark is removed — others stay. It also calls an `onStale` callback to set a stale flag so a later re-render doesn't re-apply old segments. This replaces the old `handleEditorInput` staleness loop and the blur cleanup of class-less spans.

### 6. Highlight reconciliation on reload
**Design:** After a reload, refs reset, so `segmentsStaleRef` is `false` but the draft text may differ from the segments (user edited and submitted). `reconcileHighlights(segments, draftText)` does an LCS char-diff and returns chunks preserving highlights whose text maps contiguously to the draft and dropping ones whose context shifted. `chunksToDocJSON` converts those chunks to a ProseMirror doc (plain chunks → text, highlight chunks → text with a `feedback` mark). Net: unchanged highlights survive, stale ones don't.

### 7. Hover / click feedback tooltip (no scroll clipping)
**Design:** `editorProps.handleDOMEvents` `mouseover`/`mouseout`/`click` find the closest `[data-feedback]` span, resolve it with `view.posAtDOM(target, 0)` → `doc.resolve(pos).marks()` to read the `feedback` mark attrs, and set React tooltip state. The tooltip is rendered through `createPortal(..., document.body)` and positioned with `@floating-ui/react` (`placement: bottom`, `offset(6)`, `flip`, `shift`, `strategy: 'fixed'`, `autoUpdate`). Because it's portaled to `<body>` with fixed positioning, the `.hw-editor` scroll container cannot clip it — fixing the earlier "tooltip hidden when scrolled" bug. A 200ms hide timer lets the mouse travel to the tooltip; a `hintsEnabled` toggle gates show/hide.

### 8. Selection toolbar (BubbleMenu)
**Design:** `BubbleMenu` from `@tiptap/react/menus` wraps `HomeworkToolbar`, with `shouldShow = ({ state }) => !empty && from !== to`. Tiptap's Floating UI positions it at the selection; it preserves the selection on mousedown inside so toolbar buttons work. `onSelectionUpdate` derives `hwSelectedText` (`doc.textBetween(from, to, '\n')`) and `hwSelectedSentence` (`sentenceAtPos`, the sentence within the selection's textblock). The toolbar's add/move/create-list actions call `useWordlist` (`addWordToList`, `moveWordBetweenLists`, `createNewListWithWord`) with that sentence as context.

### 9. Word count
**Design:** `onTransaction` fires on every transaction; when `transaction.docChanged`, it recomputes `countWords(editor.getText())` (trim + split on whitespace) and sets state. The footer shows `Word count: N [/ target]`, where target comes from `assignmentBlock.metadata_.targetLength`. (v3's `shouldRerenderOnTransaction` is off by default, so this is how the count stays live.)

### 10. Tab persistence (Assignment ⇄ AI Q&A)
**Design:** Both tabs are always mounted; the inactive one is hidden with `display: none` (not conditionally rendered), so the Tiptap editor instance and its state survive tab switches. Verified by `drafting.spec.ts`.

### 11. Submit / AI Check / Q&A
**Design:** `handleSubmit` and `handleAICheck` read `docToPlainText(editor.state.doc)` (paragraph boundaries and hard breaks → `\n`) and call `submitDraft(noteId, text, blockId?, assignmentId)` / `runAICheck(noteId, blockId)`. If no draft block exists yet, AI Check auto-saves the current text first. `handleSendQuestion` calls `sendQuestion(noteId, question, assignmentId)`. Only plain text is ever sent to the backend.

### 12. Page heading (accessibility)
**Design:** `App.jsx` renders a visually-hidden `<h1 className="visually-hidden">Language Coach</h1>` so every page has a page-level heading for screen readers (the top bar's `<h3>` only appears when a note is open). No visual change; satisfies the heading-hierarchy a11y check.

## Verification

- `npm run test:all` — 61 Playwright tests, including `highlight-reconciliation`, `selection-toolbar`, `drafting` (tab persistence, scroll, paste, undo), `accessibility`, `visual`, `layout`, `console`.
- Manual/Playwright MCP on `/homework/:noteId`: typing, Ctrl+Z/Y, rich-HTML paste (stripped + undoable), in-mark edit strips only that highlight, boundary edit keeps the highlight, hover tooltip visible after scroll, BubbleMenu dropdown, tab persistence — all green, zero console errors.