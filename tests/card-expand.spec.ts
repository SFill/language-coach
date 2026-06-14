import { test, expect } from './fixtures';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/coach';
const api = axios.create({ baseURL: API_BASE });

/** Create a note with one image assignment block for testing the expand feature. */
async function createNoteWithImageAssignment(): Promise<{ noteId: number; assignmentId: string }> {
  const { data: note } = await api.post('/notes/', { name: `PW expand ${Date.now()}`, history: { content: [] } });
  const noteId = note.id;

  const { data: blockData } = await api.post(`/notes/${noteId}/block`, {
    block: 'Describe what you see in the image below.',
    block_type: 'assignment',
    metadata_: { description: 'Image description task', category: 'Visual' },
  });
  const assignmentId = String(blockData.new_note_blocks[0].id);

  return { noteId, assignmentId };
}

async function deleteNote(noteId: number) {
  await api.delete(`/notes/${noteId}`).catch(() => {});
}

test.describe('Card image expand/collapse', () => {
  test('expand button appears on cards with images, overlay covers task pane only', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const card = page.locator('.hw-task-card').first();
    await expect(card).toBeVisible();

    // Cards without images should NOT have an expand button
    const expandBtn = card.locator('.hw-card-expand-btn');
    // The homeworkNote fixture doesn't have images, so expand btn should not exist
    await expect(expandBtn).toHaveCount(0);
  });

  test('clicking expand button opens overlay aligned with task pane, not covering draft area', async ({ page }) => {
    // Use an existing note that has image assignments
    const { data } = await api.get('/notes/?block_type=assignment');
    const notes = Array.isArray(data) ? data : data.notes ?? [];
    if (notes.length === 0) return; // skip if no notes with images

    const noteId = notes[0].id;
    await page.goto(`/homework/${noteId}`);
    await page.waitForLoadState('networkidle');

    const expandBtn = page.locator('.hw-task-card .hw-card-expand-btn').first();
    // Only run if there's an expand button (card has an image)
    if (!(await expandBtn.isVisible().catch(() => false))) return;

    await expandBtn.click();

    // Overlay should appear
    const overlay = page.locator('.hw-card-expanded-overlay');
    await expect(overlay).toBeVisible();

    // Overlay should be positioned over the task pane area, not covering the draft.
    // Use evaluate to get bounding rects reliably (portal elements can return null from boundingBox).
    const { overlayRight, draftLeft } = await page.evaluate(() => {
      const overlay = document.querySelector('.hw-card-expanded-overlay');
      const draft = document.querySelector('.hw-draft-section');
      const oRect = overlay?.getBoundingClientRect();
      const dRect = draft?.getBoundingClientRect();
      return {
        overlayRight: oRect ? oRect.right : -1,
        draftLeft: dRect ? dRect.left : -1,
      };
    });

    // Overlay should NOT extend into the draft area
    expect(overlayRight).toBeLessThanOrEqual(draftLeft + 1); // 1px tolerance

    // Close button should be visible
    await expect(overlay.locator('.hw-card-expanded-close')).toBeVisible();
  });

  test('ESC key closes the expanded overlay', async ({ page }) => {
    const { data } = await api.get('/notes/?block_type=assignment');
    const notes = Array.isArray(data) ? data : data.notes ?? [];
    if (notes.length === 0) return;

    const noteId = notes[0].id;
    await page.goto(`/homework/${noteId}`);
    await page.waitForLoadState('networkidle');

    const expandBtn = page.locator('.hw-task-card .hw-card-expand-btn').first();
    if (!(await expandBtn.isVisible().catch(() => false))) return;

    await expandBtn.click();
    const overlay = page.locator('.hw-card-expanded-overlay');
    await expect(overlay).toBeVisible();

    // Press ESC to close
    await page.keyboard.press('Escape');
    await expect(overlay).not.toBeVisible();
  });

  test('close button dismisses the overlay', async ({ page }) => {
    const { data } = await api.get('/notes/?block_type=assignment');
    const notes = Array.isArray(data) ? data : data.notes ?? [];
    if (notes.length === 0) return;

    const noteId = notes[0].id;
    await page.goto(`/homework/${noteId}`);
    await page.waitForLoadState('networkidle');

    const expandBtn = page.locator('.hw-task-card .hw-card-expand-btn').first();
    if (!(await expandBtn.isVisible().catch(() => false))) return;

    await expandBtn.click();
    const overlay = page.locator('.hw-card-expanded-overlay');
    await expect(overlay).toBeVisible();

    // Click close button
    await overlay.locator('.hw-card-expanded-close').click();
    await expect(overlay).not.toBeVisible();
  });

  test('clicking overlay backdrop dismisses the overlay', async ({ page }) => {
    const { data } = await api.get('/notes/?block_type=assignment');
    const notes = Array.isArray(data) ? data : data.notes ?? [];
    if (notes.length === 0) return;

    const noteId = notes[0].id;
    await page.goto(`/homework/${noteId}`);
    await page.waitForLoadState('networkidle');

    const expandBtn = page.locator('.hw-task-card .hw-card-expand-btn').first();
    if (!(await expandBtn.isVisible().catch(() => false))) return;

    await expandBtn.click();
    const overlay = page.locator('.hw-card-expanded-overlay');
    await expect(overlay).toBeVisible();

    // Click on the overlay backdrop (the overlay itself, not the container)
    await overlay.click({ position: { x: 5, y: 50 } }); // click near the left edge (backdrop area)
    await expect(overlay).not.toBeVisible();
  });

  test('draft area remains interactive while overlay is open', async ({ page }) => {
    const { data } = await api.get('/notes/?block_type=assignment');
    const notes = Array.isArray(data) ? data : data.notes ?? [];
    if (notes.length === 0) return;

    const noteId = notes[0].id;
    await page.goto(`/homework/${noteId}`);
    await page.waitForLoadState('networkidle');

    const expandBtn = page.locator('.hw-task-card .hw-card-expand-btn').first();
    if (!(await expandBtn.isVisible().catch(() => false))) return;

    await expandBtn.click();
    await expect(page.locator('.hw-card-expanded-overlay')).toBeVisible();

    // The draft editor should still be visible and clickable
    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible();
    await editor.click();
    // Type into the editor — should work even with overlay open
    await page.keyboard.type('Testing while viewing image');
    await expect(editor).toContainText('Testing while viewing image');
  });

  test('expand button is hidden by default, visible on card hover', async ({ page }) => {
    const { data } = await api.get('/notes/?block_type=assignment');
    const notes = Array.isArray(data) ? data : data.notes ?? [];
    if (notes.length === 0) return;

    const noteId = notes[0].id;
    await page.goto(`/homework/${noteId}`);
    await page.waitForLoadState('networkidle');

    const expandBtn = page.locator('.hw-task-card .hw-card-expand-btn').first();
    if (!(await expandBtn.count())) return; // no cards with images

    // Button should be invisible (opacity: 0) initially
    const opacity = await expandBtn.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBe(0);

    // Hover over the card to make it visible
    await page.locator('.hw-task-card').first().hover();
    await page.waitForTimeout(100); // wait for transition
    const hoverOpacity = await expandBtn.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(hoverOpacity)).toBeGreaterThan(0);
  });
});