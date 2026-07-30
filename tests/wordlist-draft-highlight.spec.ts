import { test, expect } from './fixtures';

// ---------------------------------------------------------------------------
// Wordlist-word highlights in the homework draft (ProseMirror decorations).
// Uses the throwaway `homeworkNote` fixture for the draft (English: "Last
// weekend I went to the park and played football with my friends.") and mocks
// the wordlist API so the decorations are deterministic and the real DB is
// untouched.
// ---------------------------------------------------------------------------

interface WLWord {
  id: string;
  word: string;
  version: number;
  word_translation: string | null;
  example_phrase: string | null;
  example_phrase_translation: string | null;
}
interface WL { id: number; name: string; language: string; words: WLWord[]; }

const WL_ID = 49001;
function enWordlist(words: Array<{ word: string; tr: string }>): WL {
  return {
    id: WL_ID,
    name: 'Draft WL',
    language: 'en',
    words: words.map((w, i) => ({
      id: `w-${i}`,
      word: w.word,
      version: 0,
      word_translation: w.tr,
      example_phrase: null,
      example_phrase_translation: null,
    })),
  };
}

/**
 * Mock the wordlist API: GET en returns the given lists, GET es returns [].
 * POST update/create returns the words with deterministic fake translations so
 * the frontend's sync merge updates the decoration source.
 */
async function mockWordlist(page: import('@playwright/test').Page, enLists: WL[]) {
  const store = new Map(enLists.map((l) => [l.id, JSON.parse(JSON.stringify(l))]));
  await page.route('**/api/wordlist**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === 'GET' && url.includes('language=')) {
      const lang = url.includes('language=es') ? 'es' : 'en';
      return route.fulfill({ json: lang === 'en' ? [...store.values()].filter((l) => l.language === 'en') : [] });
    }
    if (method === 'POST' && /\/wordlist\/\d+/.test(url)) {
      const id = Number(url.split('/').pop());
      const body = route.request().postDataJSON();
      const updated: WL = {
        ...store.get(id),
        name: body.name,
        language: body.language,
        words: body.words.map((w: WLWord) => ({
          ...w,
          word_translation: w.word_translation || `[test:${w.word}]`,
          example_phrase_translation: `[test:${w.example_phrase || ''}]`,
        })),
      };
      store.set(id, updated);
      return route.fulfill({ json: updated });
    }
    if (method === 'POST' && !/\/wordlist\/\d+/.test(url)) {
      const body = route.request().postDataJSON();
      return route.fulfill({
        json: {
          id: 8888,
          name: body.name,
          language: body.language,
          words: body.words.map((w: WLWord) => ({ ...w, word_translation: `[test:${w.word}]`, example_phrase_translation: `[test:${w.example_phrase || ''}]` })),
        },
      });
    }
    return route.continue();
  });
}

async function preferLanguage(page: import('@playwright/test').Page, lang: string) {
  await page.addInitScript((l) => localStorage.setItem('language_preference', l), lang);
}

function wordlistSpans(page: import('@playwright/test').Page) {
  return page.locator('.hw-editor-content span[data-wordlist]');
}

