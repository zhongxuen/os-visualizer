import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { freePlay, useTheme, type Theme } from './routes';

/**
 * Compare after U3.2 (docs/UIUX.md §2.3 C1-C4, §7.2.2): screenshots at 1366 and 390 px
 * in both themes with axe; one policy at a time with a mini-map and metric cards on a
 * phone (C1); direction labels and best / tie markers (C2) under the "Why?" headline
 * (C3); the Add policy menu (C4); one cursor line through every chart; a keyboard-only
 * walk that builds an input, plays, steps and reads the result; and the reduced-motion
 * check that a forward step leaves nothing animating.
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

/** Open /compare in Sandbox, hydrated. */
async function open(page: Page) {
  await page.goto('/compare');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compare schedulers');
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
        if (size.name === 'phone') await page.getByRole('tab', { name: 'Setup' }).click();
        await loadPreset(page, 'rr-sweep', 'RR quantum sweep (CS = 1)');
        if (size.name === 'phone') await page.getByRole('tab', { name: 'Watch' }).click();
        await blur(page);
        for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
        await screenshot(page, testInfo, `compare-${size.name}-${theme}`);
        await expectAxeClean(page, `/compare ${size.name} ${theme}`);

        await page.keyboard.press('End');
        if (size.name === 'phone') {
          await page.getByRole('tab', { name: 'Results' }).click();
        }
        await expect(page.getByRole('region', { name: 'End of the run' })).toBeVisible();
        await expect(page.getByTestId('why-line')).toContainText(
          'lowest average response time',
        );
        await screenshot(page, testInfo, `compare-${size.name}-${theme}-end`);
        await expectAxeClean(page, `/compare ${size.name} ${theme}, end of run`);

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

  test('one cursor line runs through every chart, MLFQ lanes or not', async ({
    page,
  }) => {
    await open(page);
    await loadPreset(page, 'mlfq-vs-rr', 'MLFQ vs RR (I/O-bound job)');
    await blur(page);
    for (let i = 0; i < 7; i += 1) await page.keyboard.press('ArrowRight');
    const cursors = page.getByTestId('gantt-cursor');
    await expect(cursors).toHaveCount(2);
    await expect
      .poll(async () => {
        const xs = await cursors.evaluateAll((groups) =>
          groups.map((g) =>
            Math.round(g.querySelector('line')!.getBoundingClientRect().left),
          ),
        );
        return Math.abs(xs[0]! - xs[1]!);
      })
      .toBeLessThanOrEqual(1);
  });

  test('every row has a direction; ties are marked as ties (C2, C3)', async ({
    page,
  }) => {
    await open(page);
    await loadPreset(page, 'rr-sweep', 'RR quantum sweep (CS = 1)');
    const table = page.getByRole('table', { name: /Side by side/ });
    await expect(page.getByTestId('why-line')).toContainText('settled when every run');
    await expect(table.locator('[data-marker]')).toHaveCount(0);

    await blur(page);
    await page.keyboard.press('End');
    for (const row of await table.locator('tbody tr').all()) {
      await expect(row).toContainText(/(lower|higher) is better/);
    }
    // Context switches fall as q grows: q = 8 alone is best.
    const cs = table.getByRole('row', { name: /Context switches/ });
    await expect(cs.locator('[data-mark="best"]')).toHaveCount(1);
    await expect(cs.getByRole('cell').nth(3)).toContainText('best');
    // Every marker is a word as well as an icon.
    for (const marker of await table.locator('[data-marker="tie"]').all()) {
      await expect(marker).toHaveText('tie');
    }
    // The headline sits above the table.
    const why = await page.getByTestId('why-line').boundingBox();
    const box = await table.boundingBox();
    expect(why!.y).toBeLessThan(box!.y);
  });

  test('keyboard only: build an input with the Add policy menu, play, step and read the result', async ({
    page,
  }) => {
    await open(page);
    await expect(async () => {
      const preset = page.getByLabel('Preset', { exact: true });
      await preset.focus();
      await preset.selectOption('response-vs-turnaround');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await expect(
        page.getByText('Loaded preset: Response vs turnaround (SJF vs RR)'),
      ).toBeVisible({ timeout: 500 });
    }).toPass();

    // Build: open the editor, then "Same policy, other settings" on the RR column.
    await page.getByRole('button', { name: 'Edit the policies and workload' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Add a policy' }).focus();
    await page.keyboard.press('Enter');
    const copy = page.getByRole('button', {
      name: 'Copy column 2 (RR q=2), quantum 2 → 4',
    });
    await expect(copy).toBeVisible();
    await copy.focus();
    await page.keyboard.press('Enter');
    const quantum = page.getByLabel('Column 3 Quantum (ticks)');
    await expect(quantum).toBeFocused();
    await expect(quantum).toHaveValue('4');
    await page.keyboard.press('Control+A');
    await page.keyboard.type('6');
    await expect(
      page.getByRole('group', { name: 'Gantt chart, RR q=6', exact: true }),
    ).toBeVisible();

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
      page.getByRole('heading', { name: 'Metrics at t = 1', exact: true }),
    ).toBeVisible();

    // Read: SJF has the lowest turnaround, RR q=2 the lowest response.
    await page.keyboard.press('End');
    const why = page.getByTestId('why-line');
    await expect(why).toContainText('SJF has the lowest average turnaround time');
    await expect(why).toContainText('RR q=2 has the lowest average response time');
    await expect(page.getByRole('region', { name: 'End of the run' })).toContainText(
      'All 3 runs have finished',
    );
  });

  test('reduced motion: a forward step leaves nothing animating', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await loadPreset(page, 'fcfs-sjf-srtf', 'FCFS vs SJF vs SRTF (convoy)');
    await blur(page);
    // Step all the way to the end, through every "done at" flag and the markers.
    for (let i = 0; i < 40; i += 1) await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-marker]').first()).toBeVisible();
    await page.waitForTimeout(50);
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    );
    expect(running).toBe(0);
  });
});

