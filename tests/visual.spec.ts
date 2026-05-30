import { test, expect } from '@playwright/test';

test.describe('Visual regression', () => {
  test('homework page matches baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('homework.png');
  });
});