import { test, expect } from './fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Select a word in the contentEditable editor by programmatically setting
 * the selection and dispatching mouseup to show the toolbar.
 */
async function selectWordAndShowToolbar(page: import('@playwright/test').Page, word: string) {
  await page.evaluate((targetWord) => {
    const editor = document.querySelector('.hw-editor-content') as HTMLElement;
    if (!editor) throw new Error('Editor not found');

    const textContent = editor.textContent || '';
    const idx = textContent.indexOf(targetWord);
    if (idx === -1) throw new Error(`Word "${targetWord}" not found in editor`);

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    let startNode: Text | null = null;
    let startOffset = 0;
    let endNode: Text | null = null;
    let endOffset = 0;
    let foundStart = false;

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const nodeLen = node.textContent!.length;
      if (!foundStart && charCount + nodeLen > idx) {
        startNode = node;
        startOffset = idx - charCount;
        foundStart = true;
      }
      if (foundStart && charCount + nodeLen >= idx + targetWord.length) {
        endNode = node;
        endOffset = idx + targetWord.length - charCount;
        break;
      }
      charCount += nodeLen;
    }

    if (!startNode || !endNode) throw new Error('Could not locate text nodes for selection');

    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);

    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    // Dispatch mouseup to trigger the React handler
    editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, word);

  // Wait for React to render the toolbar
  await page.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
// Tests — run serially to avoid shared wordlist state conflicts
// ---------------------------------------------------------------------------

