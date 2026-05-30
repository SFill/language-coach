import { test, expect } from '@playwright/test';

test.describe('Layout checks', () => {
  test('no horizontal overflow on homework page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test('sidebar is visible', async ({ page }) => {
    await page.goto('/homework');
    await page.waitForLoadState('networkidle');
    const sidebar = page.locator('.hw-sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('main content area renders', async ({ page }) => {
    await page.goto('/homework');
    await page.waitForLoadState('networkidle');
    const main = page.locator('.hw-page').first();
    await expect(main).toBeVisible();
  });

  test('viewport matches config (1920x1280)', async ({ page }) => {
    const size = page.viewportSize();
    expect(size).toEqual({ width: 1920, height: 1280 });
  });
});