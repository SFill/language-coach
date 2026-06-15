import { test, expect } from './fixtures';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/coach';
const api = axios.create({ baseURL: API_BASE });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate pasting plain text into the contentEditable paste area. */
async function pasteTextIntoModal(page: import('@playwright/test').Page, text: string) {
  const pasteArea = page.locator('.hw-paste-area');
  await expect(pasteArea).toBeVisible();

  await page.evaluate((plainText) => {
    const el = document.querySelector('.hw-paste-area') as HTMLElement;
    if (!el) throw new Error('Paste area not found');
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', plainText);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    });
    el.dispatchEvent(pasteEvent);
  }, text);

  // Wait for React to render the preview
  await page.waitForTimeout(200);
}

/** Simulate pasting HTML (text + image) into the contentEditable paste area. */
async function pasteHTMLIntoModal(page: import('@playwright/test').Page, html: string) {
  const pasteArea = page.locator('.hw-paste-area');
  await expect(pasteArea).toBeVisible();

  await page.evaluate((pasteHTML) => {
    const el = document.querySelector('.hw-paste-area') as HTMLElement;
    if (!el) throw new Error('Paste area not found');
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/html', pasteHTML);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    });
    el.dispatchEvent(pasteEvent);
  }, html);

  await page.waitForTimeout(200);
}

/** Create a 1x1 red PNG as a data URI for testing image paste. */
const TEST_IMAGE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

// ---------------------------------------------------------------------------
// Tests — run serially to avoid shared state conflicts
// ---------------------------------------------------------------------------

