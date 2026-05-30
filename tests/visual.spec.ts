import { test, expect } from '@playwright/test';

test.describe('Visual regression', () => {
  test('home page matches baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('home.png');
  });

  test('notelist page matches baseline', async ({ page }) => {
    await page.goto('/notelist');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('notelist.png');
  });

  test('wordlist page matches baseline', async ({ page }) => {
    await page.goto('/wordlist');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('wordlist.png');
  });
});