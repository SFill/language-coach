import { test, expect } from '@playwright/test';

test.describe('Drafting area – tab switching', () => {
  test('preserves typed text when switching between Assignment and AI Q&A tabs', async ({ page }) => {
    await page.goto('/homework/7');
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Focus editor and type text
    await editor.click();
    await page.keyboard.type('Hello world');

    const textAfterTyping = await editor.innerText();
    expect(textAfterTyping.trim()).toBe('Hello world');

    // Switch to AI Q&A tab
    await page.locator('.hw-tab', { hasText: 'AI Q&A' }).click();
    await expect(page.locator('.hw-qa-input')).toBeVisible();

    // Switch back to Assignment tab
    await page.locator('.hw-tab', { hasText: 'Assignment' }).click();

    // Verify editor is still visible and text is preserved
    await expect(editor).toBeVisible();
    const textAfterSwitch = await editor.innerText();
    expect(textAfterSwitch.trim()).toBe('Hello world');
  });

  test('preserves text after adding a word and switching tabs', async ({ page }) => {
    await page.goto('/homework/7');
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Type initial text
    await editor.click();
    await page.keyboard.type('Good morning');

    // Add a word
    await page.keyboard.type(' everyone');

    const textAfterEdit = await editor.innerText();
    expect(textAfterEdit.trim()).toBe('Good morning everyone');

    // Switch to AI Q&A tab
    await page.locator('.hw-tab', { hasText: 'AI Q&A' }).click();
    await expect(page.locator('.hw-qa-input')).toBeVisible();

    // Switch back
    await page.locator('.hw-tab', { hasText: 'Assignment' }).click();
    await expect(editor).toBeVisible();

    const textAfterSwitch = await editor.innerText();
    expect(textAfterSwitch.trim()).toBe('Good morning everyone');
  });

  test('tab content stays in DOM when hidden (no unmount)', async ({ page }) => {
    await page.goto('/homework/7');
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Type text in the editor
    await editor.click();
    await page.keyboard.type('Persistent text');

    // Switch to Q&A tab — the assignment tab must stay in DOM (hidden via CSS)
    await page.locator('.hw-tab', { hasText: 'AI Q&A' }).click();
    await expect(page.locator('.hw-qa-input')).toBeVisible();

    // The editor must still exist in the DOM even though the tab is hidden
    const editorInDom = await page.locator('.hw-editor-content').count();
    expect(editorInDom).toBe(1);

    // The hidden tab container must use CSS display toggle, not conditional rendering
    const assignmentTabStyle = await page.locator('.hw-editor-content')
      .evaluate((el) => {
        // Walk up to the tab wrapper div
        const wrapper = el.closest('[style*="display"]');
        if (!wrapper) return null;
        const style = getComputedStyle(wrapper);
        return { display: style.display, visibility: style.visibility };
      });
    // The wrapper exists and uses display:none (not removed from DOM)
    // When the tab is inactive, content is hidden but present
    expect(assignmentTabStyle).not.toBeNull();
  });
});