test.describe('Add Assignment modal', () => {
  test.describe.configure({ mode: 'serial' });

  test('opens and closes the modal', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    // Modal should not be visible initially
    await expect(page.locator('.hw-paste-modal-overlay')).not.toBeVisible();

    // Click the Add button
    const addBtn = page.getByRole('button', { name: 'add Add' });
    await addBtn.click();

    // Modal should appear
    await expect(page.locator('.hw-paste-modal-overlay')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Add Assignment')).toBeVisible();

    // Paste area should be visible with placeholder
    const pasteArea = page.locator('.hw-paste-area');
    await expect(pasteArea).toBeVisible();

    // Cancel button should be visible
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelBtn).toBeVisible();

    // Add button should NOT be visible yet (no segments pasted)
    await expect(page.getByRole('button', { name: /Add \d+ segment/ })).not.toBeVisible();

    // Click Cancel
    await cancelBtn.click();

    // Modal should close
    await expect(page.locator('.hw-paste-modal-overlay')).not.toBeVisible({ timeout: 3000 });
  });

  test('modal dismisses on overlay click', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('button', { name: 'add Add' });
    await addBtn.click();
    await expect(page.locator('.hw-paste-modal-overlay')).toBeVisible({ timeout: 3000 });

    // Click the overlay background (not the modal content)
    await page.locator('.hw-paste-modal-overlay').click({ position: { x: 50, y: 50 } });

    await expect(page.locator('.hw-paste-modal-overlay')).not.toBeVisible({ timeout: 3000 });
  });

  test('modal dismisses on Escape key', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('button', { name: 'add Add' });
    await addBtn.click();
    await expect(page.locator('.hw-paste-modal-overlay')).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');

    await expect(page.locator('.hw-paste-modal-overlay')).not.toBeVisible({ timeout: 3000 });
  });

  test('pasting plain text shows segment preview and adds assignment', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    // Count existing assignment cards
    const initialCount = await page.locator('.hw-task-card').count();

    const addBtn = page.getByRole('button', { name: 'add Add' });
    await addBtn.click();
    await expect(page.locator('.hw-paste-modal-overlay')).toBeVisible({ timeout: 3000 });

    // Paste text
    const testText = 'Describe a memorable trip you took recently and what made it special.';
    await pasteTextIntoModal(page, testText);

    // Segment preview should appear
    await expect(page.getByText('Detected 1 segment')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.hw-import-preview-item--text')).toBeVisible();

    // Add button should now be visible
    const importBtn = page.getByRole('button', { name: 'Add 1 segment' });
    await expect(importBtn).toBeVisible({ timeout: 3000 });

    // Click Add
    await importBtn.click();

    // Modal should close
    await expect(page.locator('.hw-paste-modal-overlay')).not.toBeVisible({ timeout: 3000 });

    // New assignment card should appear in the feed
    await expect(page.locator('.hw-task-card')).toHaveCount(initialCount + 1, { timeout: 5000 });

    // The new card should contain the pasted text
    const newCardText = await page.locator('.hw-task-card').last().locator('.hw-card-desc').innerText();
    expect(newCardText).toContain('memorable trip');
  });

  test('pasting text creates assignment block in the backend', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    // Count existing assignment blocks via API
    const { data: before } = await api.get(`/notes/${homeworkNote.id}`);
    const assignmentBlocksBefore = before.note_blocks.filter(
      (b: { block_type?: string }) => b.block_type === 'assignment',
    ).length;

    const addBtn = page.getByRole('button', { name: 'add Add' });
    await addBtn.click();
    await expect(page.locator('.hw-paste-modal-overlay')).toBeVisible({ timeout: 3000 });

    const testText = 'Write about a traditional dish from your country.';
    await pasteTextIntoModal(page, testText);

    const importBtn = page.getByRole('button', { name: 'Add 1 segment' });
    await expect(importBtn).toBeVisible({ timeout: 3000 });
    await importBtn.click();

    // Wait for the card to appear (confirms the UI refresh)
    await expect(page.locator('.hw-task-card')).toHaveCount(assignmentBlocksBefore + 1, { timeout: 5000 });

    // Verify backend has the new assignment block
    const { data: after } = await api.get(`/notes/${homeworkNote.id}`);
    const assignmentBlocksAfter = after.note_blocks.filter(
      (b: { block_type?: string }) => b.block_type === 'assignment',
    ).length;
    expect(assignmentBlocksAfter).toBe(assignmentBlocksBefore + 1);

    // Find the newly added block and verify its content
    const newBlock = after.note_blocks
      .filter((b: { block_type?: string }) => b.block_type === 'assignment')
      .find((b: { content?: string }) => b.content?.includes('traditional dish'));
    expect(newBlock).toBeTruthy();
    expect(newBlock.metadata_?.category).toBe('Writing');
  });

  test('pasting HTML with text and image shows both segments', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('button', { name: 'add Add' });
    await addBtn.click();
    await expect(page.locator('.hw-paste-modal-overlay')).toBeVisible({ timeout: 3000 });

    // Paste HTML containing text + image
    const html = `<p>Explain the water cycle in your own words.</p><img src="${TEST_IMAGE_DATA_URI}" alt="diagram" />`;
    await pasteHTMLIntoModal(page, html);

    // Should detect 2 segments
    await expect(page.getByText('Detected 2 segments')).toBeVisible({ timeout: 3000 });

    // Both segment types should appear in preview
    await expect(page.locator('.hw-import-preview-item--text')).toBeVisible();
    await expect(page.locator('.hw-import-preview-item--image')).toBeVisible();

    // Add button should show 2 segments
    const importBtn = page.getByRole('button', { name: 'Add 2 segments' });
    await expect(importBtn).toBeVisible({ timeout: 3000 });

    // Click Add
    await importBtn.click();

    // Modal should close
    await expect(page.locator('.hw-paste-modal-overlay')).not.toBeVisible({ timeout: 3000 });

    // New assignment cards should appear
    const cards = page.locator('.hw-task-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3); // original + text + image
  });

  test('newly added assignment card can be selected', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('button', { name: 'add Add' });
    await addBtn.click();
    await expect(page.locator('.hw-paste-modal-overlay')).toBeVisible({ timeout: 3000 });

    const testText = 'Describe the benefits of learning a second language.';
    await pasteTextIntoModal(page, testText);

    const importBtn = page.getByRole('button', { name: 'Add 1 segment' });
    await expect(importBtn).toBeVisible({ timeout: 3000 });
    await importBtn.click();

    // Wait for the new card to appear
    await expect(page.locator('.hw-task-card').last()).toBeVisible({ timeout: 5000 });

    // Click the last card's Select button
    const lastCard = page.locator('.hw-task-card').last();
    await lastCard.getByRole('button', { name: 'Select' }).click();

    // The drafting area should show the assignment prompt
    const promptText = page.locator('.hw-assignment-prompt-text');
    await expect(promptText).toBeVisible({ timeout: 3000 });
    const promptContent = await promptText.innerText();
    expect(promptContent).toContain('learning a second language');
  });

  test('modal resets segments when reopened', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('button', { name: 'add Add' });

    // Open modal, paste text, then Cancel
    await addBtn.click();
    await expect(page.locator('.hw-paste-modal-overlay')).toBeVisible({ timeout: 3000 });

    await pasteTextIntoModal(page, 'Some assignment text');
    await expect(page.getByText('Detected 1 segment')).toBeVisible({ timeout: 3000 });

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.hw-paste-modal-overlay')).not.toBeVisible({ timeout: 3000 });

    // Reopen modal — should start fresh (no previous segments)
    await addBtn.click();
    await expect(page.locator('.hw-paste-modal-overlay')).toBeVisible({ timeout: 3000 });

    // Paste area should be visible again (not the preview)
    const pasteArea = page.locator('.hw-paste-area');
    await expect(pasteArea).toBeVisible({ timeout: 3000 });

    // No segment preview should be visible
    await expect(page.getByText(/Detected \d+ segment/)).not.toBeVisible();
  });
});

