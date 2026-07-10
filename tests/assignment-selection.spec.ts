import { test, expect } from './fixtures';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/coach';
const api = axios.create({ baseURL: API_BASE });

/** Helper: create a note with assignments and optional drafts via the backend API. */
async function createNoteWithAssignments(opts: {
  assignments: Array<{ text: string; description: string; category: string }>;
  drafts?: Array<{ text: string; assignmentIndex: number }>;
}): Promise<{ noteId: number; noteName: string; assignmentIds: string[] }> {
  const noteName = `PW test ${Date.now()}`;
  const { data: note } = await api.post('/notes/', { name: noteName, history: { content: [] } });
  const noteId = note.id;
  const assignmentIds: string[] = [];

  for (const a of opts.assignments) {
    const { data } = await api.post(`/notes/${noteId}/block`, {
      block: a.text,
      block_type: 'assignment',
      metadata_: { description: a.description, category: a.category },
    });
    assignmentIds.push(String(data.new_note_blocks[0].id));
  }

  for (const d of opts.drafts ?? []) {
    const ref = assignmentIds[d.assignmentIndex];
    await api.post(`/notes/${noteId}/block`, {
      block: d.text,
      block_type: 'simple_note',
      role: 'user',
      assignment_ref: ref,
    });
  }

  return { noteId, noteName, assignmentIds };
}

async function deleteNote(noteId: number) {
  await api.delete(`/notes/${noteId}`).catch(() => {});
}

test.describe('Assignment selection', () => {
  test('switching between assignments shows correct prompt and independent drafts', async ({ page }) => {
    const { noteId } = await createNoteWithAssignments({
      assignments: [
        { text: 'Write about your weekend. Include at least three activities.', description: 'Weekend essay', category: 'Writing' },
        { text: 'Describe your favorite holiday destination and why you enjoy visiting it.', description: 'Holiday destination', category: 'Writing' },
      ],
      drafts: [
        { text: 'Last Saturday I went hiking in the mountains near my town.', assignmentIndex: 0 },
      ],
    });

    try {
      await page.goto(`/homework/${noteId}`);
      await page.waitForLoadState('networkidle');

      const cards = page.locator('.hw-task-card');
      await expect(cards).toHaveCount(2);

      // First assignment active by default
      await expect(cards.nth(0).locator('.hw-card-current-badge')).toBeVisible();
      await expect(page.locator('.hw-assignment-prompt-text')).toContainText('Write about your weekend');

      const editor = page.locator('.hw-editor-content');
      await expect(editor).toContainText('Last Saturday I went hiking');

      // Switch to second assignment
      await cards.nth(1).locator('.hw-select-btn').click();
      await expect(cards.nth(1).locator('.hw-card-current-badge')).toBeVisible();
      await expect(page.locator('.hw-assignment-prompt-text')).toContainText('favorite holiday destination');
      expect((await editor.innerText()).trim()).toBe('');

      // Type a draft for assignment 2 (autosave schedules a 5s debounced sync).
      await editor.click();
      await page.keyboard.type('My favorite holiday destination is Barcelona.');

      // Switching back to assignment 1 flushes assignment 2's pending edit
      // immediately (the autosave coordinator's flush-on-context-switch). Capture
      // the PATCH promise before the switch so we can await its persistence.
      const patchUrl = new RegExp(`/api/coach/notes/${noteId}/block/`);
      const flushPatch = page.waitForRequest(
        (req) => req.method() === 'PATCH' && patchUrl.test(req.url()),
        { timeout: 12000 },
      );

      // Switch back to first — its draft should still be there, and the switch
      // flushes assignment 2's draft to the server.
      await cards.nth(0).locator('.hw-select-btn').click();
      await flushPatch;
      await expect(page.locator('.hw-assignment-prompt-text')).toContainText('Write about your weekend');
      await expect(editor).toContainText('Last Saturday I went hiking');

      // Switch to second again — its draft persisted via the flush above
      await cards.nth(1).locator('.hw-select-btn').click();
      await expect(editor).toContainText('Barcelona');
    } finally {
      await deleteNote(noteId);
    }
  });

  test('first assignment is auto-selected when navigating from NoteListView', async ({ page }) => {
    const { noteId, noteName } = await createNoteWithAssignments({
      assignments: [
        { text: 'Describe a book you recently read.', description: 'Book review', category: 'Writing' },
        { text: 'Write a letter to your future self.', description: 'Future letter', category: 'Writing' },
      ],
    });

    try {
      // Start at /homework (ImportWorkspace)
      await page.goto('/homework');
      await page.waitForLoadState('networkidle');

      // Toggle to NoteListView
      await page.locator('.hw-topbar-nav .hw-topbar-link[href="/homework"]').click();
      await expect(page.locator('.hw-pick-container')).toBeVisible();

      // Click THIS test's note (the list is shared across parallel tests, so
      // targeting .first() can race onto another test's note).
      await page.locator('.note-list-item', { hasText: noteName }).click();
      await expect(page).toHaveURL(new RegExp(`/homework/${noteId}(?:\\?|$|#)`));

      // Wait for the note to load and cards to render
      const cards = page.locator('.hw-task-card');
      await expect(cards.first()).toBeVisible({ timeout: 5000 });

      // First card should be active (Current Assignment badge visible)
      await expect(cards.nth(0).locator('.hw-card-current-badge')).toBeVisible();
      // Prompt should show the first assignment's text
      await expect(page.locator('.hw-assignment-prompt-text')).toContainText('book you recently read');
    } finally {
      await deleteNote(noteId);
    }
  });
});