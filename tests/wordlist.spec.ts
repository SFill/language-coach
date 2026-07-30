import { test, expect } from './fixtures';
import type { CreatedWordlist, WordlistWord } from './fixtures';

// ---------------------------------------------------------------------------
// Wordlist editing tests (versioned translations, id-based identity, both
// front-face fields editable).
//
// Each test creates a real wordlist via the `wordlist` fixture (backend
// test_mode → deterministic fake translations, no AI) and destroys it after.
// GET is mocked to isolate the page from other wordlists in the DB; POST/DELETE
// are forwarded to the REAL backend with test_mode so the actual version-based
// keep/retranslate logic is exercised end-to-end.
// ---------------------------------------------------------------------------

/** Set the active wordlist language preference before the page boots. */
async function preferLanguage(page: import('@playwright/test').Page, lang: string) {
  await page.addInitScript((l) => localStorage.setItem('language_preference', l), lang);
}

/**
 * Mock GET (isolation: show only the fixture's list for 'es', nothing for 'en')
 * and forward POST/DELETE to the real backend with test_mode=true so the real
 * version logic runs deterministically without AI.
 */
async function isolateWordlist(page: import('@playwright/test').Page, list: CreatedWordlist) {
  await page.route('**/api/wordlist**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === 'GET' && url.includes('language=')) {
      const lang = url.includes('language=es') ? 'es' : 'en';
      return route.fulfill({ json: lang === 'es' ? [list] : [] });
    }
    if (method === 'POST' || method === 'DELETE') {
      const sep = url.includes('?') ? '&' : '?';
      return route.continue({ url: `${url}${sep}test_mode=true` });
    }
    return route.continue();
  });
}

/** The front-face word title (h3) for the nth card. */
function wordTitle(page: import('@playwright/test').Page, index: number) {
  return page.locator('[class*="wordCard"]').nth(index).locator('h3[class*="wordTitle"]');
}

/** The back-face translation / example-translation for the nth card (always in the DOM). */
function backTranslation(page: import('@playwright/test').Page, index: number) {
  return page.locator('[class*="wordCard"]').nth(index).locator('p[class*="wordTranslation"]');
}
function backExampleTranslation(page: import('@playwright/test').Page, index: number) {
  return page.locator('[class*="wordCard"]').nth(index).locator('p[class*="exampleTranslation"]');
}

