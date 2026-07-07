import { test, expect } from '@playwright/test';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/coach';
const api = axios.create({ baseURL: API_BASE });

// Test sentence: "Si mañana va llover, nosotros quedamos en casa"
// Two errors: "va" → "va a" (missing "a"), "quedamos" → "nos quedamos" (missing reflexive pronoun)
const DRAFT_TEXT = 'Si mañana va llover, nosotros quedamos en casa';
const EDITED_DRAFT_TEXT = 'Si mañana va a llover, nosotros quedamos en casa';

// AI feedback segments for the original (un-edited) draft
const FEEDBACK_SEGMENTS = [
  { text: 'Si mañana ', type: 'plain' },
  { text: 'va', type: 'suggestion', annotation: "Correct: va a — Use 'va a' + infinitive for future plans" },
  { text: ' llover, nosotros ', type: 'plain' },
  { text: 'quedamos', type: 'suggestion', annotation: 'Correct: nos quedamos — Reflexive pronoun needed' },
  { text: ' en casa', type: 'plain' },
];

const FEEDBACK_BLOCK_ID = 'test-feedback-block-001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a note with an assignment and a student draft. */
async function createNoteWithDraft(
  draftText: string = DRAFT_TEXT,
): Promise<{ noteId: number; assignmentId: string; draftBlockId: string }> {
  const { data: note } = await api.post('/notes/', {
    name: `PW highlight ${Date.now()}`,
    history: { content: [] },
  });
  const noteId: number = note.id;

  const { data: assignData } = await api.post(`/notes/${noteId}/block`, {
    block: 'Escribe un párrafo sobre tus planes para el fin de semana.',
    block_type: 'assignment',
    metadata_: { category: 'Writing', difficulty: 'A2' },
  });
  const assignmentId: string = assignData.new_note_blocks[0].id;

  const { data: draftData } = await api.post(`/notes/${noteId}/block`, {
    block: draftText,
    block_type: 'simple_note',
    role: 'user',
    assignment_ref: assignmentId,
  });
  const draftBlockId: string = draftData.new_note_blocks[0].id;

  return { noteId, assignmentId, draftBlockId };
}

/** Delete a note by ID. */
async function deleteNote(noteId: number): Promise<void> {
  await api.delete(`/notes/${noteId}`).catch(() => {});
}

/**
 * Intercept GET /notes/{noteId} and inject an ai_feedback block with the given
 * segments. This simulates a completed AI Check without requiring an AI backend.
 *
 * The feedback block references the draft block via assignment_ref so the
 * DraftingArea component can find it.
 */
