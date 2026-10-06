import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { useTheme, type Theme } from './routes';

/**
 * /about (docs/UIUX.md §2.4 A1, §4.1): "What this means for you" first, then the model
 * (the `#model` anchor the workspace header links to), accuracy, sources and credits,
 * with a sticky table of contents on desktop. axe in both themes.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('/about reads "what this means for you" first, then the model', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 850 });
  await page.goto('/about');

  const sections = await page
    .locator('main section > h2')
    .evaluateAll((els) => els.map((e) => e.id));
  expect(sections).toEqual(['for-you', 'model', 'accuracy', 'sources', 'credits']);
  await expect(page.locator('#for-you')).toHaveText('What this means for you');
  await expect(
    page.getByText('The numbers match your textbook, not your laptop.', { exact: true }),
  ).toBeVisible();

  // The conventions are still read from each module's rules.
  await expect(page.locator('#conventions-sched summary')).toContainText('rules)');

  // The table of contents stays on screen while the page scrolls.
  const toc = page.getByRole('navigation', { name: 'On this page' });
  await expect(toc).toBeVisible();
  await page.locator('#credits').scrollIntoViewIfNeeded();
  await expect(toc).toBeInViewport();
  await toc.getByRole('link', { name: 'How accuracy is checked' }).click();
  await expect(page).toHaveURL(/#accuracy$/);
  await expect(page.locator('#accuracy')).toBeInViewport();
});

test('the workspace header link lands on #model', async ({ page }) => {
  await page.goto('/scheduling');
  await page.getByRole('link', { name: 'What that means' }).click();
  await expect(page).toHaveURL(/\/about#model$/);
  await expect(page.locator('#model')).toBeInViewport();
});

test('on a phone the contents sit at the top instead', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about');
  const toc = page.getByRole('navigation', { name: 'On this page' });
  await expect(toc).toBeVisible();
  const [tocBox, firstBox] = await Promise.all([
    toc.boundingBox(),
    page.locator('#for-you').boundingBox(),
  ]);
  expect(tocBox!.y).toBeLessThan(firstBox!.y);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});

const THEMES: readonly Theme[] = ['light', 'dark'];

for (const theme of THEMES) {
  test(`/about, ${theme}: axe clean`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    // Every conventions group open, so their contents are scanned too.
    await page
      .locator('details')
      .evaluateAll((els) =>
        els.forEach((el) => ((el as HTMLDetailsElement).open = true)),
      );
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const found = results.violations.map(
      (v) => `[${v.impact}] ${v.id}: ${v.help} ${JSON.stringify(v.nodes[0]?.target)}`,
    );
    expect(found, `/about (${theme}):\n${found.join('\n')}`).toEqual([]);
  });
}
