import { test, expect } from './fixtures';

test.describe('Import workspace', () => {
  test('/ shows ImportWorkspace by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const importWorkspace = page.locator('.hw-import-workspace');
    await expect(importWorkspace).toBeVisible();

    // NoteListView should NOT be visible
    const noteListView = page.locator('.hw-pick-container');
    await expect(noteListView).not.toBeVisible();
  });

  test('clicking Homework nav link toggles to NoteListView', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Start at ImportWorkspace
    await expect(page.locator('.hw-import-workspace')).toBeVisible();

    // Click Homework in top navbar
    await page.locator('.hw-topbar-nav .hw-topbar-link[href="/"]').click();

    // Should now show NoteListView
    await expect(page.locator('.hw-pick-container')).toBeVisible();
    // ImportWorkspace should be hidden
    await expect(page.locator('.hw-import-workspace')).not.toBeVisible();
  });

  test('clicking Homework nav link again toggles back to ImportWorkspace', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hwLink = page.locator('.hw-topbar-nav .hw-topbar-link[href="/"]');

    // Toggle to NoteListView
    await hwLink.click();
    await expect(page.locator('.hw-pick-container')).toBeVisible();

    // Toggle back to ImportWorkspace
    await hwLink.click();
    await expect(page.locator('.hw-import-workspace')).toBeVisible();
    await expect(page.locator('.hw-pick-container')).not.toBeVisible();
  });
});

test.describe('Import workspace UI elements', () => {
  test('shows cloud upload icon, title, description, paste button, and drop zone', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const workspace = page.locator('.hw-import-workspace');
    await expect(workspace).toBeVisible();

    // Cloud upload icon
    const icon = workspace.locator('.hw-import-icon-wrap');
    await expect(icon).toBeVisible();

    // Title
    await expect(workspace.locator('.hw-import-title')).toHaveText('Import your work');

    // Paste Text button
    const pasteBtn = workspace.locator('.hw-paste-btn');
    await expect(pasteBtn).toBeVisible();
    await expect(pasteBtn).toContainText('Paste Text');

    // Drop zone
    const dropZone = workspace.locator('.hw-drop-zone');
    await expect(dropZone).toBeVisible();
  });

  test('Paste Text button opens paste modal with contentEditable area', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click Paste Text
    await page.locator('.hw-paste-btn').click();

    // Modal should appear with contentEditable paste area
    const modal = page.locator('.hw-paste-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.hw-paste-area')).toBeVisible();
  });

  test('pasting plain text shows an exercise in preview', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open paste modal
    await page.locator('.hw-paste-btn').click();

    // Focus the paste area and type text
    const pasteArea = page.locator('.hw-paste-area');
    await pasteArea.click();

    // Simulate a paste event with plain text via keyboard
    await page.keyboard.insertText('My homework text');
    // Trigger the paste handler by dispatching a paste event with text/plain
    await page.evaluate(() => {
      const el = document.querySelector('.hw-paste-area');
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', 'My homework text from clipboard');
      const event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboardData,
      });
      el.dispatchEvent(event);
    });

    // Should show one exercise in preview
    await expect(page.locator('.hw-import-preview-item')).toHaveCount(1);
    await expect(page.locator('.hw-import-preview-item--exercise')).toHaveCount(1);
  });

  test('closing paste modal without importing keeps ImportWorkspace visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open paste modal
    await page.locator('.hw-paste-btn').click();
    const modal = page.locator('.hw-paste-modal');
    await expect(modal).toBeVisible();

    // Close without importing
    await modal.locator('.hw-paste-cancel-btn').click();

    // Modal should be gone
    await expect(modal).not.toBeVisible();

    // ImportWorkspace should still be visible
    await expect(page.locator('.hw-import-workspace')).toBeVisible();
  });
});

test.describe('Import workspace — navigation from NoteListView', () => {
  test('selecting a note from NoteListView navigates to split-pane view', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Toggle to NoteListView
    await page.locator('.hw-topbar-nav .hw-topbar-link[href="/"]').click();
    await expect(page.locator('.hw-pick-container')).toBeVisible();

    // Select a note
    await page.locator('.note-list-item').first().click();

    // Should navigate to /homework/:noteId and show split-pane
    await expect(page).toHaveURL(/\/homework\/\d+/);
    await expect(page.locator('.hw-split-layout')).toBeVisible();
  });

  test('clicking Homework from /homework/:id navigates back to / ImportWorkspace', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    // Should be on note detail page
    await expect(page.locator('.hw-split-layout')).toBeVisible();

    // Click Homework in top navbar
    await page.locator('.hw-topbar-nav .hw-topbar-link[href="/"]').click();

    // Should navigate to /homework and show ImportWorkspace
    await expect(page).toHaveURL('/');
    await expect(page.locator('.hw-import-workspace')).toBeVisible();
  });
});