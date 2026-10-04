import { expect, test, type Page } from '@playwright/test';

/**
 * A keyboard-only walk through every module: reach every control with Tab, build an
 * input (load a preset with the select and Enter), play and pause, scrub the timeline,
 * step with the arrow keys, and read the result, without a mouse.
 *
 * `locator.focus()` stands in for a run of Tab presses where a test would otherwise have
 * to count them; the Tab walk at the start is what proves each of those controls is in
 * the tab order at all.
 */

interface Walk {
  path: string;
  title: string;
  preset: string;
  loaded: string;
  /** What a reader checks at the end of the run. */
  result: { testId: string; text: string | RegExp };
}

const WALKS: readonly Walk[] = [
  {
    path: '/scheduling',
    title: 'CPU Scheduling',
    preset: 'osc-sjf',
    loaded: 'Loaded preset: OSC10 SJF (6, 8, 7, 3)',
    result: { testId: 'avg-waiting', text: '7' },
  },
  {
    path: '/compare',
    title: 'Compare schedulers',
    preset: 'rr-sweep',
    loaded: 'Loaded preset: RR quantum sweep (CS = 1)',
    result: { testId: 'why-line', text: /lowest average response time/ },
  },
  {
    path: '/translation',
    title: 'Address Translation',
    preset: 'ostep-array',
    loaded: 'Loaded preset: OSTEP array walk',
    result: { testId: 'hit-rate', text: '70%' },
  },
  {
    path: '/replacement',
    title: 'Page Replacement',
    preset: 'belady',
    loaded: 'Loaded preset: Belady’s anomaly (FIFO)',
    result: { testId: 'faults', text: '9' },
  },
  {
    path: '/deadlock',
    title: 'Deadlock',
    preset: 'dining',
    loaded: 'Loaded preset: Dining philosophers, 5 forks',
    result: { testId: 'dl-result', text: /^Deadlocked: cycle/ },
  },
  {
    path: '/sync',
    title: 'Synchronisation',
    preset: 'counter-mutex',
    loaded: 'Loaded preset: Counter with a mutex',
    result: { testId: 'var-counter', text: '2' },
  },
];

/**
 * Press Tab from the top of the page until focus comes back round, marking everything
 * that took focus, then list the visible, enabled controls that never did. A radio group
 * and a tab list are one tab stop each (the arrow keys move within them), so only the
 * checked radio and the selected tab count; the module specs switch tabs by keyboard.
 */
async function unreachedControls(page: Page): Promise<string[]> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-kbd-seen]')) {
      el.removeAttribute('data-kbd-seen');
    }
  });
  // Start at the very first tab stop, the skip link, so the walk covers the whole page.
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await skip.focus();
  await skip.evaluate((el) => el.setAttribute('data-kbd-seen', ''));
  for (let i = 0; i < 600; i += 1) {
    await page.keyboard.press('Tab');
    const again = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return true;
      if (el.hasAttribute('data-kbd-seen')) return true;
      el.setAttribute('data-kbd-seen', '');
      return false;
    });
    if (again) break;
  }
  return page.evaluate(() => {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'summary',
      '[tabindex="0"]',
    ].join(',');
    const visible = (el: Element) => {
      if (
        el.closest('[aria-hidden="true"], [inert], details:not([open]) > :not(summary)')
      ) {
        return false;
      }
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
    };
    return [...document.querySelectorAll(selector)]
      .filter(visible)
      .filter(
        (el) => !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked),
      )
      .filter(
        (el) =>
          !(
            el.getAttribute('role') === 'tab' &&
            el.getAttribute('aria-selected') !== 'true'
          ),
      )
      .filter((el) => !el.hasAttribute('data-kbd-seen'))
      .map((el) => {
        const name =
          el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 40);
        return `${el.tagName.toLowerCase()} "${name}"`;
      });
  });
}

for (const walk of WALKS) {
  test(`keyboard: ${walk.title}, every control reachable, load, play, scrub, step, read`, async ({
    page,
  }) => {
    await page.goto(walk.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(walk.title);

    // The skip link is the first tab stop and lands on the main content.
    await expect(async () => {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused({
        timeout: 500,
      });
    }).toPass();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();

    // Build an input: pick the preset and press Load, retrying until hydrated.
    const preset = page.getByLabel('Preset', { exact: true });
    await expect(async () => {
      await preset.focus();
      await preset.selectOption(walk.preset);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Load preset' })).toBeFocused({
        timeout: 500,
      });
      await page.keyboard.press('Enter');
      await expect(page.getByText(walk.loaded)).toBeVisible({ timeout: 1000 });
    }).toPass();

    // Every control can be reached with Tab.
    expect(await unreachedControls(page)).toEqual([]);

    // Play and pause with the transport button.
    const play = page.locator('[data-transport-play]');
    await play.focus();
    await expect(play).toHaveAccessibleName('Play');
    await page.keyboard.press('Enter');
    await expect(play).toHaveAccessibleName('Pause');
    await page.waitForTimeout(600);
    await page.keyboard.press('Enter');
    await expect(play).not.toHaveAccessibleName('Pause');

    // Scrub: the slider takes Home, the arrow keys and End.
    const slider = page.getByRole('slider', { name: 'Playback position' });
    await slider.focus();
    await page.keyboard.press('Home');
    const start = await slider.getAttribute('aria-valuetext');
    await page.keyboard.press('ArrowRight');
    await expect(slider).not.toHaveAttribute('aria-valuetext', start!);

    // Step with the arrow keys from outside the slider (the playback shortcuts).
    await play.focus();
    await page.keyboard.press('Tab');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const before = await slider.getAttribute('aria-valuetext');
    await page.keyboard.press('ArrowRight');
    await expect(slider).not.toHaveAttribute('aria-valuetext', before!);
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveAttribute('aria-valuetext', before!);

    // Read the result at the end.
    await page.keyboard.press('End');
    await expect(page.getByTestId(walk.result.testId)).toHaveText(walk.result.text);
  });
}
