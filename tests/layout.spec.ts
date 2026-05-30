import { test, expect } from '@playwright/test';

test.describe('Layout checks', () => {
  test('no horizontal overflow on home', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test('navbar is visible and has links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const navbar = page.locator('.navbar');
    await expect(navbar).toBeVisible();
    const links = navbar.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test('main content area renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const main = page.locator('.main-container, .main-block, .page').first();
    await expect(main).toBeVisible();
  });

  test('viewport matches config (1920x1280)', async ({ page }) => {
    const size = page.viewportSize();
    expect(size).toEqual({ width: 1920, height: 1280 });
  });
});