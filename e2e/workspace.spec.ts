import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { useTheme, type Theme } from './routes';

/**
 * The module workspace (docs/UIUX.md §4.3, U2.1) on /demo, which drives it with a fake
 * run, at its three sizes: desktop (1366), tablet (800) and phone (390). Screenshots of
 * each, axe in both themes, and a keyboard-only walk through every workspace control:
 * the mode switch, Copy link, Focus mode and `F`, the Setup drawer, the phone tabs,
 * Play switching to Watch, the shortcuts sheet and `?`, the Rule used chip and the
 * end-of-run card. B11 (the transport hides while a text field has focus) is checked
 * on /scheduling, which has text fields.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const THEMES: readonly Theme[] = ['light', 'dark'];
const MODE_SANDBOX = /Build your own input/;

const SIZES = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'tablet', width: 800, height: 1000 },
  { name: 'phone', width: 390, height: 844 },
] as const;

async function expectAxeClean(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const found = results.violations.map(
    (v) =>
      `[${v.impact}] ${v.id}: ${v.help} ${v.nodes
        .slice(0, 4)
        .map((n) => JSON.stringify(n.target))
        .join(' ')}`,
  );
  expect(found, `${where} has axe violations:\n${found.join('\n')}`).toEqual([]);
}

/** Wait until React has hydrated: the mode switch then reflects the stored visit. */
async function openDemo(page: Page) {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Component demo');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-workspace]')).toBeVisible();
  // Hydrated once the first-visit mode has been recorded.
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('osv:v1') ?? ''))
    .toContain('moduleModes');
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

