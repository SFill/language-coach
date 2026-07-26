# Assignment Analysis Taxonomy + Manual Vocab Marking

Date: 2026-07-12
Status: Draft (prompt already updated; UI work pending)

## Problem

`ASSIGNMENT_ANALYSIS_PROMPT` produces four segment types — `plain`, `vocab`,
`correct`, `suggestion` — and three of them are wrong for the workflow:

1. **`correct` is noise.** It praises correct phrases; in a fill-in / transformation
   exercise most of the draft is correct by construction, so `correct` fires on
   nearly everything or gets sprinkled randomly. Praise with no teaching value.
2. **`vocab` is word-shaped and too random.** It requires `word` + `phonetic` (IPA) +
   `annotation` (English definition) — a shape that only fits a single content word.
   So the model grabs arbitrary nouns instead of the meaningful unit (a pronoun, a
   collocation, a structure). There is no way to tag a phrase/collocation.
3. **No grammar/structure tag.** The actual lesson in a grammar exercise is the
   function word / structure (pronouns, verb endings, ser/estar, prepositions).
   These don't fit `vocab` (no "definition") and `correct` (just praise), so the
   most important annotation has no home.

Decision (lead, 2026-07-12): vocab is **not** the AI's job. The teacher marks vocab
words manually in the UI; the AI only emits `grammar` + `suggestion` (+ `plain`).

## Target Taxonomy

| Type | Source | Purpose | Fields used |
|---|---|---|---|
| `plain` | AI | unannotated text | `text` |
| `grammar` | AI | the structure being practiced (pronoun, verb form, preposition, agreement) | `text`, `annotation` (rule + why it applies here) |
| `suggestion` | AI | an error / awkward phrasing | `text`, `annotation` (corrected version + brief explanation) |
| `vocab` | **manual (teacher)** | a word/phrase worth a gloss | `text`, `word`, `phonetic` (optional), `annotation` (gloss) |
| ~~`correct`~~ | — | **removed** | — |

Colors: `grammar` = blue/teel (new), `vocab` = purple (existing), `suggestion` = red
(existing). Green goes away with `correct`.

## Work Breakdown

### 1. Backend — prompt + model (DONE in this change)

- `src/backend/services/assignment_service.py` `ASSIGNMENT_ANALYSIS_PROMPT`:
  - Types are now `plain`, `grammar`, `suggestion` only.
  - Added rule: "Do NOT tag vocabulary words — vocab highlights are added manually
    by the teacher."
  - Added `grammar` type with annotation = rule + application.
  - Replaced the single toy example with several real-use-case examples:
    pronoun (grammar), pronoun gender (suggestion), pronoun number (suggestion),
    ser/estar accent (suggestion), preterite tense (suggestion).
- `src/backend/models/note.py` `DraftSegment.type` comment: updated to list
  `plain`, `grammar`, `suggestion` (AI) and `vocab` (manual). `correct` removed.

### 2. Frontend — type plumbing (DONE)

- `src/frontend/homework/extensions/FeedbackMark.js` `CLASS_BY_TYPE`:
  add `grammar: 'hw-grammar-highlight'`; drop `correct`. Change the unknown-type
  fallback from `correct` to `plain` (render as a plain span, no highlight) so an
  unexpected type no longer silently turns green.
- `src/frontend/homework/components/FeedbackTooltip.tsx` `typeConfig`:
  add `grammar` entry (label `📐 Grammar`, its own accent class); drop `correct`.
  Add a body branch rendering `data.annotation` for `grammar`. Change the fallback
  from `typeConfig.correct` to a safe default (no tooltip body).
- `src/frontend/homework/HomeworkLab.css`: add `.hw-grammar-highlight` and
  `.hw-feedback-tooltip--grammar` (blue/teal accent). Remove
  `.hw-highlight-correct` and `.hw-feedback-tooltip--correct` rules.

### 3. Frontend — staleness / reconciliation selectors (DONE — no change needed)

The render path uses Tiptap `feedback` marks, not hand-rolled class selectors, so
the staleness/reconciliation code is type-agnostic:

- `FeedbackStaleness.js` keys on mark name `feedback` (not class) — strips any
  feedback mark whose text no longer matches `original`. `grammar` marks are
  handled automatically.