test.describe('phone, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('one policy at a time, a mini-map of all, and metric cards (C1)', async ({
    page,
  }) => {
    await open(page);
    await page.getByRole('tab', { name: 'Setup' }).click();
    await loadPreset(page, 'rr-sweep', 'RR quantum sweep (CS = 1)');
    await page.getByRole('tab', { name: 'Watch' }).click();

    const charts = page.getByRole('group', {
      name: /^Gantt chart, RR q=\d, scrollable$/,
    });
    await expect(charts).toHaveCount(1);
    await expect(
      page.getByRole('group', { name: 'Gantt chart, RR q=1, scrollable' }),
    ).toBeVisible();
    await expect(page.getByTestId('mini-map').locator('svg')).toHaveCount(4);

    await page.getByRole('radio', { name: 'RR q=4' }).click();
    await expect(
      page.getByRole('group', { name: 'Gantt chart, RR q=4, scrollable' }),
    ).toBeVisible();
    await expect(charts).toHaveCount(1);

    // The arrow keys move within the segmented control.
    await page.keyboard.press('ArrowRight');
    await expect(
      page.getByRole('group', { name: 'Gantt chart, RR q=8, scrollable' }),
    ).toBeVisible();

    await blur(page);
    await page.keyboard.press('End');
    await page.getByRole('tab', { name: 'Results' }).click();
    await expect(page.getByRole('table', { name: /Side by side/ })).toBeHidden();
    const cards = page.getByTestId('metric-cards').locator('[data-card]');
    await expect(cards).toHaveCount(6);
    const cs = page.getByRole('region', { name: 'Context switches' });
    await expect(cs).toContainText('lower is better');
    await expect(cs.locator('[data-mark="best"]')).toContainText('RR q=8');
  });
});
