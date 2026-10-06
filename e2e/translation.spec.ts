import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { freePlay, useTheme, type Theme } from './routes';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

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

/** Load a preset, retrying until hydrated: a change made before React attaches is lost. */
async function loadPreset(page: Page, id: string, title: string) {
  await expect(async () => {
    await page.getByLabel('Preset', { exact: true }).selectOption(id);
    await page.getByRole('button', { name: 'Load preset' }).click();
    await expect(page.getByText(`Loaded preset: ${title}`)).toBeVisible({
      timeout: 500,
    });
  }).toPass();
}

/** Step forward from outside any control, so the playback keys apply. */
async function step(page: Page, times = 1) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < times; i += 1) await page.keyboard.press('ArrowRight');
}

test('translation: OSTEP array walk, keyboard to the end, 70% hit rate, axe clean', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/translation');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Address Translation');

  // Keyboard only: choose the preset, press Load, then End.
  await page.getByLabel('Preset', { exact: true }).focus();
  await page.getByLabel('Preset', { exact: true }).selectOption('ostep-array');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Load preset' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Loaded preset: OSTEP array walk')).toBeVisible();

  await page.keyboard.press('End');
  await expect(page.getByTestId('hit-rate')).toHaveText('70%');
  await expect(page.getByTestId('tlb-hits')).toHaveText('7');
  await expect(page.getByTestId('tlb-misses')).toHaveText('3');
  await expect(page.getByTestId('mem-refs')).toHaveText('13');
  await expect(page.getByTestId('accesses-done')).toHaveText('10 / 10');

  await expectAxeClean(page, '/translation at the end');
  expect(errors).toEqual([]);
});

test('translation: a fault carries its pages to Page Replacement via ?s=, and the URL keeps the step', async ({
  page,
}) => {
  await page.goto('/translation');
  await loadPreset(page, 'invalid-page', 'Invalid page');
  await page.keyboard.press('End');
  await expect(page.getByTestId('faults')).toHaveText('3');
  // The URL follows after a debounce: wait until it holds a step past 0.
  await expect
    .poll(() => {
      const s = new URL(page.url()).searchParams.get('s');
      if (!s) return false;
      return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')).step > 0;
    })
    .toBe(true);

  const url = page.url();
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.getByTestId('faults')).toHaveText('3');
  await expect(page.getByTestId('accesses-done')).toHaveText('5 / 5');

  // The last access faults (VPN 2, invalid): its link carries this run's pages.
  const inspector = page.getByRole('region', { name: 'Inspector' });
  const link = inspector.getByRole('link', { name: /Page Replacement/ });
  const href = (await link.getAttribute('href'))!;
  expect(href).toMatch(/^\/replacement\?s=/);
  const carried = JSON.parse(
    Buffer.from(new URL(href, page.url()).searchParams.get('s')!, 'base64url').toString(
      'utf8',
    ),
  );
  expect(carried).toMatchObject({ m: 'replace', input: { refString: [0, 2, 1, 5, 2] } });
  await expect(inspector.getByTestId('fault-next-pages')).toContainText(
    'Page 2 is the one that faulted.',
  );

  // Page Replacement opens on those pages, not its own default.
  await link.click();
  await expect(page).toHaveURL(/\/replacement\?s=/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page Replacement');
  await freePlay(page);
  await expect(page.getByLabel(/Pages referenced/)).toHaveValue('0, 2, 1, 5, 2');
});

test('translation: on a TLB hit the pipeline shows the walk and the fill skipped', async ({
  page,
}) => {
  await page.goto('/translation');
  await loadPreset(page, 'ostep-array', 'OSTEP array walk');
  // Access 1 misses (split, miss, PTE, check, fill, PA, memory = 7 steps); access 2's
  // lookup is the 9th step, a hit.
  await step(page, 8);
  const pipeline = page.locator('[data-pipeline]');
  await expect(pipeline.locator('[data-stage="tlb"]')).toHaveAttribute(
    'data-status',
    'current',
  );
  await expect(pipeline.locator('[data-stage="walk"]')).toHaveAttribute(
    'data-status',
    'skipped',
  );
  await expect(pipeline.locator('[data-stage="fill"]')).toHaveAttribute(
    'data-status',
    'skipped',
  );
  await expect(pipeline.getByText('skipped: hit')).toHaveCount(2);
  await expect(page.getByTestId('tlb-lookup')).toContainText('found, a hit');
});