- `reconcileHighlights.js` treats any `seg.type !== 'plain'` as a highlight —
  `grammar` is preserved/stripped automatically.
- `draftDoc.js` `chunksToDocJSON` carries `chunk.type` into the mark attrs; the
  class is assigned in `FeedbackMark.renderHTML` via `CLASS_BY_TYPE` (updated in
  item 2).

(The `homework/CLAUDE.md` "Segment Rendering" / onInput sections describe an older
hand-rolled DOM approach and are stale — covered by the item 5 doc cleanup.)

### 4. Manual vocab marking UI (PENDING — the main new feature)

Teacher selects a word/phrase in the **student draft** and marks it vocab; it
renders as a vocab highlight with the existing vocab tooltip (word + IPA + gloss).

Open decisions to confirm with lead:

- **Persistence.** Recommend a dedicated `block_type="vocab_mark"` block linked to
  the draft (`assignment_ref = draftBlock.id`), `content` = a list of segment-shaped
  entries `{ text, word, phonetic, annotation }`. Consistent with the block-per-thing
  model and lets `useDraftContentLoader` merge it with AI feedback during render.
  Alternative: a `manual_marks` field on the ai_feedback block. Prefer the dedicated
  block (AI feedback gets regenerated by AI Check; manual marks must survive that).
- **Vocab metadata source.** Auto-fetch gloss + IPA via the existing
  `phrase_service` / dictionary service (same path the wordlist uses), with the
  teacher able to edit before saving. Confirm.
- **Scope.** Marks live on the draft (per-student), matching the current per-draft
  feedback model. Confirm we do NOT want marks on the assignment (shared across
  students).
- **Overlap with AI segments.** A vocab-marked span will normally fall inside an
  AI `plain` segment; the loader splits that `plain` segment at the vocab boundary
  and inserts the vocab highlight. If a vocab mark ever overlaps an AI `grammar`/
  `suggestion` highlight, vocab wins (the teacher's manual choice overrides). Confirm.

Implementation touch points:

- `hooks/useDraftSelectionToolbar.ts` — add a "Mark as vocab" action to the
  selection toolbar (reuses the existing selection-toolbar infra + `useWordlist`
  patterns). On click: capture selected text + position, fetch gloss/IPA, POST
  the vocab mark, trigger a content reload.
- New API call + backend endpoint to create/delete a `vocab_mark` block (or reuse
  the existing block-creation endpoint if it accepts a new `block_type`).
- `hooks/useDraftContentLoader.ts` — merge `vocab_mark` segments into the chunk list
  before `chunksToDocJSON`. This is the trickiest piece: split AI `plain` segments at
  vocab-mark boundaries and insert vocab highlights; reuse the LCS approach already
  in `reconcileHighlights` where possible.
- Deletion: a way to remove a vocab mark (e.g. click the vocab highlight → tooltip
  shows a "remove" action), deleting the entry and re-rendering.

### 5. Cleanup (PENDING)

- Remove every `correct` reference: `FeedbackMark.js`, `FeedbackTooltip.tsx`,
  `HomeworkLab.css`, the staleness selectors, the model comment, the prompt.
- Update `src/frontend/homework/CLAUDE.md` — the "Segment Rendering" section and the
  "Tooltip Types" table: replace `correct` with `grammar`, document manual vocab.

## Done so far (this change)

- Prompt rewritten (`grammar` + real-UC `suggestion` examples; `vocab`/`correct`
  removed from AI output).
- `DraftSegment.type` comment updated.
- Frontend type plumbing: `FeedbackMark` (`grammar` class, `correct` removed,
  `plain` default + no-class fallback), `FeedbackTooltip` (`grammar` tooltip +
  body, `correct` removed, `suggestion` fallback), CSS (`--hw-grammar` token +
  `.hw-grammar-highlight` + `.hw-feedback-tooltip--grammar`; `correct` rules
  removed). Confirmed staleness/reconciliation need no change (type-agnostic).
  `tsc --noEmit` clean.

## Not done (next sessions)

- Items 4–5 above. The manual vocab marking UI (item 4) is the bulk of the work and
  needs the open-decision confirmations before implementation.