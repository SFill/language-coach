# 2026-06-06 — Homework Eval Bugfixes & Grammarly-style Inline Feedback

## What was done

1. **`\n` not rendering** — Assignment prompt and draft area showed literal `\n` instead of line breaks. Fixed by replacing `white-space: pre-line` CSS with `MarkdownContent` component (uses `remark-gfm` + `remark-breaks`), which correctly renders newlines and markdown. Added `.replace(/\n{3,}/g, '\n\n')` to collapse excessive newlines before display.

2. **AI Check highlights not rendering** — `feedbackBlock` was looked up with `assignment_ref === assignmentId` only, but the backend stores `assignment_ref = draftBlock.id`. Fixed by matching both: `b.assignment_ref === assignmentId || b.assignment_ref === draftBlock?.id`. Also reversed segment priority from `draft > segments` to `segments > draft` so feedback highlights actually display.

3. **Ollama returning only "plain" segments** — Ollama wraps JSON responses in markdown code fences (`` ```json ... ``` ``). Added fence-stripping logic in `_parse_segments`: detects leading `` ``` ``, strips it and the trailing `` ``` ``, then parses the inner JSON.

4. **Duplicate feedback blocks on each AI Check** — Each `analyze_draft` call created a new `ai_feedback` block without removing the old one. Added filtering before creating the new block: `content = [b for b in content if not (b.get('block_type') == 'ai_feedback' and b.get('assignment_ref') == block_id)]`.

5. **Grammarly-style inline feedback highlights** — Replaced the separate "annotate/edit" view with inline highlights directly in the contentEditable editor. Three highlight types (`vocab`, `suggestion`, `correct`) render as colored `<span>` elements inside the editor. Each span carries `data-*` attributes (`data-type`, `data-original`, `data-annotation`, `data-word`, `data-phonetic`) for tooltip display and staleness detection.

6. **Feedback tooltips** — Added `FeedbackTooltip` component that appears on hover/click over highlight spans. Positioned absolutely relative to the editor container using `getBoundingClientRect()`. Shows type-specific content:
   - **Suggestion**: correction + explanation (red accent)
   - **Vocabulary**: word + IPA + definition (purple accent)
   - **Correct**: praise message (green accent)
   - 200ms hide delay on mouseout to allow mouse travel to tooltip; click toggles on/off for mobile.

7. **Per-span staleness detection** — When the user types inside a highlight span, only that specific span is unwrapped (CSS class and data attributes removed, DOM node preserved). Uses `span.textContent !== span.dataset.original` comparison. Unchanged spans remain highlighted. This is the Grammarly model: fix one error, that underline disappears, others stay.

8. **Cursor-jump fix** — Initial per-span staleness used `replaceWith(textNode)` which destroyed the cursor's DOM node. Changed to strip `className` and `data-*` attributes while keeping the `<span>` element intact. Stale spans are cleaned up to text nodes on `onBlur` (avoids cursor jumps during typing).

9. **Segment staleness tracking** — Added `segmentsStaleRef` and `renderedFeedbackIdRef` refs to prevent stale feedback from being re-applied after user edits. When the user edits inside a highlight, `segmentsStaleRef` is set to `true`. The `useEffect` that sets editor content checks this flag: if stale, it renders the draft content (plain text) instead of segments. Staleness resets when a new AI Check produces fresh segments (`feedbackBlock.id` changes) or when switching to an assignment with no feedback block.

13. **Highlight reconciliation on page reload** — After a page reload, `segmentsStaleRef` resets to `false` (refs don't persist). If the user edited text and submitted before reloading, the segments text no longer matches the draft text. Instead of re-applying all highlights (which would overwrite edits) or dropping all highlights (losing unchanged ones), the `reconcileHighlights` utility uses LCS-based diff to determine which highlights are still valid. For each highlight segment, it checks whether the segment's characters map to contiguous unchanged positions in the draft text. Preserved highlights are rendered at their draft positions; stale highlights (whose text or context was edited) become plain text. This means: edit `"va"` → `"va a"`, submit, reload → `"va a"` appears as plain text, `"quedamos"` highlight is preserved.

10. **Heading-based segment splitting** — `parseClipboardHTML` in `importPaste.js` now flushes text at H1–H6 boundaries, treating headings as segment delimiters. Headings themselves are collected as the start of the next segment.

11. **Image drag-and-drop** — `ImportWorkspace.jsx` now accepts image files via drag-and-drop, reads them as data URLs, and creates `{ type: 'image', content: '', src }` segments.

12. **`json_schema` response format reverted** — Attempted to use `json_schema` response format with Ollama, but it's not supported. Reverted to `json_object` with fence-stripping as the robust fallback.

## Files changed

| File | Changes |
|---|---|
| `src/frontend/homework/components/DraftingArea.jsx` | Added `FeedbackTooltip` component, tooltip state/handlers (hover, click, mouseout), `segmentsStaleRef`/`renderedFeedbackIdRef` staleness tracking, per-span staleness in `handleEditorInput` (strip class/data instead of replaceWith), `handleEditorBlur` cleanup, `MarkdownContent` for prompt/Q&A rendering, `feedbackBlock` lookup with `assignmentId OR draftBlock.id`, highlight reconciliation via `reconcileHighlights` when segments text differs from draft text |
| `src/frontend/homework/HomeworkLab.css` | Added `.hw-feedback-tooltip*` styles (position, border accents per type, fade-in animation, label/body/phonetic), removed `white-space: pre-line` from prompt/Q&A selectors |
| `src/frontend/homework/utils/importPaste.js` | Heading-based segment splitting (H1–H6 flush textBuffer), removed headings from `blockTags` list |
| `src/frontend/homework/components/ImportWorkspace.jsx` | Image file drag-and-drop handler (reads as data URL, creates image segment) |
| `src/backend/services/assignment_service.py` | Markdown fence stripping in `_parse_segments`, duplicate `ai_feedback` block removal, `None` fallback for `word`/`phonetic`/`annotation` fields |
| `src/frontend/homework/utils/reconcileHighlights.js` | LCS-based diff reconciliation: compares segments text vs draft text, builds position map of unchanged characters, preserves highlights whose character ranges map contiguously to the draft, drops highlights whose context was edited |

## Verification

1. AI Check produces colored highlights inline in the editor ✓
2. Tooltips show on hover/click with type-specific content ✓
3. Editing inside a highlight span unwraps only that span ✓
4. Editing outside highlights leaves them untouched ✓
5. Submit after editing preserves user edits (stale segments not re-applied) ✓
6. Re-running AI Check resets staleness and shows fresh highlights ✓
7. Switching assignments resets staleness ✓
8. No cursor jumps when editing inside highlight spans ✓
9. No console errors ✓
10. Page reload after edit+submit: edited highlight dropped, unchanged highlights preserved ✓
    - Edited `"iremos"` → `"vamos"`: `"iremos"` highlight NOT re-applied, `"vamos"` appears as plain text ✓
    - Unchanged `"hace"` highlight: preserved after reload ✓
    - Full text matches submitted draft (user's edit preserved) ✓

## Open issues

_(none)_