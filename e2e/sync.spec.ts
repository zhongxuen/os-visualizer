import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { freePlay, useTheme, type Theme } from './routes';

/**
 * /sync (docs/UIUX.md §2.3 Y1-Y2, §3 B6, §7.2.6): thread keys A/B/C, the lost update
 * struck through, screenshots at 1366 and 390 px in both themes with axe, a keyboard-only
 * walk, and no running animation after a forward step under reduced motion.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const THEMES: readonly Theme[] = ['light', 'dark'];

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

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

/** Open /sync and wait for hydration (the first-visit mode is recorded). */
async function openSync(page: Page) {
  await page.goto('/sync');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Synchronisation');
  await page.waitForLoadState('networkidle');
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('osv:v1') ?? ''))
    .toContain('moduleModes');
}

test('sync: find a lost update with the keyboard, then the mutex leaves one outcome', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await openSync(page);

  // Keyboard only: reach "Clear picks", press it, then pick threads with A and B.
  const clear = page.getByRole('button', { name: 'Clear picks' });
  await expect(async () => {
    await clear.focus();
    await expect(clear).toBeFocused({ timeout: 500 });
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('trace')).toHaveText('nothing yet', { timeout: 500 });
  }).toPass();

  // T0 loads and adds; T1 runs its whole increment; T0 stores its stale value.
  for (const key of ['a', 'a', 'b', 'b', 'b', 'a']) await page.keyboard.press(key);
  await expect(page.getByTestId('trace')).toHaveText('T0 T0 T1 T1 T1 T0');
  await expect(page.getByTestId('var-counter')).toHaveText('1');
  await expect(page.getByTestId('run-verdict')).toContainText('1 update was lost');

  // The lost update is struck through (Y2).
  const lost = page.getByTestId('lost-counter');
  await expect(lost).toContainText('lost update');
  await expect(lost.locator('del')).toHaveText(/1/);
  const decoration = await lost
    .locator('del')
    .evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(decoration).toContain('line-through');

  // 1 to 5 set the speed again; they no longer pick threads (B6).
  await page.keyboard.press('Home');
  await page.keyboard.press('1');
  await page.keyboard.press('End');
  await expect(page.getByTestId('trace')).toHaveText('T0 T0 T1 T1 T1 T0');

  // The same picks survive a reload through the link.
  await expect.poll(() => new URL(page.url()).searchParams.get('s') !== null).toBe(true);
  await page.reload();
  await expect(page.getByTestId('trace')).toHaveText('T0 T0 T1 T1 T1 T0');

  // Load the mutex preset from the keyboard: one outcome for every interleaving.
  const preset = page.getByLabel('Preset', { exact: true });
  await preset.focus();
  await preset.selectOption('counter-mutex');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Load preset' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('outcome-summary')).toHaveText(
    '2 interleavings: 2 give counter = 2.',
  );
  await expect(
    page.getByRole('list', { name: 'Outcomes' }).getByRole('listitem'),
  ).toHaveCount(1);

  await expectAxeClean(page, '/sync');
  expect(errors).toEqual([]);
});

test('sync: a seeded random schedule replays from the URL', async ({ page }) => {
  await openSync(page);
  await page.getByText('Change who picks').click();
  await expect(async () => {
    await page.getByRole('radio', { name: 'Seeded random' }).check();
    await expect(page.getByRole('textbox', { name: 'Seed' })).toBeVisible({
      timeout: 500,
    });
  }).toPass();
  await page.getByRole('textbox', { name: 'Seed' }).fill('7');
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('End');
  const trace = await page.getByTestId('trace').textContent();
  expect(trace).toMatch(/^T[01]( T[01])*$/);
  await expect
    .poll(() => {
      const s = new URL(page.url()).searchParams.get('s');
      if (!s) return null;
      return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')).input.schedule;
    })
    .toEqual({ kind: 'random', seed: 7 });

  const url = page.url();
  await page.goto('about:blank');
  await page.goto(url);
  await page.getByText('Change who picks').click();
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('7');
  await expect(page.getByTestId('trace')).toHaveText(trace!);
});

for (const size of [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'phone', width: 390, height: 844 },
] as const) {
  test.describe(`sync at ${size.width} px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const theme of THEMES) {
      test(`screenshots and axe, Guided and Sandbox (${theme})`, async ({
        page,
      }, testInfo) => {
        await useTheme(page, theme);
        await openSync(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await screenshot(page, testInfo, `sync-${size.name}-${theme}-guided`);
        await expectAxeClean(page, `/sync ${size.name} ${theme} Guided`);

        await freePlay(page);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.keyboard.press('End');
        await expect(page.getByTestId('lost-counter')).toBeAttached();
        await screenshot(page, testInfo, `sync-${size.name}-${theme}-sandbox-end`);
        await expectAxeClean(page, `/sync ${size.name} ${theme} Sandbox, end`);

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}

test.describe('sync keyboard walk', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('build a schedule, play, step and read the result, keyboard only', async ({
    page,
  }) => {
    await openSync(page);
    await freePlay(page);

    // Build: the race preset, then a schedule of our own with A and B.
    const preset = page.getByLabel('Preset', { exact: true });
    await preset.focus();
    await preset.selectOption('counter-race');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    const clear = page.getByRole('button', { name: 'Clear picks' });
    await clear.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('trace')).toHaveText('nothing yet');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (const key of ['a', 'b', 'a', 'b', 'a', 'b']) await page.keyboard.press(key);
    await expect(page.getByTestId('trace')).toHaveText('T0 T1 T0 T1 T0 T1');

    // Play from the start to the end with Space.
    await page.keyboard.press('Home');
    await page.keyboard.press('5');
    await page.keyboard.press(' ');
    await expect(page.getByRole('region', { name: 'End of the run' })).toBeVisible({
      timeout: 15_000,
    });

    // Step back and forward.
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('lost-counter')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('lost-counter')).toContainText('lost update');

    // Read the result, then take "Try this next" from the keyboard.
    await expect(page.getByTestId('run-verdict')).toContainText('1 update was lost');
    const tryNext = page.getByRole('button', { name: 'Counter with a mutex' });
    await tryNext.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('outcome-summary')).toHaveText(
      '2 interleavings: 2 give counter = 2.',
    );
  });

  test('the shortcuts sheet lists the thread keys', async ({ page }) => {
    await openSync(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('?');
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('Run thread T0, T1 or T2 next');
  });
});

test('sync: under reduced motion a forward step leaves nothing animating', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSync(page);
  await freePlay(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  const running = await page.evaluate(
    () => document.getAnimations().filter((a) => a.playState === 'running').length,
  );
  expect(running).toBe(0);
});
