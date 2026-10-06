import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { freePlay, useTheme, type Theme } from './routes';

/**
 * CPU Scheduling after U3.1 (docs/UIUX.md §2.3 S1-S8, §7.2.1): screenshots at 1366 and
 * 390 px in both themes with axe; the brackets on a metrics-row hover (S3); linked
 * highlighting (S4); 300 ticks fitting a phone and following the cursor when zoomed
 * (S6); a keyboard-only walk that builds an input, plays, steps and reads the result;
 * and the reduced-motion check that a forward step leaves nothing animating.
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

/** Open /scheduling in Sandbox, hydrated. */
async function open(page: Page) {
  await page.goto('/scheduling');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CPU Scheduling');
  await freePlay(page);
}

/** Load a preset, retrying until hydrated. */
async function loadPreset(page: Page, id: string, title: string) {
  await expect(async () => {
    await page.getByLabel('Preset', { exact: true }).selectOption(id);
    await page.getByRole('button', { name: 'Load preset' }).click();
    await expect(page.getByText(`Loaded preset: ${title}`)).toBeVisible({ timeout: 500 });
  }).toPass();
}

async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

for (const size of [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'phone', width: 390, height: 844 },
] as const) {
  test.describe(`${size.name}, ${size.width} px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const theme of THEMES) {
      test(`screenshots and axe (${theme})`, async ({ page }, testInfo) => {
        await useTheme(page, theme);
        await open(page);
        if (size.name === 'phone') {
          await page.getByRole('tab', { name: 'Setup' }).click();
        }
        await loadPreset(page, 'osc-rr', 'OSC10 Round Robin, q = 4');
        if (size.name === 'phone') await page.getByRole('tab', { name: 'Watch' }).click();
        await blur(page);
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await screenshot(page, testInfo, `scheduling-${size.name}-${theme}`);
        await expectAxeClean(page, `/scheduling ${size.name} ${theme}`);

        await page.keyboard.press('End');
        if (size.name === 'phone') {
          await page.getByRole('tab', { name: 'Results' }).click();
        }
        await expect(page.getByRole('region', { name: 'End of the run' })).toBeVisible();
        await screenshot(page, testInfo, `scheduling-${size.name}-${theme}-end`);
        await expectAxeClean(page, `/scheduling ${size.name} ${theme}, end of run`);

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('hovering a metrics row draws its brackets; highlighting is linked (S3, S4)', async ({
    page,
  }) => {
    await open(page);
    await loadPreset(page, 'osc-sjf', 'OSC10 SJF (6, 8, 7, 3)');
    await blur(page);
    await page.keyboard.press('End');

    const table = page.getByRole('table', { name: /Per process/ });
    await table.getByRole('row', { name: /^P2/ }).hover();
    const brackets = page.locator('[data-brackets="2"]');
    await expect(brackets.locator('[data-bracket="response"]')).toHaveText('response 16');
    await expect(brackets.locator('[data-bracket="turnaround"]')).toHaveText(
      'turnaround 24',
    );
    await expect(page.locator('[data-waiting]').first()).toBeVisible();

    // Linked: the Gantt bar, the editor's form and the queue chip all mark P2.
    await expect(page.locator('g[data-pid="2"][data-highlight]')).toHaveCount(1);
    await expect(page.locator('fieldset[data-pid="P2"][data-highlight]')).toHaveCount(1);
    await expect(page.locator('span[data-pid="2"][data-highlight]')).toHaveCount(1);

    // Hovering the Gantt bar of P4 moves the highlight to P4 everywhere.
    await page.locator('g[data-pid="4"]').first().hover();
    await expect(page.locator('fieldset[data-pid="P4"][data-highlight]')).toHaveCount(1);
    await expect(table.locator('tr[data-row="P4"][data-highlight]')).toHaveCount(1);
  });

  test('keyboard only: build an input, play, step and read the result', async ({
    page,
  }) => {
    await open(page);
    // Build: load FCFS (24, 3, 3), add P4, and give it CPU 3, I/O 2, CPU 3.
    await expect(async () => {
      const preset = page.getByLabel('Preset', { exact: true });
      await preset.focus();
      await preset.selectOption('osc-fcfs');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await expect(page.getByText('Loaded preset: OSC10 FCFS (24, 3, 3)')).toBeVisible({
        timeout: 500,
      });
    }).toPass();
    await page.getByRole('button', { name: 'Add process' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Add an I/O burst to P4' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/the last one must be a CPU burst/)).toBeVisible();
    await page.getByRole('button', { name: 'Add a CPU burst to P4' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('P4 CPU burst 2 (ticks)')).toHaveValue('3');

    // Play, pause, step.
    const play = page.locator('[data-transport-play]');
    await play.focus();
    await page.keyboard.press('Enter');
    await expect(play).toHaveAccessibleName('Pause');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await blur(page);
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await expect(
      page.getByRole('heading', { name: 'At t = 1', exact: true }),
    ).toBeVisible();

    // Read: FCFS waits 0, 24, 27 and 30 (P4 idles through its I/O): average 20.25.
    await page.keyboard.press('End');
    await expect(page.getByTestId('avg-waiting')).toHaveText('20.25');
    await expect(page.getByText(/FCFS: average waiting 20.25 ticks/)).toBeVisible();

    // A focused metrics row draws its brackets too.
    await page
      .getByRole('table', { name: /Per process/ })
      .getByRole('row', { name: /^P4/ })
      .focus();
    await expect(page.locator('[data-brackets="4"]')).toBeVisible();
  });

  test('reduced motion: a forward step leaves nothing animating', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await loadPreset(page, 'osc-rr', 'OSC10 Round Robin, q = 4');
    await blur(page);
    for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(50);
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    );
    expect(running).toBe(0);
  });
});

test.describe('phone, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('300 ticks fit the width; zoomed in, the chart follows the cursor (S6)', async ({
    page,
  }) => {
    await open(page);
    await page.getByRole('tab', { name: 'Setup' }).click();
    // P1-P3 get 100-tick bursts: the run reaches the 300-tick limit.
    for (const pid of ['P1', 'P2', 'P3']) {
      const form = page.locator(`fieldset[data-pid="${pid}"]`);
      await form.getByText('Type the bursts').click();
      await form.getByLabel(`${pid} bursts`, { exact: true }).fill('100');
    }
    await page.getByRole('tab', { name: 'Watch' }).click();
    await blur(page);
    await page.keyboard.press('End');

    const box = page.getByRole('group', { name: /^Gantt chart.*scrollable$/ });
    const svg = box.locator('svg');
    await expect(svg).toHaveAttribute('data-zoom', 'fit');
    await expect(box.getByTestId('gantt-cursor')).toHaveAttribute('data-tick', '300');
    const fits = await box.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(fits).toBe(true);

    // Zoom in: the chart scrolls so the cursor at t = 300 is on screen.
    await page.keyboard.press('z');
    await expect(svg).toHaveAttribute('data-zoom', '16');
    await expect
      .poll(() =>
        box.evaluate((el) => {
          const cursor = el.querySelector('[data-testid="gantt-cursor"] line')!;
          const c = cursor.getBoundingClientRect();
          const b = el.getBoundingClientRect();
          return c.left >= b.left && c.right <= b.right && el.scrollLeft > 0;
        }),
      )
      .toBe(true);

    // Step back to the start: the cursor is followed back.
    await page.keyboard.press('Home');
    await expect.poll(() => box.evaluate((el) => el.scrollLeft)).toBe(0);
  });
});
