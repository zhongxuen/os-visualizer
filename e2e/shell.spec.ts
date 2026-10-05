import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { MODULES } from '../src/modules/registry';

import { ROUTES, useTheme, type Theme } from './routes';

/**
 * The site shell (docs/UIUX.md U1.2): the header's controls are all reachable from the
 * keyboard, its menus open and are axe clean, the phone layout never scrolls sideways,
 * and an unknown URL gets the shell's 404 with the module list. axe on `/`, `/about`
 * and the 404 in both themes is `a11y.spec.ts`, which scans every route in ROUTES.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** axe on the header and any open panel only: the page under them is a11y.spec.ts's. */
async function expectAxeClean(page: Page, where: string) {
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    .include('header')
    .include('[popover]:popover-open')
    .include('dialog[open]')
    .analyze();
  const found = results.violations.map(
    (v) => `${v.id}: ${v.help} ${v.nodes.map((n) => JSON.stringify(n.target)).join(' ')}`,
  );
  expect(found, `${where} has axe violations`).toEqual([]);
}

/** Retry until React has hydrated: before that a click does nothing. */
async function openPopover(page: Page, name: string) {
  const trigger = page.getByRole('button', { name, exact: true });
  await expect(async () => {
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 500 });
  }).toPass();
}

const HEADER_CONTROLS = [
  'Skip to content',
  'OS Visualizer',
  'Modules',
  'Learn',
  'About',
  'System',
  'Light',
  'Dark',
  'Keyboard shortcuts',
];

test('keyboard: Tab reaches every header control, in order', async ({ page }) => {
  await page.goto('/');
  const reached: string[] = [];
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  for (let i = 0; i < 30; i += 1) {
    const name = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el?.closest('header')) return null;
      return el.getAttribute('aria-label') ?? (el.textContent ?? '').trim();
    });
    if (name === null) break;
    reached.push(name);
    await page.keyboard.press('Tab');
  }
  expect(reached).toEqual(HEADER_CONTROLS);
});

test('keyboard: the Modules menu opens with Enter and lists every module', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Modules', exact: true });
  await expect(async () => {
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 500 });
  }).toPass();

  const menu = page.getByRole('navigation', { name: 'Modules' });
  for (const m of MODULES) {
    const status = m.status === 'ready' ? 'Ready' : 'Coming later';
    await expect(menu.getByText(m.title, { exact: true })).toBeVisible();
    await expect(menu.getByRole('listitem').filter({ hasText: m.title })).toContainText(
      status,
    );
  }
  await expect(menu).not.toContainText(/phase/i);
  await expectAxeClean(page, 'Modules menu');

  await page.keyboard.press('Tab');
  await expect(menu.getByRole('link').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${MODULES[0]!.route}$`));
  await expect(menu).toBeHidden();

  await page.keyboard.press('Escape');
});

test('keyboard help opens the shortcut legend, and the shared action opens it too', async ({
  page,
}) => {
  await page.goto('/');
  await openPopover(page, 'Keyboard shortcuts');
  const panel = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(panel).toContainText('Play or pause');
  await expectAxeClean(page, 'Keyboard shortcuts');

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.getByRole('button', { name: 'Keyboard shortcuts' })).toBeFocused();

  await page.evaluate(() => window.dispatchEvent(new Event('osv:shortcuts')));
  await expect(panel).toBeVisible();
});

test('/demo is not linked from the header or footer', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.locator('header a[href="/demo"], footer a[href="/demo"]'),
  ).toHaveCount(0);
});

test('footer: series links, source, honesty line and /about', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Internet Visualizer' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Crypto Visualizer' })).toBeVisible();
  await expect(footer.getByRole('link', { name: /GitHub/ })).toBeVisible();
  await expect(footer).toContainText('not a real kernel');
  await expect(footer.getByRole('link', { name: /About/ })).toHaveAttribute(
    'href',
    '/about',
  );
});

test('404: inside the shell, with the module list and a /learn link', async ({
  page,
}) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'That page isn’t here',
  );
  const main = page.getByRole('main');
  for (const m of MODULES.filter((x) => x.status === 'ready')) {
    await expect(main.getByRole('link', { name: m.title, exact: true })).toHaveAttribute(
      'href',
      m.route,
    );
  }
  await expect(main.getByRole('link', { name: 'learning path' })).toHaveAttribute(
    'href',
    '/learn',
  );
});

test.describe('phone, 375 px', () => {
  test.use({ viewport: { width: 375, height: 740 } });

  for (const route of ROUTES) {
    test(`${route.path}: no horizontal scroll`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  const THEMES: readonly Theme[] = ['light', 'dark'];
  for (const theme of THEMES) {
    test(`menu sheet opens, lists everything and is axe clean (${theme})`, async ({
      page,
    }) => {
      await useTheme(page, theme);
      await page.goto('/');
      await expect(
        page.getByRole('button', { name: 'Modules', exact: true }),
      ).toBeHidden();
      await openPopover(page, 'Menu');
      const sheet = page.getByRole('dialog', { name: 'Menu' });
      for (const m of MODULES) {
        await expect(sheet.getByText(m.title, { exact: true })).toBeVisible();
      }
      await expect(sheet.getByRole('link', { name: 'Learn' })).toBeVisible();
      await expect(sheet.getByRole('link', { name: 'About' })).toBeVisible();
      await expect(sheet.getByRole('group', { name: 'Colour theme' })).toBeVisible();
      await expectAxeClean(page, `menu sheet (${theme})`);

      await sheet.getByRole('link', { name: 'Learn' }).click();
      await expect(page).toHaveURL(/\/learn$/);
      await expect(sheet).toBeHidden();
    });
  }
});