for (const size of SIZES) {
  test.describe(`${size.name}, ${size.width} px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const theme of THEMES) {
      test(`screenshot and axe (${theme})`, async ({ page }, testInfo) => {
        await useTheme(page, theme);
        await openDemo(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await screenshot(page, testInfo, `workspace-${size.name}-${theme}`);
        await expectAxeClean(page, `/demo ${size.name} ${theme}`);

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);

        // The run's end, with the end-of-run card on screen.
        await page.keyboard.press('End');
        if (size.name === 'phone') {
          await page.getByRole('tab', { name: 'Results' }).click();
        }
        await expect(page.getByRole('region', { name: 'End of the run' })).toBeVisible();
        await screenshot(page, testInfo, `workspace-${size.name}-${theme}-end`);
        await expectAxeClean(page, `/demo ${size.name} ${theme}, end of run`);
      });
    }
  });
}

test.describe('desktop keyboard walk', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('every workspace control works from the keyboard', async ({ page, context }) => {
    await context
      .grantPermissions(['clipboard-read', 'clipboard-write'])
      .catch(() => undefined);
    await openDemo(page);

    // Three columns.
    const setup = page.getByRole('region', { name: 'Setup' });
    const visual = page.getByRole('region', { name: 'Visualisation' });
    const inspector = page.getByRole('region', { name: 'Inspector' });
    await expect(setup).toBeVisible();
    const [s, v, i] = await Promise.all([
      setup.boundingBox(),
      visual.boundingBox(),
      inspector.boundingBox(),
    ]);
    expect(s!.x).toBeLessThan(v!.x);
    expect(v!.x).toBeLessThan(i!.x);
    await expect(page.getByRole('tablist', { name: 'Workspace' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Setup', exact: true })).toBeHidden();

    // Guided on the first visit; the arrow key switches to Sandbox.
    const guided = page.getByRole('radio', { name: 'Guided' });
    await expect(guided).toBeChecked();
    await guided.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Sandbox' })).toBeChecked();
    await expect(page.getByText(MODE_SANDBOX)).toBeVisible();

    // Copy link.
    const copy = page.getByRole('button', { name: 'Copy link to this page' });
    await copy.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-share-control] [role="status"]')).toHaveText(
      /Link copied|address bar/,
    );

    // Focus mode: the button, then F.
    const focusMode = page.getByRole('button', { name: 'Focus mode' });
    await focusMode.focus();
    await page.keyboard.press('Enter');
    await expect(focusMode).toHaveAttribute('aria-pressed', 'true');
    await expect(setup).toBeHidden();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('f');
    await expect(setup).toBeVisible();
    await expect(focusMode).toHaveAttribute('aria-pressed', 'false');

    // ? opens the shortcuts sheet with every group; Escape closes it.
    await page.keyboard.press('?');
    const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Play or pause');
    await expect(sheet).toContainText('Focus mode');
    await expect(sheet).toContainText('Demo only: a module key');
    await expectAxeClean(page, 'shortcuts sheet');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // The header's keyboard button opens the same sheet, and focus comes back to it.
    const help = page
      .locator('header')
      .getByRole('button', { name: 'Keyboard shortcuts' });
    await help.focus();
    await page.keyboard.press('Enter');
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toBeFocused();

    // Step to the first dispatch: the Rule used chip goes to the highlighted rule.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    const chip = page.locator('[data-rule-chip]');
    await expect(chip).toBeVisible();
    await chip.focus();
    await page.keyboard.press('Enter');
    const rule = page.locator('[data-rule="demo.fcfs.order"]');
    await expect(rule).toBeFocused();
    await expect(rule).toContainText('Used on this step');

    // The end of the run: the card, "Try this next", Play again.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('End');
    const card = page.getByRole('region', { name: 'End of the run' });
    await expect(card).toBeVisible();
    await expect(
      card.getByRole('link', { name: 'Back to the learning path' }),
    ).toBeVisible();
    const tryNext = card.getByRole('button', { name: 'The same run, read in steps' });
    await tryNext.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('slider', { name: 'Playback position' })).toHaveAttribute(
      'aria-valuetext',
      /^step 1 of/,
    );
    await expect(card).toBeHidden();
  });

  test('a forward step animates the inspector; a step back is instant', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openDemo(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const running = () =>
      page.evaluate(
        () =>
          document
            .querySelector('[aria-label="Inspector"]')
            ?.getAnimations({ subtree: true })
            .filter((a) => a.playState === 'running').length ?? 0,
      );
    await page.keyboard.press('ArrowRight');
    await expect.poll(running, { timeout: 2000, intervals: [10] }).toBeGreaterThan(0);
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    expect(await running()).toBe(0);
  });
});

test.describe('tablet keyboard walk', () => {
  test.use({ viewport: { width: 800, height: 1000 } });

  test('Setup is a drawer: Enter opens it with focus inside, Escape closes it', async ({
    page,
  }) => {
    await openDemo(page);
    const setup = page.getByRole('region', { name: 'Setup' });
    await expect(setup).toBeHidden();
    await expect(page.getByRole('button', { name: 'Focus mode' })).toBeHidden();

    // The inspector sits under the visual.
    const visual = await page
      .getByRole('region', { name: 'Visualisation' })
      .boundingBox();
    const inspector = await page.getByRole('region', { name: 'Inspector' }).boundingBox();
    expect(inspector!.y).toBeGreaterThan(visual!.y);

    const button = page.getByRole('button', { name: 'Setup', exact: true });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(setup).toBeVisible();
    await expect(setup).toBeFocused();
    await expectAxeClean(page, 'setup drawer');

    await page.keyboard.press('Tab');
    await expect(setup.getByRole('button', { name: 'Close setup' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(setup).toBeHidden();
    await expect(button).toBeFocused();
  });
});

test.describe('phone keyboard walk', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Setup / Watch / Results tabs, and Play switches to Watch', async ({ page }) => {
    await openDemo(page);
    const tabs = page.getByRole('tablist', { name: 'Workspace' });
    const watch = tabs.getByRole('tab', { name: 'Watch' });
    await expect(watch).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Watch' })).toBeVisible();

    await watch.focus();
    await page.keyboard.press('ArrowLeft');
    const setupTab = tabs.getByRole('tab', { name: 'Setup' });
    await expect(setupTab).toBeFocused();
    await expect(setupTab).toHaveAttribute('aria-selected', 'true');
    const setup = page.getByRole('tabpanel', { name: 'Setup' });
    await expect(setup).toBeVisible();
    await expect(page.getByRole('region', { name: 'Visualisation' })).toBeHidden();

    // The transport is still there, not pinned; Play from Setup goes to Watch.
    const play = page.locator('[data-transport-play]');
    await play.focus();
    await page.keyboard.press('Enter');
    await expect(watch).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: 'Visualisation' })).toBeVisible();
    await page.keyboard.press('Enter');

    await setupTab.focus();
    await page.keyboard.press('End');
    await expect(tabs.getByRole('tab', { name: 'Results' })).toBeFocused();
    await expect(page.getByRole('tabpanel', { name: 'Results' })).toBeVisible();
    await expectAxeClean(page, 'phone, Results tab');
  });

  test('the transport hides while a text field has focus (B11)', async ({ page }) => {
    await page.goto('/scheduling');
    await page.waitForLoadState('networkidle');
    const playback = page.getByRole('region', { name: 'Playback' });
    await expect(playback).toBeVisible();

    const setupTab = page.getByRole('tab', { name: 'Setup' });
    await expect(async () => {
      await setupTab.click();
      await expect(setupTab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
    }).toPass();
    const field = page
      .getByRole('tabpanel', { name: 'Setup' })
      .locator('input[type="text"]')
      .first();
    await field.focus();
    await expect(playback).toBeHidden();
    await field.blur();
    await expect(playback).toBeVisible();
  });
});