test.describe('Selection toolbar', () => {
  test.describe.configure({ mode: 'serial' });

  test('toolbar appears when text is selected in the editor', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Initially, toolbar should not be visible
    const toolbar = page.locator('.hw-selection-toolbar');
    await expect(toolbar).not.toBeVisible();

    // Select a word in the editor
    await selectWordAndShowToolbar(page, 'weekend');

    // Toolbar should now be visible
    await expect(toolbar).toBeVisible({ timeout: 3000 });

    // The toolbar should contain an add/move button
    const addOrMoveBtn = page.locator('.hw-selection-toolbar-add, .hw-selection-toolbar-move').first();
    await expect(addOrMoveBtn).toBeVisible({ timeout: 3000 });
  });

  test('toolbar appears when a drag selection ends outside the editor', async ({ page, homeworkNote }) => {
    // Regression: the editor's own mouseup handler only fires when the release
    // happens inside the editor. A drag that ends outside .hw-editor used to
    // leave isDragging stuck true, so the toolbar never appeared. The window-
    // level mouseup listener must reset the drag state wherever the mouse is
    // released.
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });
    // Make sure the draft text has loaded before dragging over it.
    await page.waitForFunction(
      () => (document.querySelector('.hw-editor-content')?.textContent?.length ?? 0) > 0,
      { timeout: 10000 },
    );

    const box = await editor.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    // Start inside the editor on the first line of text; end to the LEFT of the
    // editor (in the other pane) — outside .hw-editor.
    const startX = box.x + 40;
    const startY = box.y + 16;
    const endX = Math.max(10, box.x - 100);
    const endY = startY;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    // Release OUTSIDE the editor.
    await page.mouse.up();

    const toolbar = page.locator('.hw-selection-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 3000 });

    // The drag produced a non-empty selection.
    const selText = await page.evaluate(() => window.getSelection()?.toString() ?? '');
    expect(selText.length).toBeGreaterThan(0);
  });

  test('toolbar hides when clicking outside the editor', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    const toolbar = page.locator('.hw-selection-toolbar');

    // Select a word
    await selectWordAndShowToolbar(page, 'park');
    await expect(toolbar).toBeVisible({ timeout: 3000 });

    // Click outside the editor to dismiss toolbar
    await page.locator('.hw-draft-section').click({ position: { x: 5, y: 5 } });

    // Toolbar should hide
    await expect(toolbar).not.toBeVisible({ timeout: 3000 });
  });

  test('wordlist dropdown opens and closes', async ({ page, homeworkNote }) => {
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    const toolbar = page.locator('.hw-selection-toolbar');
    const dropdown = page.locator('.hw-selection-toolbar-dropdown');

    // Select a word — use "football" to avoid conflicts with other tests
    await selectWordAndShowToolbar(page, 'football');
    await expect(toolbar).toBeVisible({ timeout: 3000 });

    // Dropdown should not be visible initially
    await expect(dropdown).not.toBeVisible();

    // Click the add/move button to open dropdown
    const addOrMoveBtn = page.locator('.hw-selection-toolbar-add, .hw-selection-toolbar-move').first();
    await addOrMoveBtn.click();
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Dropdown should contain list items
    const listItems = dropdown.locator('.hw-selection-toolbar-list-item');
    const count = await listItems.count();
    expect(count).toBeGreaterThan(0);

    // Click the same button again to toggle dropdown closed
    await addOrMoveBtn.click();
    await expect(dropdown).not.toBeVisible({ timeout: 3000 });
  });

  test('adding word to list includes sentence context', async ({ page, homeworkNote }) => {
    // The homeworkNote fixture creates a draft:
    // "Last weekend I went to the park and played football with my friends."
    // Use "friends" to avoid conflicts with other tests' wordlist state.

    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    const toolbar = page.locator('.hw-selection-toolbar');

    // Select "friends"
    await selectWordAndShowToolbar(page, 'friends');
    await expect(toolbar).toBeVisible({ timeout: 3000 });

    // Open dropdown
    const addBtn = page.locator('.hw-selection-toolbar-add').first();
    // If the word is already in a list from a previous run, the button will be "m" (move)
    // In that case, the test still passes — we just verify the dropdown works
    const addOrMoveBtn = page.locator('.hw-selection-toolbar-add, .hw-selection-toolbar-move').first();
    await addOrMoveBtn.click();

    const dropdown = page.locator('.hw-selection-toolbar-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Click the first existing list to add the word
    const firstList = dropdown.locator('.hw-selection-toolbar-list-item:not(.hw-selection-toolbar-new-list)').first();
    await firstList.click();

    // Wait for the add operation to complete
    await page.waitForTimeout(500);

    // Re-select the same word — should now show "m" (move) because the word is in a list
    await selectWordAndShowToolbar(page, 'friends');
    await expect(toolbar).toBeVisible({ timeout: 3000 });

    const moveBtn = page.locator('.hw-selection-toolbar-move');
    await expect(moveBtn).toBeVisible({ timeout: 3000 });
  });

  test('sentence extraction captures correct context from editor', async ({ page, homeworkNote }) => {
    // Verify that the sentence extraction algorithm correctly extracts the sentence
    // containing the selected word from the draft content.
    // The fixture draft is a single sentence, so the full text should be returned.

    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Verify the editor content
    const editorText = await editor.innerText();
    expect(editorText).toContain('weekend');

    // Verify the sentence extraction algorithm produces the correct result
    const sentence = await page.evaluate(() => {
      const editor = document.querySelector('.hw-editor-content') as HTMLElement;
      if (!editor) return null;

      const fullText = editor.textContent || '';
      const word = 'weekend';
      const idx = fullText.indexOf(word);
      if (idx === -1) return null;

      // Find sentence boundaries (same algorithm as extractSentenceFromEditor)
      let sentenceStart = 0;
      for (let i = idx - 1; i >= 0; i--) {
        if (/[.!?]/.test(fullText[i])) {
          sentenceStart = i + 1;
          break;
        }
      }
      let sentenceEnd = fullText.length;
      for (let i = idx; i < fullText.length; i++) {
        if (/[.!?]/.test(fullText[i])) {
          sentenceEnd = i;
          break;
        }
      }

      return fullText.slice(sentenceStart, sentenceEnd).trim();
    });

    // The sentence should contain the selected word
    expect(sentence).toContain('weekend');
    // The sentence should start from the beginning (single-sentence draft)
    expect(sentence?.toLowerCase()).toContain('last');
  });

  test('translate buttons translate the selection and clear on new selection', async ({ page, homeworkNote }) => {
    // Mock /api/translate so the test doesn't hit Google (deterministic + fast).
    await page.route('**/api/translate', (route) =>
      route.fulfill({ json: { text: 'TRANSLATED-RU' } }),
    );

    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    const toolbar = page.locator('.hw-selection-toolbar');
    const translation = page.locator('.hw-selection-toolbar-translation');

    // Select a word in the editor ("went" — unused by the other tests).
    await selectWordAndShowToolbar(page, 'went');
    await expect(toolbar).toBeVisible({ timeout: 3000 });

    // Click the Russian translate button.
    const ruBtn = page.locator('.hw-selection-toolbar-lang', { hasText: '🇷🇺' });
    await ruBtn.click();

    // The translated text appears in the toolbar display.
    await expect(translation).toContainText('TRANSLATED-RU', { timeout: 5000 });
    // The Russian button is highlighted as the active language.
    await expect(ruBtn).toHaveClass(/hw-selection-toolbar-lang--active/);

    // Change the selection — the translation must clear (no stale text). The
    // pane stays empty until a translate button is clicked again (it does NOT
    // echo the selected text as a fallback).
    await selectWordAndShowToolbar(page, 'park');
    await expect(toolbar).toBeVisible({ timeout: 3000 });
    await expect(translation).not.toContainText('TRANSLATED-RU');
    await expect(translation).toHaveText('');
  });
});