test.describe('Assignment card selection via URL hash', () => {
  test.describe.configure({ mode: 'serial' });

  test('selecting a card updates the URL hash', async ({ page, homeworkNote }) => {
    // Add a second assignment so we have 2 cards to switch between
    await api.post(`/notes/${homeworkNote.id}/block`, {
      block: 'Describe your hometown in three sentences.',
      block_type: 'assignment',
      metadata_: { description: 'Describe your hometown in three sentences.', category: 'Writing' },
    });

    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Wait for cards to load
    const cards = page.locator('.hw-task-card');
    await expect(cards).toHaveCount(2, { timeout: 5000 });

    // Initially, URL has no hash (first assignment auto-selected)
    expect(page.url().split('#')[1]).toBeFalsy();

    // Click the Select button on the second (inactive) card
    const secondSelectBtn = cards.nth(1).locator('.hw-select-btn');
    await expect(secondSelectBtn).toBeVisible({ timeout: 3000 });
    await secondSelectBtn.click();

    // URL should now have a hash with the blockId
    const hash = page.url().split('#')[1];
    expect(hash).toBeTruthy();

    // Verify the hash is a valid assignment block ID
    const { data: note } = await api.get(`/notes/${homeworkNote.id}`);
    const assignmentIds = note.note_blocks
      .filter((b: { block_type?: string }) => b.block_type === 'assignment')
      .map((b: { id: string }) => b.id);
    expect(assignmentIds).toContain(hash);
  });

  test('URL hash restores assignment selection after reload', async ({ page, homeworkNote }) => {
    // Get the assignment block IDs from the API
    const { data: note } = await api.get(`/notes/${homeworkNote.id}`);
    const assignmentBlocks = note.note_blocks.filter(
      (b: { block_type?: string }) => b.block_type === 'assignment',
    );
    // Use the last assignment block — the one NOT auto-selected by default
    const targetBlock = assignmentBlocks[assignmentBlocks.length - 1];
    if (!targetBlock) return;

    // Navigate directly with hash
    await page.goto(`/homework/${homeworkNote.id}#${targetBlock.id}`);
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Wait for cards to render
    const cards = page.locator('.hw-task-card');
    await expect(cards).toHaveCount(assignmentBlocks.length, { timeout: 5000 });

    // The active card's prompt should show the target assignment's content
    const promptText = await page.locator('.hw-assignment-prompt-text').innerText();
    const content = targetBlock.content || targetBlock.block || '';
    expect(promptText).toContain(content.slice(0, 30));

    // The URL should still have the hash after load
    const hash = page.url().split('#')[1];
    expect(hash).toBe(targetBlock.id);
  });

  test('selecting a different card changes the hash', async ({ page, homeworkNote }) => {
    // Add a second assignment so we have 2 cards
    await api.post(`/notes/${homeworkNote.id}/block`, {
      block: 'Write about a memorable holiday experience.',
      block_type: 'assignment',
      metadata_: { description: 'Write about a memorable holiday experience.', category: 'Writing' },
    });

    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Wait for 2 cards
    const cards = page.locator('.hw-task-card');
    await expect(cards).toHaveCount(2, { timeout: 5000 });

    // Click second card's Select button
    const secondSelectBtn = cards.nth(1).locator('.hw-select-btn');
    await expect(secondSelectBtn).toBeVisible({ timeout: 3000 });
    await secondSelectBtn.click();

    const secondHash = page.url().split('#')[1];
    expect(secondHash).toBeTruthy();

    // Now click first card's Select button
    const firstSelectBtn = cards.nth(0).locator('.hw-select-btn');
    await expect(firstSelectBtn).toBeVisible({ timeout: 3000 });
    await firstSelectBtn.click();

    const firstHash = page.url().split('#')[1];
    expect(firstHash).toBeTruthy();
    expect(firstHash).not.toBe(secondHash);
  });
});