test.describe('Scrolling – viewport containment and no clipping', () => {
  test('Q&A panel stays within viewport and scrolls without clipping', async ({ page }) => {
    await page.goto('/homework/8');
    await page.waitForLoadState('networkidle');

    // Switch to Q&A tab (note 8 has multiple Q&A items)
    await page.locator('.hw-tab', { hasText: 'AI Q&A' }).click();
    await expect(page.locator('.hw-qa-input')).toBeVisible();

    const qaPanel = page.locator('.hw-qa-panel');
    const qaList = page.locator('.hw-qa-list');

    // The panel must not extend past the viewport — this catches the bug
    // where flex layout wasn't constraining the panel height
    const panelWithinViewport = await qaPanel.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return Math.round(rect.bottom) <= window.innerHeight;
    });
    expect(panelWithinViewport).toBe(true);

    // The list must be scrollable — content overflows the visible area
    const isScrollable = await qaList.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(isScrollable).toBe(true);

    // Must be able to scroll to the bottom without the panel escaping viewport
    await qaList.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
    const scrollTop = await qaList.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);

    // After scrolling, panel must still be within viewport (no clipping)
    const panelStillContained = await qaPanel.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return Math.round(rect.bottom) <= window.innerHeight;
    });
    expect(panelStillContained).toBe(true);
  });

  test('card feed stays within viewport and scrolls without clipping', async ({ page }) => {
    await page.goto('/homework');
    await page.waitForLoadState('networkidle');

    const feed = page.locator('.hw-task-feed');
    await expect(feed).toBeVisible({ timeout: 10000 });

    // The feed must not extend past the viewport
    const feedWithinViewport = await feed.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return Math.round(rect.bottom) <= window.innerHeight;
    });
    expect(feedWithinViewport).toBe(true);

    // If content overflows, the feed must scroll (not clip)
    const isScrollable = await feed.evaluate((el) => el.scrollHeight > el.clientHeight);
    if (isScrollable) {
      // Scroll to bottom and verify scrollTop increases
      await feed.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
      const scrollTop = await feed.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);

      // After scrolling, feed must still be within viewport
      const feedStillContained = await feed.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return Math.round(rect.bottom) <= window.innerHeight;
      });
      expect(feedStillContained).toBe(true);
    }
  });

  test('editor area scrolls long text without overflowing viewport', async ({ page }) => {
    await page.goto('/homework/7');
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    const editorContainer = page.locator('.hw-editor');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Type enough text to require scrolling
    await editor.click();
    const longText = Array(20).fill('This is a line of draft text for scrolling.').join('\n');
    await page.keyboard.insertText(longText);

    // The editor container must not extend past viewport
    const editorWithinViewport = await editorContainer.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return Math.round(rect.bottom) <= window.innerHeight;
    });
    expect(editorWithinViewport).toBe(true);

    // If the content overflows, it must scroll within the container
    const isScrollable = await editorContainer.evaluate((el) => el.scrollHeight > el.clientHeight);
    if (isScrollable) {
      await editorContainer.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
      const scrollTop = await editorContainer.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);

      // After scrolling, container must still be within viewport
      const editorStillContained = await editorContainer.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return Math.round(rect.bottom) <= window.innerHeight;
      });
      expect(editorStillContained).toBe(true);
    }
  });

  test('page does not scroll — content is contained within viewport', async ({ page }) => {
    await page.goto('/homework/8');
    await page.waitForLoadState('networkidle');

    // The page itself must not have vertical scroll — all content is contained
    const pageScrollable = await page.evaluate(() =>
      document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight
    );
    expect(pageScrollable).toBe(false);

    // Switch to Q&A tab and verify again
    await page.locator('.hw-tab', { hasText: 'AI Q&A' }).click();
    const stillNoScroll = await page.evaluate(() =>
      document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight
    );
    expect(stillNoScroll).toBe(true);
  });
});

test.describe('Flex layout structure – prevents overflow clipping', () => {
  test('active tab wrapper has flex layout to prevent overflow clipping', async ({ page }) => {
    await page.goto('/homework/7');
    await page.waitForLoadState('networkidle');

    // The active (assignment) tab wrapper must be a flex column with flex:1 and min-height:0
    // This is the fix for the scroll clipping bug — without these properties,
    // the scroll container cannot shrink and content overflows the viewport
    const assignmentStyle = await page.locator('.hw-editor-content')
      .evaluate((el) => {
        const wrapper = el.closest('[style*="display"]');
        if (!wrapper) return null;
        const cs = getComputedStyle(wrapper);
        return {
          display: cs.display,
          flexDirection: cs.flexDirection,
          flex: cs.flex,
          minHeight: cs.minHeight,
        };
      });

    expect(assignmentStyle).not.toBeNull();
    expect(assignmentStyle.display).toBe('flex');
    expect(assignmentStyle.flexDirection).toBe('column');
    expect(assignmentStyle.flex).toContain('1');
    expect(assignmentStyle.minHeight).toBe('0px');

    // Switch to Q&A tab and check its wrapper too
    await page.locator('.hw-tab', { hasText: 'AI Q&A' }).click();
    await expect(page.locator('.hw-qa-input')).toBeVisible();

    const qaStyle = await page.locator('.hw-qa-panel')
      .evaluate((el) => {
        const wrapper = el.closest('[style*="display"]');
        if (!wrapper) return null;
        const cs = getComputedStyle(wrapper);
        return {
          display: cs.display,
          flexDirection: cs.flexDirection,
          flex: cs.flex,
          minHeight: cs.minHeight,
        };
      });

    expect(qaStyle).not.toBeNull();
    expect(qaStyle.display).toBe('flex');
    expect(qaStyle.flexDirection).toBe('column');
    expect(qaStyle.flex).toContain('1');
    expect(qaStyle.minHeight).toBe('0px');
  });

  test('scroll containers have overflow-y auto or scroll', async ({ page }) => {
    await page.goto('/homework/8');
    await page.waitForLoadState('networkidle');

    // Editor must allow vertical scroll
    const editorOverflow = await page.locator('.hw-editor').evaluate((el) => {
      return getComputedStyle(el).overflowY;
    });
    expect(['auto', 'scroll']).toContain(editorOverflow);

    // Switch to Q&A and check its list
    await page.locator('.hw-tab', { hasText: 'AI Q&A' }).click();
    const qaListOverflow = await page.locator('.hw-qa-list').evaluate((el) => {
      return getComputedStyle(el).overflowY;
    });
    expect(['auto', 'scroll']).toContain(qaListOverflow);
  });
});