test.describe('Wordlist-word draft highlights', () => {
  test.describe.configure({ mode: 'serial' });

  test('wordlist words are highlighted on load and tooltip shows the translation', async ({ page, homeworkNote }) => {
    await preferLanguage(page, 'en');
    await mockWordlist(page, [enWordlist([{ word: 'weekend', tr: '[test:weekend]' }])]);
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });
    await page.waitForFunction(() => (document.querySelector('.hw-editor-content')?.textContent?.length ?? 0) > 0, { timeout: 10000 });

    // "weekend" is decorated with its saved translation.
    const weekend = page.locator('.hw-editor-content span[data-wordlist]', { hasText: 'weekend' }).first();
    await expect(weekend).toBeVisible({ timeout: 10000 });
    expect(await weekend.getAttribute('data-translation')).toBe('[test:weekend]');

    // Hover shows the feedback tooltip with the translation.
    await weekend.scrollIntoViewIfNeeded();
    await weekend.hover();
    const tooltip = page.locator('.hw-feedback-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 3000 });
    await expect(tooltip).toContainText('[test:weekend]');
  });

  test('typing a wordlist word does not decorate it live', async ({ page, homeworkNote }) => {
    await preferLanguage(page, 'en');
    await mockWordlist(page, [enWordlist([{ word: 'weekend', tr: '[test:weekend]' }])]);
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');
    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });
    await page.waitForFunction(() => (document.querySelector('.hw-editor-content')?.textContent?.length ?? 0) > 0, { timeout: 10000 });

    const before = await wordlistSpans(page).count();

    // Type another occurrence of the wordlist word "weekend". The decoration
    // plugin must NOT re-scan on typing, so no new span appears.
    await editor.click();
    await page.keyboard.type(' weekend ');

    const after = await wordlistSpans(page).count();
    expect(after).toBe(before);
  });

  test('adding a word via the toolbar decorates it immediately', async ({ page, homeworkNote }) => {
    await preferLanguage(page, 'en');
    await mockWordlist(page, [enWordlist([{ word: 'weekend', tr: '[test:weekend]' }])]);
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');
    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });
    await page.waitForFunction(() => (document.querySelector('.hw-editor-content')?.textContent?.length ?? 0) > 0, { timeout: 10000 });

    // "park" is in the draft but not yet in the wordlist → not decorated.
    expect(await page.locator('.hw-editor-content span[data-wordlist]', { hasText: 'park' }).count()).toBe(0);

    // Select "park" and add it to the (mocked) wordlist via the toolbar.
    await selectWordAndShowToolbar(page, 'park');
    const toolbar = page.locator('.hw-selection-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 3000 });
    await page.locator('.hw-selection-toolbar-add').first().click();
    const dropdown = page.locator('.hw-selection-toolbar-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    const post = page.waitForRequest(
      (r) => r.method() === 'POST' && /\/api\/wordlist\/49001$/.test(r.url()),
    );
    // Click the existing list item (the mocked "Draft WL"), not "Create new list".
    await dropdown.locator('.hw-selection-toolbar-list-item:not(.hw-selection-toolbar-new-list)').first().click();
    await post;

    // The new word is decorated immediately (no page reload).
    const parkSpan = page.locator('.hw-editor-content span[data-wordlist]', { hasText: 'park' }).first();
    await expect(parkSpan).toBeVisible({ timeout: 10000 });
  });

  test('only current-language words are highlighted', async ({ page, homeworkNote }) => {
    await preferLanguage(page, 'en');
    await mockWordlist(page, [enWordlist([{ word: 'weekend', tr: '[test:weekend]' }])]);
    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => (document.querySelector('.hw-editor-content')?.textContent?.length ?? 0) > 0, { timeout: 10000 });
    await expect(page.locator('.hw-editor-content span[data-wordlist]', { hasText: 'weekend' }).first()).toBeVisible({ timeout: 10000 });

    // Switch the wordlist language to ES (no ES lists → no decorations).
    await page.locator('button', { hasText: 'ES' }).first().click();
    await expect(wordlistSpans(page)).toHaveCount(0, { timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Helper (local; mirrors selection-toolbar.spec.ts)
// ---------------------------------------------------------------------------
async function selectWordAndShowToolbar(page: import('@playwright/test').Page, word: string) {
  await page.evaluate((targetWord) => {
    const editor = document.querySelector('.hw-editor-content') as HTMLElement;
    if (!editor) throw new Error('Editor not found');
    const textContent = editor.textContent || '';
    const idx = textContent.indexOf(targetWord);
    if (idx === -1) throw new Error(`Word "${targetWord}" not found in editor`);
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let charCount = 0, startNode: Text | null = null, startOffset = 0, endNode: Text | null = null, endOffset = 0, foundStart = false, node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const len = node.textContent!.length;
      if (!foundStart && charCount + len > idx) { startNode = node; startOffset = idx - charCount; foundStart = true; }
      if (foundStart && charCount + len >= idx + targetWord.length) { endNode = node; endOffset = idx + targetWord.length - charCount; break; }
      charCount += len;
    }
    if (!startNode || !endNode) throw new Error('Could not locate text nodes');
    const range = document.createRange();
    range.setStart(startNode, startOffset); range.setEnd(endNode, endOffset);
    const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
    editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, word);
  await page.waitForTimeout(200);
}