for (const width of [1366, 390] as const) {
  for (const theme of ['light', 'dark'] as const satisfies readonly Theme[]) {
    test(`translation: screenshot and axe at ${width} px (${theme})`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width > 1000 ? 900 : 844 });
      await useTheme(page, theme);
      await page.goto('/translation');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const phone = width < 640;
      if (phone) await page.getByRole('tab', { name: 'Setup' }).click();
      await loadPreset(page, 'two-level', 'Two-level walk');
      if (phone) await page.getByRole('tab', { name: 'Watch' }).click();
      await step(page, 3);
      await screenshot(page, testInfo, `translation-${width}-${theme}`);
      await expectAxeClean(page, `/translation ${width} ${theme}`);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      // The sizing tab and the end-of-run card are part of the page too.
      await page.getByRole('tab', { name: 'Why two levels?' }).click();
      await expect(page.getByTestId('sizing-intro')).toBeVisible();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('End');
      if (phone) await page.getByRole('tab', { name: 'Results' }).click();
      await expect(page.getByRole('region', { name: 'End of the run' })).toBeVisible();
      await screenshot(page, testInfo, `translation-${width}-${theme}-end`);
      await expectAxeClean(page, `/translation ${width} ${theme}, sizing tab and end`);
    });
  }
}

test('translation: keyboard only, build an input, play, step and read the result', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/translation');
  await loadPreset(page, 'ostep-array', 'OSTEP array walk');

  // Build: open the editor with Enter and type two accesses to the same page.
  const edit = page.getByRole('button', { name: /Edit this input/ });
  await edit.focus();
  await page.keyboard.press('Enter');
  await expect(edit).toHaveAttribute('aria-expanded', 'true');
  const box = page.getByLabel(/Virtual addresses, in order/);
  await box.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('100, 104 w');
  await expect(page.getByRole('list', { name: 'Accesses as read' })).toContainText(
    '104 w',
  );

  // Play and pause from the transport button.
  const play = page.locator('[data-transport-play]');
  await play.focus();
  await page.keyboard.press('Enter');
  await expect(play).toHaveAccessibleName('Pause');
  await page.keyboard.press('Enter');
  await expect(play).not.toHaveAccessibleName('Pause');

  // Step, switch the base with B, and read the result at the end.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('figure[data-base]').first()).toHaveAttribute(
    'data-base',
    'binary',
  );
  await page.keyboard.press('b');
  await expect(page.locator('figure[data-base]').first()).toHaveAttribute(
    'data-base',
    'hex',
  );
  await page.keyboard.press('End');
  await expect(page.getByTestId('accesses-done')).toHaveText('2 / 2');
  await expect(page.getByTestId('hit-rate')).toHaveText('50%');
  const card = page.getByRole('region', { name: 'End of the run' });
  await expect(card).toContainText('2 accesses: 1 TLB hit and 1 miss');

  // The rule chip takes the reader to the rule.
  const chip = page.locator('[data-rule-chip]');
  await chip.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-rules-panel]')).toHaveAttribute('open', '');
});

test('translation: reduced motion, a forward step leaves nothing animating', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/translation');
  await loadPreset(page, 'two-level', 'Two-level walk');
  for (let i = 0; i < 8; i += 1) {
    await step(page);
    // 100 ms and a frame on. Under reduced motion globals.css shortens every
    // transition, of every property, to 0.01ms, so the step's own style changes are
    // over by then; a real animation (a 220-360ms token) would still be running.
    const running = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) =>
          setTimeout(
            () =>
              requestAnimationFrame(() =>
                resolve(
                  document
                    .getAnimations()
                    .filter((a) => a.playState === 'running')
                    .map((a) => {
                      const target = (a.effect as KeyframeEffect | null)?.target;
                      return `${a.constructor.name} on ${target?.tagName ?? '?'}.${String(
                        target?.getAttribute('class') ?? '',
                      ).slice(0, 60)}`;
                    }),
                ),
              ),
            100,
          ),
        ),
    );
    expect(running, `step ${i + 1}`).toEqual([]);
  }
});

test('translation: with motion allowed, a forward step animates and a step back does not', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/translation');
  await loadPreset(page, 'ostep-array', 'OSTEP array walk');
  const visual = page.getByRole('region', { name: 'Visualisation' });
  const running = () =>
    visual.evaluate(
      (el) =>
        el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running')
          .length,
    );
  await step(page);
  await expect.poll(running, { timeout: 2000, intervals: [10] }).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(50);
  expect(await running()).toBe(0);
});