function injectFeedbackRoute(
  page: import('@playwright/test').Page,
  noteId: number,
  assignmentId: string,
  draftBlockId: string,
  segments = FEEDBACK_SEGMENTS,
) {
  page.route('**/api/coach/notes/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Only intercept GET requests for our specific note
    if (method !== 'GET' || !url.match(new RegExp(`/api/coach/notes/${noteId}/?$`))) {
      return route.continue();
    }

    const response = await route.fetch();
    const body = await response.json();

    const feedbackBlock = {
      id: FEEDBACK_BLOCK_ID,
      role: 'assistant',
      content: segments,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      block_type: 'ai_feedback',
      assignment_ref: draftBlockId,
    };

    // Remove any existing ai_feedback blocks for this assignment to avoid duplicates
    if (body.note_blocks) {
      body.note_blocks = body.note_blocks.filter(
        (b: any) =>
          !(b.block_type === 'ai_feedback' &&
            (b.assignment_ref === assignmentId || b.assignment_ref === draftBlockId)),
      );
      body.note_blocks.push(feedbackBlock);
    }

    // Also update history.content for completeness
    if (body.history?.content) {
      body.history.content = body.history.content.filter(
        (b: any) =>
          !(b.block_type === 'ai_feedback' &&
            (b.assignment_ref === assignmentId || b.assignment_ref === draftBlockId)),
      );
      body.history.content.push(feedbackBlock);
    }

    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body: JSON.stringify(body),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Grammarly-style highlights', () => {
  test('renders suggestion highlights with tooltip data', async ({ page }) => {
    const { noteId, assignmentId, draftBlockId } = await createNoteWithDraft();
    try {
      injectFeedbackRoute(page, noteId, assignmentId, draftBlockId);

      await page.goto(`/homework/${noteId}`);
      await page.waitForLoadState('networkidle');

      const editor = page.locator('.hw-editor-content');
      await expect(editor).toBeVisible({ timeout: 10000 });

      // Both suggestion highlights should render
      const highlights = editor.locator('.hw-highlight-suggestion');
      await expect(highlights).toHaveCount(2, { timeout: 5000 });

      // Verify highlight text and data attributes
      const vaSpan = highlights.nth(0);
      await expect(vaSpan).toHaveText('va');
      await expect(vaSpan).toHaveAttribute('data-type', 'suggestion');
      await expect(vaSpan).toHaveAttribute('data-original', 'va');
      await expect(vaSpan).toHaveAttribute('data-annotation', /va a/);

      const quedamosSpan = highlights.nth(1);
      await expect(quedamosSpan).toHaveText('quedamos');
      await expect(quedamosSpan).toHaveAttribute('data-type', 'suggestion');
      await expect(quedamosSpan).toHaveAttribute('data-original', 'quedamos');
      await expect(quedamosSpan).toHaveAttribute('data-annotation', /nos quedamos/);

      // Hover on "va" — tooltip should appear
      await vaSpan.hover();
      const tooltip = page.locator('.hw-feedback-tooltip');
      await expect(tooltip).toBeVisible({ timeout: 3000 });
      await expect(tooltip).toContainText('Suggestion');
      await expect(tooltip).toContainText('va a');

      // Hover on "quedamos" — tooltip should update
      await quedamosSpan.hover();
      await expect(tooltip).toContainText('nos quedamos');

      // The tooltip is portaled to <body>, so the .hw-editor scroll container
      // can't clip it — regression guard for the scroll-clipping bug.
      expect(await tooltip.evaluate((el) => el.closest('.hw-editor'))).toBeNull();
    } finally {
      await deleteNote(noteId);
    }
  });

  test('editing one highlight strips only that highlight (per-span staleness)', async ({ page }) => {
    const { noteId, assignmentId, draftBlockId } = await createNoteWithDraft();
    try {
      injectFeedbackRoute(page, noteId, assignmentId, draftBlockId);

      await page.goto(`/homework/${noteId}`);
      await page.waitForLoadState('networkidle');

      const editor = page.locator('.hw-editor-content');
      await expect(editor).toBeVisible({ timeout: 10000 });

      // Wait for both highlights to render
      const highlights = editor.locator('.hw-highlight-suggestion');
      await expect(highlights).toHaveCount(2, { timeout: 5000 });

      // Edit INSIDE the "va" highlight via the keyboard. Tiptap owns the DOM, so
      // direct textContent changes aren't seen by ProseMirror — place the caret
      // between 'v' and 'a' and type, which changes the marked text and lets the
      // staleness plugin strip only this mark.
      await page.evaluate(() => {
        const vaSpan = document.querySelector('.hw-highlight-suggestion[data-original="va"]') as HTMLElement | null;
        if (!vaSpan) throw new Error('va span not found');
        const editorEl = vaSpan.closest('.hw-editor-content') as HTMLElement;
        editorEl.focus();
        const textNode = vaSpan.firstChild as Text;
        const range = document.createRange();
        range.setStart(textNode, 1); // between 'v' and 'a'
        range.collapse(true);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
      });
      await page.keyboard.type('X'); // "va" -> "vXa"

      // The "va" mark should be stripped (its text changed); "quedamos" stays.
      const remainingHighlights = editor.locator('.hw-highlight-suggestion');
      await expect(remainingHighlights).toHaveCount(1, { timeout: 3000 });
      await expect(remainingHighlights.first()).toHaveAttribute('data-original', 'quedamos');

      // The edited text is preserved (just no longer highlighted).
      const editorText = await editor.innerText();
      expect(editorText).toContain('vXa');
      expect(editorText).toContain('quedamos');

      // Verify tooltip is dismissed after edit (stale span has no tooltip data)
      const tooltip = page.locator('.hw-feedback-tooltip');
      await expect(tooltip).not.toBeVisible();
    } finally {
      await deleteNote(noteId);
    }
  });

  test('reconciliation preserves unchanged highlights after page reload', async ({ page }) => {
    // Simulate a user who edited "va" → "va a" and submitted.
    // The draft now contains the edited text, but the feedback block still has
    // the original segments. On reload, reconciliation should preserve "quedamos"
    // (unchanged) and drop "va" (context changed).
    const { noteId, assignmentId, draftBlockId } = await createNoteWithDraft(EDITED_DRAFT_TEXT);
    try {
      injectFeedbackRoute(page, noteId, assignmentId, draftBlockId);

      await page.goto(`/homework/${noteId}`);
      await page.waitForLoadState('networkidle');

      const editor = page.locator('.hw-editor-content');
      await expect(editor).toBeVisible({ timeout: 10000 });

      // "quedamos" should be preserved — its text and context are unchanged in the draft
      const quedamosHighlight = editor.locator('.hw-highlight-suggestion[data-original="quedamos"]');
      await expect(quedamosHighlight).toBeVisible({ timeout: 5000 });
      await expect(quedamosHighlight).toHaveText('quedamos');
      await expect(quedamosHighlight).toHaveAttribute('data-annotation', /nos quedamos/);

      // "va" should NOT be re-highlighted — the user edited inside this span
      // (added "a" after "va"), so its surrounding context no longer matches the
      // original segment text. Reconciliation drops highlights whose context shifted.
      const vaHighlight = editor.locator('.hw-highlight-suggestion[data-original="va"]');
      await expect(vaHighlight).toHaveCount(0);

      // The full editor text should match the edited draft
      const editorText = await editor.innerText();
      expect(editorText.trim()).toBe(EDITED_DRAFT_TEXT);

      // "va a" should appear as plain text (not wrapped in a highlight span)
      expect(editorText).toContain('va a');

      // Reload the page — reconciliation should work the same way
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(editor).toBeVisible({ timeout: 10000 });

      // After reload, "quedamos" should still be preserved
      const quedamosAfterReload = editor.locator('.hw-highlight-suggestion[data-original="quedamos"]');
      await expect(quedamosAfterReload).toBeVisible({ timeout: 5000 });

      // "va" should still NOT be highlighted
      const vaAfterReload = editor.locator('.hw-highlight-suggestion[data-original="va"]');
      await expect(vaAfterReload).toHaveCount(0);

      // Full text should still match the edited draft
      const textAfterReload = await editor.innerText();
      expect(textAfterReload.trim()).toBe(EDITED_DRAFT_TEXT);
    } finally {
      await deleteNote(noteId);
    }
  });

  test('reconciliation with all highlights unchanged renders all highlights', async ({ page }) => {
    // When draft text matches segments text exactly, all highlights should render
    const { noteId, assignmentId, draftBlockId } = await createNoteWithDraft();
    try {
      injectFeedbackRoute(page, noteId, assignmentId, draftBlockId);

      await page.goto(`/homework/${noteId}`);
      await page.waitForLoadState('networkidle');

      const editor = page.locator('.hw-editor-content');
      await expect(editor).toBeVisible({ timeout: 10000 });

      // Both highlights should be present (no reconciliation needed — text matches)
      const highlights = editor.locator('.hw-highlight-suggestion');
      await expect(highlights).toHaveCount(2, { timeout: 5000 });

      // Full editor text should match the original draft
      const editorText = await editor.innerText();
      expect(editorText.trim()).toBe(DRAFT_TEXT);
    } finally {
      await deleteNote(noteId);
    }
  });

  test('submit after editing preserves edits and stale highlights are not re-applied', async ({ page }) => {
    // Full UC: load → see highlights → edit one → submit → verify stale not re-applied
    const { noteId, assignmentId, draftBlockId } = await createNoteWithDraft();
    try {
      injectFeedbackRoute(page, noteId, assignmentId, draftBlockId);

      await page.goto(`/homework/${noteId}`);
      await page.waitForLoadState('networkidle');

      const editor = page.locator('.hw-editor-content');
      await expect(editor).toBeVisible({ timeout: 10000 });

      // Wait for highlights
      const highlights = editor.locator('.hw-highlight-suggestion');
      await expect(highlights).toHaveCount(2, { timeout: 5000 });

      // Edit inside the "va" highlight via keyboard (Tiptap owns the DOM).
      await page.evaluate(() => {
        const vaSpan = document.querySelector('.hw-highlight-suggestion[data-original="va"]') as HTMLElement | null;
        if (!vaSpan) throw new Error('va span not found');
        const editorEl = vaSpan.closest('.hw-editor-content') as HTMLElement;
        editorEl.focus();
        const textNode = vaSpan.firstChild as Text;
        const range = document.createRange();
        range.setStart(textNode, 1);
        range.collapse(true);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
      });
      await page.keyboard.type('X'); // "va" -> "vXa" -> staleness strips the mark

      // "quedamos" should still be highlighted
      const remainingHighlights = editor.locator('.hw-highlight-suggestion');
      await expect(remainingHighlights).toHaveCount(1);
      await expect(remainingHighlights.first()).toHaveAttribute('data-original', 'quedamos');

      // Submit the draft
      const submitBtn = page.locator('.hw-submit-btn');
      await submitBtn.click();

      // Wait for the submit to complete (the button should re-enable)
      await expect(submitBtn).toBeEnabled({ timeout: 10000 });

      // After submit, the "quedamos" highlight should still be present
      // (segmentsStaleRef is true, so the useEffect renders draft content,
      //  but the DOM still has the stripped "va" span and the "quedamos" span)
      const highlightAfterSubmit = editor.locator('.hw-highlight-suggestion');
      await expect(highlightAfterSubmit).toHaveCount(1);
      await expect(highlightAfterSubmit.first()).toHaveAttribute('data-original', 'quedamos');
    } finally {
      await deleteNote(noteId);
    }
  });

  test('typing at the boundary of a highlight does not strip it', async ({ page }) => {
    // inclusive:false + per-mark staleness: typing immediately AFTER a highlight
    // (at its end boundary) leaves the marked text unchanged, so the mark stays.
    // Only edits that change the marked text itself strip the highlight.
    const { noteId, assignmentId, draftBlockId } = await createNoteWithDraft();
    try {
      injectFeedbackRoute(page, noteId, assignmentId, draftBlockId);

      await page.goto(`/homework/${noteId}`);
      await page.waitForLoadState('networkidle');

      const editor = page.locator('.hw-editor-content');
      await expect(editor).toBeVisible({ timeout: 10000 });
      await expect(editor.locator('.hw-highlight-suggestion')).toHaveCount(2, { timeout: 5000 });

      // Place the caret at the END of the "va" highlight (its boundary).
      await page.evaluate(() => {
        const vaSpan = document.querySelector('.hw-highlight-suggestion[data-original="va"]') as HTMLElement | null;
        if (!vaSpan) throw new Error('va span not found');
        const editorEl = vaSpan.closest('.hw-editor-content') as HTMLElement;
        editorEl.focus();
        const textNode = vaSpan.firstChild as Text;
        const range = document.createRange();
        range.setStart(textNode, textNode.length); // end boundary
        range.collapse(true);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
      });
      await page.keyboard.type('X'); // typed after the mark -> "va" stays marked

      // Both highlights remain — the marked text "va" is unchanged.
      await expect(editor.locator('.hw-highlight-suggestion')).toHaveCount(2);
      await expect(editor.locator('.hw-highlight-suggestion[data-original="va"]')).toHaveText('va');
    } finally {
      await deleteNote(noteId);
    }
  });
});