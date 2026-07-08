# Playwright Tests — Agent Reference

## Setup

- **Config**: `playwright.config.ts` — chromium only, 1920×1280 viewport, 2% screenshot diff tolerance
- **Dev server**: auto-started on port 5173 (Vite); backend must already run on port 8000
- **Run**: `npx playwright test` (all), `npx playwright test <file>` (single), `-g "pattern"` (filter)

## Test Files

| File | Purpose | Data Source |
|---|---|---|
| `fixtures.ts` | Shared fixture: creates/destroys homework notes via backend API | API |
| `drafting.spec.ts` | Tab switching, scroll containment, flex layout checks | `homeworkNote` fixture |
| `layout.spec.ts` | No overflow, sidebar visible, main content renders | Hardcoded routes |
| `accessibility.spec.ts` | axe-core violations, heading hierarchy, alt text | Hardcoded routes |
| `console.spec.ts` | Console error detection (filtered) | Hardcoded routes |
| `visual.spec.ts` | Screenshot regression comparison | Hardcoded routes |
| `highlight-reconciliation.spec.ts` | Grammarly-style highlights: rendering, per-span staleness, reconciliation after reload | API + route mock |

## Fixture System (`fixtures.ts`)

The `homeworkNote` fixture follows a **create → use → destroy** pattern via the backend API.

### What It Creates

A single Note with:
- 1 assignment block (`block_type: "assignment"`)
- 1 student draft (`block_type: "simple_note"`, linked via `assignment_ref`)
- 6 Q&A pairs (`block_type: "question"`, with long multi-paragraph answers for scroll testing)

### How It Works

1. `POST /api/coach/notes/` → creates note, captures `noteId` immediately via `onNoteCreated` callback
2. `POST /notes/{id}/block` → adds assignment block
3. `POST /notes/{id}/block` → adds draft block with `assignment_ref`
4. `POST /notes/{id}/block?test_mode=true` → adds question blocks (skips OpenAI call)
5. `GET /notes/{id}` → re-fetches full note with all blocks
6. After test: `DELETE /notes/{id}` in `finally` block (guaranteed cleanup)

### Cleanup Guarantee

- `noteId` is captured **immediately** after `POST /notes/` via `onNoteCreated` callback
- If block creation fails mid-way, the `finally` block still deletes the note
- `deleteNote().catch(() => {})` swallows cleanup errors to avoid masking the real test error

### Test Mode (`test_mode=true`)

Adding `?test_mode=true` to `POST /notes/{id}/block` skips the OpenAI call. The block is persisted as-is with the content from the request body. Used for creating question blocks in fixtures so tests don't depend on an AI API being available.

### Usage

```ts
import { test, expect } from './fixtures';

test('my test', async ({ page, homeworkNote }) => {
  await page.goto(`/homework/${homeworkNote.id}`);
  // homeworkNote.id, homeworkNote.note_blocks available
});
```

### Extending

To add a new fixture variant, extend `base.extend<>()` in `fixtures.ts`:

```ts
export const test = base.extend<{
  homeworkNote: CreatedNote;
  sparseHomeworkNote: CreatedNote;  // e.g. no Q&A blocks
}>({
  homeworkNote: { ... },
  sparseHomeworkNote: async ({}, use) => {
    const note = await createHomeworkNote({ name: 'sparse', assignments: [...] });
    // ...
  },
});
```

## Test Patterns

### Editor Tests

The fixture creates a note with pre-existing draft content. Tests that type into the editor must clear it first:

```ts
await editor.click();
await page.keyboard.press('Control+a');
await page.keyboard.press('Backspace');
await page.keyboard.type('Hello world');
```

### Viewport Containment Checks

Assert that an element stays within the viewport (catches the `height: 100vh` overflow bug):

```ts
const withinViewport = await el.evaluate((el) => {
  const rect = el.getBoundingClientRect();
  return Math.round(rect.bottom) <= window.innerHeight;
});
expect(withinViewport).toBe(true);
```

### Scroll Checks

Assert that a scroll container is scrollable and content doesn't clip:

```ts
const isScrollable = await list.evaluate((el) => el.scrollHeight > el.clientHeight);
expect(isScrollable).toBe(true);
await list.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
```

### Flex Layout Checks

Assert the flex column pattern that prevents overflow clipping:

```ts
const cs = getComputedStyle(wrapper);
expect(cs.display).toBe('flex');
expect(cs.flexDirection).toBe('column');
expect(cs.flex).toContain('1');
expect(cs.minHeight).toBe('0px');
```

