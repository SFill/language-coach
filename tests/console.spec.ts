import { test, expect } from '@playwright/test';

/** Errors to ignore — backend not running, browser extensions, etc. */
const IGNORE_PATTERNS = [
  /React DevTools/,
  /Download the React DevTools/,
  /ERR_CONNECTION_REFUSED/,
  /Error fetching notes:/,
  /Error fetching wordlists:/,
  /Failed to load resource/,
];

function isRealError(msg: string): boolean {
  return !IGNORE_PATTERNS.some((pattern) => pattern.test(msg));
}

test.describe('Console errors', () => {
  test('no console errors on homework page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const realErrors = errors.filter(isRealError);

    expect(realErrors, `Console errors found: ${realErrors.join('\n')}`).toEqual([]);
  });
});