import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { useTheme, type Theme } from './routes';

/**
 * Page Replacement (U3.4): the Belady preset end to end, the URL, screenshots at 1366
 * and 390 px in both themes with axe, a keyboard-only walk that types a string, the
 * reduced-motion check, the Belady callout's timing and the Clock ring's hand.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const THEMES: readonly Theme[] = ['light', 'dark'];

/**
 * Open /replacement and wait for React: once hydrated, the workspace records this
 * module's first-visit mode in `osv:v1`. A key press or a change made before then is
 * lost, which is what made the old Belady test flaky.
 */
async function open(page: Page, path = '/replacement') {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page Replacement');
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('osv:v1') ?? ''))
    .toContain('"replacement"');
}

/** Load a preset from the keyboard: the select, Tab to Load preset, Enter. */
async function loadPreset(page: Page, id: string, title: string) {
  const preset = page.getByLabel('Preset', { exact: true });
  await expect(async () => {
    await preset.focus();
    await preset.selectOption(id);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Load preset' })).toBeFocused({
      timeout: 500,
    });
    await page.keyboard.press('Enter');
    await expect(page.getByText(`Loaded preset: ${title}`)).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
}

/** Move focus off any control, so the playback keys reach the page. */
async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

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

test('replacement: Belady preset, both runs to the end, 9 vs 10 faults, axe clean', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await open(page);
  await loadPreset(page, 'belady', 'Belady’s anomaly (FIFO)');

  await page.keyboard.press('End');
  await expect(page.getByTestId('faults')).toHaveText('9');
  await expect(page.getByTestId('refs-done')).toHaveText('12 / 12');

  // The Belady panel: FIFO with 3 and 4 frames on one cursor, stepped to the end.
  const panel = page.getByRole('region', { name: /Belady’s anomaly: one frame more/ });
  await panel.getByRole('button', { name: 'Last' }).click();
  await expect(panel.getByTestId('belady-faults-small')).toHaveText('9');
  await expect(panel.getByTestId('belady-faults-large')).toHaveText('10');
  await expect(panel.getByTestId('belady-callout')).toContainText(
    '4 frames, more faults than 3',
  );
  await expect(panel.getByText(/More memory, more faults/)).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('replacement: the Belady callout appears exactly when 4 frames pass 3', async ({
  page,
}) => {
  await open(page);
  await loadPreset(page, 'belady', 'Belady’s anomaly (FIFO)');
  const panel = page.getByRole('region', { name: /Belady’s anomaly: one frame more/ });
  const next = panel.getByRole('button', { name: 'Next' });
  for (let i = 0; i < 12; i += 1) {
    if (i > 0) await next.click();
    await expect(panel.getByText(`${i + 1} / 12`, { exact: true })).toBeVisible();
    const small = Number(await panel.getByTestId('belady-faults-small').textContent());
    const large = Number(await panel.getByTestId('belady-faults-large').textContent());
    await expect(panel.getByTestId('belady-callout')).toHaveCount(large > small ? 1 : 0);
  }
  // Only at the last reference: 10 against 9.
  await expect(panel.getByTestId('belady-callout')).toHaveCount(1);
  await panel.getByRole('button', { name: 'Back' }).click();
  await expect(panel.getByTestId('belady-callout')).toHaveCount(0);
});

test('replacement: the URL keeps the string, policy and step', async ({ page }) => {
  await open(page);
  await loadPreset(page, 'ostep', 'OSTEP reference string');
  await page.getByRole('tab', { name: /LRU/ }).click();
  await blur(page);
  await page.keyboard.press('End');
  await expect(page.getByTestId('hits')).toHaveText('6');
  // The URL follows after a debounce: wait until it holds the LRU run past step 0.
  await expect
    .poll(() => {
      const s = new URL(page.url()).searchParams.get('s');
      if (!s) return null;
      const state = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
      return {
        policy: state.input.policy,
        refs: state.input.refString.length,
        moved: state.step > 0,
      };
    })
    .toEqual({ policy: 'lru', refs: 11, moved: true });

  const url = page.url();
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.getByRole('tab', { name: /LRU/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByTestId('hits')).toHaveText('6');
  await expect(page.getByTestId('refs-done')).toHaveText('11 / 11');
});

test('replacement: keyboard only, type a string, play, step and read the result', async ({
  page,
}) => {
  await open(page);

  // Open "Edit the string and frames" and type a string, from the keyboard.
  const edit = page.getByText('Edit the string and frames');
  await edit.focus();
  await page.keyboard.press('Enter');
  const box = page.getByLabel(/Pages referenced/);
  await expect(box).toBeVisible();
  await box.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('1 2 3 4, 1 2 5 x');
  // The chips read the string back, and the bad token is named.
  const chips = page.getByRole('list', { name: 'References as read' });
  await expect(chips.getByRole('listitem')).toHaveCount(8);
  await expect(page.getByText(/Reference 8: “x” is not a page/)).toBeVisible();
  await expect(box).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('1 2 3 4 5');
  await expect(chips.getByRole('listitem')).toHaveCount(12);
  await expect(box).not.toHaveAttribute('aria-invalid', 'true');

  // Frames: the next control, set to 4.
  await page.keyboard.press('Tab');
  const frames = page.getByRole('combobox', { name: 'Frames', exact: true });
  await expect(frames).toBeFocused();
  await frames.selectOption('4');
  await expect(page.getByText(/FIFO, 4 frames, 12 references/)).toBeVisible();

  // Play and pause with the transport button.
  const play = page.locator('[data-transport-play]');
  await play.focus();
  await page.keyboard.press('Enter');
  await expect(play).toHaveAccessibleName('Pause');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await expect(play).not.toHaveAccessibleName('Pause');

  // Step with the arrow keys from the page, then read the result at the end.
  await blur(page);
  await page.keyboard.press('Home');
  await expect(page.getByTestId('faults')).toHaveText('1');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('refs-done')).toHaveText('2 / 12');
  await page.keyboard.press('End');
  await expect(page.getByTestId('faults')).toHaveText('10');
  await expect(page.getByTestId('cold')).toHaveText('5');
  const card = page.getByRole('region', { name: 'End of the run' });
  await expect(card).toContainText('FIFO with 4 frames: 10 faults (5 cold, 5 capacity)');
});

test('replacement: reduced motion, stepping forward runs no animation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await loadPreset(page, 'clock', 'Clock on the OSC10 string');
  await blur(page);
  const running = () =>
    page.evaluate(
      () =>
        // globals.css collapses every animation to a 0.01ms pass under reduced motion;
        // those are not motion, so only a running animation longer than 1ms counts.
        document
          .getAnimations()
          .filter(
            (a) =>
              a.playState === 'running' &&
              Number(a.effect?.getComputedTiming().duration ?? 0) > 1,
          ).length,
    );
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(30);
    expect(await running(), `after step ${i + 1}`).toBe(0);
  }
  await page.getByRole('region', { name: /Faults vs frames/ }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  expect(await running()).toBe(0);
});

