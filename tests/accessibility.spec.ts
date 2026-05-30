import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('homework page has no axe violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Inject axe-core
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    const results = await page.evaluate(() => (window as any).axe.run());
    const violations = results.violations.filter(
      (v: any) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(violations, `Found ${violations.length} serious/critical a11y violations`).toEqual([]);
  });

  test('page has a valid heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
    expect(headings.length, 'Page should have at least one heading').toBeGreaterThan(0);
  });

  test('images have alt text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt, 'All images should have alt text').toBe(0);
  });
});