### Autosave (debounced draft sync)

The Submit button was replaced by a 5s debounced autosave (`SyncCoordinator`).
Tests must NOT wait out the 5s debounce in real time — drive it with Playwright's
fake clock instead. Install + pause BEFORE the edit (so the autosave `setTimeout`
is faked, not native), then `fastForward` to fire it. `fetch`/promises are not
faked, so the PATCH still goes out and `waitForRequest` catches it.

```ts
await page.clock.install();
await page.clock.pauseAt(Date.now());
// ...type/edit (schedules the debounced autosave under the fake clock)...
const patchPromise = page.waitForRequest(
  (req) => req.method() === 'PATCH' && /\/api\/coach\/notes\/<id>\/block\//.test(req.url()),
  { timeout: 10000 },
);
await page.clock.fastForward(5000);   // fire the debounce now
await patchPromise;
await expect(page.locator('.hw-toolbar-autosave')).toContainText('Saved');
// resume() before any real-time step like page.reload()
await page.clock.resume();
```

Switching assignments also flushes the pending edit immediately (the coordinator's
flush-on-context-switch), so multi-assignment tests can `waitForRequest` around a
card switch instead of using the clock.

## Highlight Reconciliation Tests (`highlight-reconciliation.spec.ts`)

Tests the Grammarly-style inline feedback feature — highlight rendering, per-span staleness, and LCS-based diff reconciliation after page reload.

### Route Mocking

Since the standard API can't create `ai_feedback` blocks with list content (the `block` field is a string), the test uses Playwright's `page.route()` to intercept `GET /notes/{id}` and inject a synthetic `ai_feedback` block with predefined segments. This simulates a completed AI Check without requiring an AI backend.

```ts
function injectFeedbackRoute(page, noteId, assignmentId, draftBlockId, segments) {
  page.route('**/api/coach/notes/**', async (route) => {
    // Only intercept GET for our note — pass through PATCH/POST
    if (method !== 'GET' || !url matches noteId) return route.continue();
    // Fetch real response, add ai_feedback block to note_blocks + history.content
    // Return modified response
  });
}
```

### Test Scenarios

| Test | What it verifies |
|---|---|
| `renders suggestion highlights with tooltip data` | AI Check produces colored `<span>` elements with correct `data-*` attributes; hover shows tooltip with annotation |
| `editing one highlight strips only that highlight` | Per-span staleness: editing "va" → "va a" strips only the "va" span; "quedamos" remains highlighted |
| `reconciliation preserves unchanged highlights after reload` | After reload with edited draft text, reconciliation keeps "quedamos" highlight and drops "va" highlight |
| `reconciliation with all highlights unchanged` | When draft text matches segments text, all highlights render normally (no reconciliation needed) |
| `autosave after editing preserves edits` | After editing, the 5s debounced autosave persists the draft (PATCH waited on via `page.waitForRequest`); stale highlights are not re-applied; unchanged highlight persists |

### Key Assertions

- `data-original` matches the segment text (staleness detection anchor)
- `data-annotation` contains the correction (tooltip content)
- After edit: `span:not([class])` count = 1 (stripped span), `.hw-highlight-suggestion` count = 1 (remaining)
- After reload with edited draft: `data-original="quedamos"` is visible, `data-original="va"` has count 0
- `editor.innerText.trim()` matches the expected draft text

## Console Error Filtering

`console.spec.ts` ignores backend-connection errors (ERR_CONNECTION_REFUSED, React DevTools, etc.). Add patterns to `IGNORE_PATTERNS` when new expected console noise appears.

## Directories

| Path | Purpose | Git-tracked |
|---|---|---|
| `tests/snapshots/` | Baseline screenshots for visual regression | Yes |
| `tests/screenshots/` | Current-state screenshots | No (gitignored) |
| `tests/reports/` | Judge + iterate output | No (gitignored) |
| `test-results/` | Playwright HTML reports + failure artifacts | No (gitignored) |

## NPM Scripts

```bash
npm run test:visual    # Visual regression (screenshot comparison)
npm run test:layout    # Overflow, element visibility, viewport
npm run test:a11y      # axe-core accessibility violations
npm run test:console   # Console error detection (filtered)
npm run test:highlights # Highlight rendering, staleness, reconciliation
npm run test:all       # All Playwright tests
```