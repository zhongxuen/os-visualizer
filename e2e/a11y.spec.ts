import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { freePlay, ROUTES, useTheme, type Theme } from './routes';

/**
 * axe-core on every route, in the light and the dark theme, and on module routes in both
 * Walkthrough and Free play. WCAG 2.1 A and AA rules; any violation fails, whatever its
 * impact, the same bar the per-module specs hold.
 *
 * Axe cannot see whether a page is usable from the keyboard: that is
 * `keyboard.spec.ts`. It also does not check heading structure at the WCAG level, so
 * that is asserted here directly: exactly one h1, and no level skipped on the way down.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const found = results.violations.map(
    (v) =>
      `[${v.impact}] ${v.id}: ${v.help}\n${v.nodes
        .slice(0, 4)
        .map((n) => `    - ${JSON.stringify(n.target)}`)
        .join('\n')}`,
  );
  expect(found, `${where} has axe violations:\n${found.join('\n')}`).toEqual([]);
}

async function expectSaneHeadings(page: Page, where: string) {
  const headings = await page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .filter((el) => el.closest('[aria-hidden="true"]') === null)
      .map((el) => ({
        level: Number(el.tagName[1]),
        text: (el.textContent ?? '').trim().slice(0, 60),
      })),
  );
  expect(
    headings.filter((h) => h.level === 1),
    `${where} should have one h1`,
  ).toHaveLength(1);
  const skips = headings.flatMap((h, i) => {
    const previous = headings[i - 1];
    return previous && h.level > previous.level + 1
      ? [`h${previous.level} -> h${h.level} at "${h.text}"`]
      : [];
  });
  expect(skips, `${where} skips a heading level`).toEqual([]);
}

const THEMES: readonly Theme[] = ['light', 'dark'];

for (const route of ROUTES) {
  for (const theme of THEMES) {
    test(`${route.name} (${route.path}), ${theme}: axe clean`, async ({ page }) => {
      await useTheme(page, theme);
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const where = `${route.path} (${theme}${route.module ? ', walkthrough' : ''})`;
      await scan(page, where);
      await expectSaneHeadings(page, where);

      if (route.module) {
        // Every part of the lesson, not only the first.
        const next = page.getByRole('button', { name: 'Next part' });
        for (let part = 2; await next.isEnabled(); part += 1) {
          await next.click();
          await expect(
            page.getByText(new RegExp(`^Part ${part} of [0-9]+ ·`)),
          ).toBeVisible();
          await scan(page, `${where}, part ${part}`);
          await expectSaneHeadings(page, `${where}, part ${part}`);
        }
        await freePlay(page);
        await scan(page, `${route.path} (${theme}, free play)`);
        await expectSaneHeadings(page, `${route.path} (${theme}, free play)`);
      }
    });
  }
}

test('/demo is not indexed and is not in the sitemap', async ({ page, request }) => {
  await page.goto('/demo');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain('/demo');
  for (const route of ROUTES.filter((r) => r.path !== '/no-such-page')) {
    expect(sitemap).toContain(`<loc>http`);
    expect(sitemap, route.path).toMatch(
      new RegExp(`<loc>[^<]*${route.path === '/' ? '/?' : route.path}</loc>`),
    );
  }
});

test('every module route has its own Open Graph image', async ({ page, request }) => {
  for (const route of ROUTES.filter((r) => r.module)) {
    await page.goto(route.path);
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image, route.path).toContain(`${route.path}/opengraph-image`);
    const response = await request.get(new URL(image!).pathname + new URL(image!).search);
    expect(response.status(), route.path).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  }
});