test.describe('Wordlist editing', () => {
  test.describe.configure({ mode: 'serial' });

  test('renders cards with clean translations on both faces', async ({ page, wordlist }) => {
    await preferLanguage(page, 'es');
    await isolateWordlist(page, wordlist);
    await page.goto('/wordlist');
    await expect(page.locator('[class*="wordlist"] h2')).toContainText(wordlist.name);

    // Front face: word + example phrase
    await expect(wordTitle(page, 0)).toHaveText('gato');
    await expect(page.locator('[class*="wordCard"]').first().locator('div[class*="examplePhrase"] p')).toHaveText('El gato duerme en el sofá.');

    // Back face: clean deterministic translations, NOT a python repr (`word='...'`).
    await expect(backTranslation(page, 0)).toHaveText('[test:gato]');
    const translationText = await backTranslation(page, 0).innerText();
    expect(translationText).not.toContain("word='");
  });

  test('typing accumulates characters (no per-keystroke re-select)', async ({ page, wordlist }) => {
    // Regression: the focus+select effect must not re-run on every keystroke,
    // or each key replaces the previous and only the last char survives.
    await preferLanguage(page, 'es');
    await isolateWordlist(page, wordlist);
    await page.goto('/wordlist');
    await wordTitle(page, 0).click();
    const input = page.locator('input[class*="wordEditInput"]');
    await expect(input).toBeVisible();
    // The word is selected on focus; typing replaces it and must accumulate.
    await input.pressSequentially('gatos');
    await expect(input).toHaveValue('gatos');
  });

  test('editing a word bumps its version and retranslates only it', async ({ page, wordlist }) => {
    await preferLanguage(page, 'es');
    await isolateWordlist(page, wordlist);
    await page.goto('/wordlist');
    await expect(wordTitle(page, 0)).toHaveText('gato');

    await wordTitle(page, 0).click();
    const input = page.locator('input[class*="wordEditInput"]');
    await expect(input).toBeVisible();
    await input.fill('gatos');
    const post = page.waitForRequest(
      (r) => r.method() === 'POST' && new RegExp(`/api/wordlist/${wordlist.id}$`).test(r.url()),
    );
    await input.press('Enter');
    const req = await post;
    const body = req.postDataJSON();

    // Edited word: version 1, translations null. Other word: version 0, null.
    const gato = body.words.find((w: WordlistWord) => w.word === 'gatos' || w.id === wordlist.words[0].id);
    const perro = body.words.find((w: WordlistWord) => w.id === wordlist.words[1].id);
    expect(gato).toEqual(expect.objectContaining({ word: 'gatos', version: 1, word_translation: null, example_phrase_translation: null }));
    expect(perro).toEqual(expect.objectContaining({ word: 'perro', version: 0, word_translation: null, example_phrase_translation: null }));

    // example_phrase is preserved (not nulled) on a word edit.
    expect(gato.example_phrase).toBe('El gato duerme en el sofá.');

    // Real backend (test_mode): edited word retranslated; unchanged word keeps
    // its stored translation — proving unchanged words are NOT retranslated.
    await expect(backTranslation(page, 0)).toHaveText('[test:gatos]');
    await expect(backTranslation(page, 1)).toHaveText('[test:perro]');
  });

  test('editing the example phrase bumps version and preserves the word', async ({ page, wordlist }) => {
    await preferLanguage(page, 'es');
    await isolateWordlist(page, wordlist);
    await page.goto('/wordlist');
    const card = page.locator('[class*="wordCard"]').first();
    await expect(wordTitle(page, 0)).toHaveText('gato');

    await card.locator('div[class*="examplePhrase"]').click();
    const textarea = page.locator('textarea[class*="exampleEditInput"]');
    await expect(textarea).toBeVisible();
    await textarea.fill('El gato come pescado.');
    const post = page.waitForRequest(
      (r) => r.method() === 'POST' && new RegExp(`/api/wordlist/${wordlist.id}$`).test(r.url()),
    );
    await textarea.press('Control+Enter');
    const req = await post;
    const body = req.postDataJSON();

    const gato = body.words.find((w: WordlistWord) => w.id === wordlist.words[0].id);
    expect(gato).toEqual(expect.objectContaining({ word: 'gato', version: 1, example_phrase: 'El gato come pescado.', word_translation: null, example_phrase_translation: null }));

    // Front shows the new phrase; back shows the regenerated (real backend) translation.
    await expect(card.locator('div[class*="examplePhrase"] p')).toHaveText('El gato come pescado.');
    await expect(backExampleTranslation(page, 0)).toHaveText('[test:El gato come pescado.]');
  });

  test('deleting a word removes the card and syncs', async ({ page, wordlist }) => {
    await preferLanguage(page, 'es');
    await isolateWordlist(page, wordlist);
    await page.goto('/wordlist');
    await expect(page.locator('h3[class*="wordTitle"]')).toHaveCount(2);

    const post = page.waitForRequest(
      (r) => r.method() === 'POST' && new RegExp(`/api/wordlist/${wordlist.id}$`).test(r.url()),
    );
    await page.locator('[class*="wordCard"]').first().locator('[class*="deleteButton"]').click();
    const req = await post;
    const body = req.postDataJSON();
    // The deleted word is gone from the payload; the other word remains.
    expect(body.words.map((w: WordlistWord) => w.word)).toEqual(['perro']);
    await expect(page.locator('h3[class*="wordTitle"]')).toHaveCount(1);
  });
});

test.describe('Wordlist naming from homework', () => {
  test('creating a list from homework uses the homework (Note) name', async ({ page, homeworkNote }) => {
    // Mock the wordlist create endpoint to capture the requested name (the
    // frontend create call has no test_mode; mocking avoids AI + DB pollution).
    let capturedName: string | undefined;
    await page.route('**/api/wordlist**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (method === 'GET') return route.fulfill({ json: [] });
      if (method === 'POST' && !/\/wordlist\/\d+/.test(url)) {
        const body = route.request().postDataJSON();
        capturedName = body.name;
        return route.fulfill({
          json: {
            id: 4242,
            name: body.name,
            language: body.language,
            words: body.words.map((w: WordlistWord) => ({
              ...w,
              word_translation: `${w.word} (t)`,
              example_phrase_translation: `${w.example_phrase ?? ''} (t)`,
            })),
          },
        });
      }
      return route.continue();
    });

    await page.goto(`/homework/${homeworkNote.id}`);
    await page.waitForLoadState('networkidle');
    const editor = page.locator('.hw-editor-content');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Select a word in the draft and open the toolbar's "create new list" action.
    await selectWordAndShowToolbar(page, 'weekend');
    const toolbar = page.locator('.hw-selection-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 3000 });

    // Open the dropdown (the word isn't in any list → "a" add button), then
    // click "Create new list".
    await page.locator('.hw-selection-toolbar-add').first().click();
    const newList = page.locator('.hw-selection-toolbar-new-list').first();
    await expect(newList).toBeVisible({ timeout: 3000 });

    const post = page.waitForRequest(
      (r) => r.method() === 'POST' && /\/api\/wordlist/.test(r.url()) && !/\/wordlist\/\d+/.test(r.url()),
    );
    await newList.click();
    await post;

    // The created wordlist is named after the homework note, not "Word List <date>".
    expect(capturedName).toBeTruthy();
    expect(capturedName).toBe(homeworkNote.name);
    expect(capturedName).not.toMatch(/^Word List/);
  });
});

// ---------------------------------------------------------------------------
// Helper (kept local to avoid changing fixtures.ts exports for one consumer)
// ---------------------------------------------------------------------------

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
    editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, word);
  await page.waitForTimeout(200);
}