test('replacement: the Clock ring’s hand matches the strip on every step', async ({
  page,
}) => {
  await open(page);
  await loadPreset(page, 'clock', 'Clock on the OSC10 string');
  await blur(page);
  const ring = page.locator('[data-clock-ring] [data-hand]');
  const slider = page.getByRole('slider', { name: 'Playback position' });
  const total = Number(
    /of (\d+)/.exec((await slider.getAttribute('aria-valuetext'))!)![1],
  );
  expect(total).toBeGreaterThan(20);
  for (let i = 1; i <= total; i += 1) {
    if (i > 1) await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', `step ${i} of ${total}`);
    // The strip's current column marks the hand in words ("hand"), one frame per row.
    const stripHand = await page.evaluate(() => {
      const table = [...document.querySelectorAll('table')].find((t) =>
        t.caption?.textContent?.startsWith('Clock: frames after each reference'),
      )!;
      const col = [...table.querySelectorAll('thead th[scope="col"]')].findIndex(
        (th) => th.getAttribute('aria-current') === 'step',
      );
      const rows = [...table.querySelectorAll('tbody tr')];
      return rows.findIndex((row) =>
        row.querySelectorAll('td')[col]?.textContent?.includes('hand'),
      );
    });
    await expect(ring).toHaveAttribute('data-hand', String(stripHand));
  }
});

for (const size of [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'phone', width: 390, height: 844 },
] as const) {
  test.describe(`${size.name}, ${size.width} px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const theme of THEMES) {
      test(`screenshot and axe (${theme})`, async ({ page }, testInfo) => {
        await useTheme(page, theme);
        await open(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const phone = size.name === 'phone';
        if (phone) await page.getByRole('tab', { name: 'Setup', exact: true }).click();
        await loadPreset(page, 'clock', 'Clock on the OSC10 string');
        if (phone) await page.getByRole('tab', { name: 'Watch', exact: true }).click();
        await blur(page);
        for (let i = 0; i < 30; i += 1) await page.keyboard.press('ArrowRight');
        await expect(page.locator('[data-clock-ring]')).toBeVisible();
        await screenshot(page, testInfo, `replacement-${size.name}-${theme}`);
        await expectAxeClean(page, `/replacement ${size.name} ${theme}`);

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);

        // R4: the current column stays in view inside the strip.
        const scroller = page.getByRole('group', {
          name: 'Clock: frames after each reference, scrollable',
        });
        const box = (await scroller.boundingBox())!;
        const at = (await scroller.locator('th[aria-current="step"]').boundingBox())!;
        expect(at.x).toBeGreaterThanOrEqual(box.x - 1);
        expect(at.x + at.width).toBeLessThanOrEqual(box.x + box.width + 1);

        await page.keyboard.press('End');
        if (phone) await page.getByRole('tab', { name: 'Results', exact: true }).click();
        await expect(page.getByRole('region', { name: 'End of the run' })).toBeVisible();
        await screenshot(page, testInfo, `replacement-${size.name}-${theme}-end`);
        await expectAxeClean(page, `/replacement ${size.name} ${theme} end`);
      });
    }
  });
}
