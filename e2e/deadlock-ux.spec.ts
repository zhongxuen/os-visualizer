import AxeBuilder from '@axe-core/playwright';
import { devices, expect, test, type Page, type TestInfo } from '@playwright/test';

import { freePlay, useTheme, type Theme } from './routes';

/**
 * /deadlock after U3.5 (docs/UIUX.md §2.3 D1-D5, G13, §7.2.5): screenshots at 1366 and
 * 390 px in both themes with axe; a keyboard-only walk that builds the two-lock graph,
 * plays, steps and reads the result; per-column ≤ checks in Banker's algorithm; the
 * canvas's motion (flowing request edges, the cycle drawn and labelled); reduced motion
 * leaving nothing running after a forward step; and the canvas view-only on a touch
 * screen.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const THEMES: readonly Theme[] = ['light', 'dark'];
const SIZES = [
  { name: 'desktop', width: 1366, height: 900 },
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

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

/** Open /deadlock in Sandbox, hydrated, with the graph canvas drawn. */
async function openSandbox(page: Page) {
  await page.goto('/deadlock');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deadlock');
  await freePlay(page);
}

/** Take focus off any control, so the playback shortcuts get the keys. */
async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

for (const size of SIZES) {
  test.describe(`${size.name}, ${size.width} px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const theme of THEMES) {
      test(`screenshots and axe (${theme})`, async ({ page }, testInfo) => {
        await useTheme(page, theme);
        await openSandbox(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.getByTestId('graph-canvas')).toBeVisible();
        await screenshot(page, testInfo, `deadlock-${size.name}-${theme}-graph`);
        await expectAxeClean(page, `/deadlock graph ${size.name} ${theme}`);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);

        // Banker's, part-way through the safety algorithm: the per-column checks.
        if (size.name === 'phone') await page.getByRole('tab', { name: 'Setup' }).click();
        await page.getByRole('tab', { name: 'Banker’s' }).click();
        if (size.name === 'phone') await page.getByRole('tab', { name: 'Watch' }).click();
        await blur(page);
        for (let i = 0; i < 2; i += 1) await page.keyboard.press('ArrowRight');
        // Step 3 checks T1: Need[T1] ≤ Work, one ✓ per column.
        await expect(
          page.getByTestId('compare-strip').locator('[data-pass="true"]'),
        ).toHaveCount(3);
        await screenshot(page, testInfo, `deadlock-${size.name}-${theme}-bankers`);
        await expectAxeClean(page, `/deadlock Banker’s ${size.name} ${theme}`);

        // The end of the run, with the end-of-run card.
        await page.keyboard.press('End');
        if (size.name === 'phone') {
          await page.getByRole('tab', { name: 'Results' }).click();
        }
        const card = page.getByRole('region', { name: 'End of the run' });
        await expect(card).toContainText('is one safe order (there may be others)');
        await expect(card).toContainText('Try this next');
        await screenshot(page, testInfo, `deadlock-${size.name}-${theme}-end`);
        await expectAxeClean(page, `/deadlock end of run ${size.name} ${theme}`);
      });
    }
  });
}

test.describe('keyboard only', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('build two locks, play, step and read the result', async ({ page }) => {
    await openSandbox(page);

    // Presets first; the editor opens from "Edit the graph" (G10).
    const edit = page.getByRole('button', { name: 'Edit the graph' });
    await edit.focus();
    await page.keyboard.press('Enter');
    await expect(edit).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Clear graph' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('graph-summary')).toContainText('No cycle.');

    const form = page.getByRole('form', { name: 'Add an edge' });
    const choose = async (label: string, key: 'ArrowUp' | 'ArrowDown' | null) => {
      if (!key) return;
      await form.getByLabel(label).focus();
      await page.keyboard.press(key);
    };
    const add = async (
      thread: 'ArrowUp' | 'ArrowDown' | null,
      verb: 'ArrowUp' | 'ArrowDown' | null,
      resource: 'ArrowUp' | 'ArrowDown' | null,
      expected: string,
    ) => {
      await choose('Thread', thread);
      await choose('Edge', verb);
      await choose('Resource', resource);
      await form.getByRole('button', { name: 'Add edge' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByText(`Added: ${expected}.`, { exact: true })).toBeVisible();
    };
    await add(null, null, null, 'T0 holds 1 of R0');
    await add('ArrowDown', null, 'ArrowDown', 'T1 holds 1 of R1');
    await add('ArrowUp', 'ArrowDown', null, 'T0 requests 1 of R1');
    await add('ArrowDown', null, 'ArrowUp', 'T1 requests 1 of R0');
    await expect(page.getByTestId('graph-summary')).toContainText(
      'Cycle: T0 → R1 → T1 → R0 → T0.',
    );

    // Play, pause, back to the start, step, then to the end.
    await blur(page);
    const slider = page.getByRole('slider', { name: 'Playback position' });
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: /^Pause/ })).toBeVisible();
    await page.keyboard.press('Space');
    await page.keyboard.press('Home');
    await expect(slider).toHaveAttribute('aria-valuetext', /^step 1 of/);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', /^step 3 of/);
    await page.keyboard.press('End');
    await expect(page.getByTestId('dl-result')).toHaveText(
      'Deadlocked: cycle T0 → R1 → T1 → R0 → T0.',
    );
    // The rule that decided it, linked from the inspector (G5).
    await expect(page.locator('[data-rule-chip]')).toHaveAttribute(
      'data-rule-chip',
      'dl.dfs.order',
    );
    await expect(page.getByRole('region', { name: 'End of the run' })).toContainText(
      'Cycle but no deadlock',
    );
  });
});

test.describe('canvas motion', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('request edges flow, the cycle is drawn red and labelled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openSandbox(page);
    const canvas = page.getByTestId('graph-canvas');
    const requests = canvas.locator('[data-kind="request"] path.animate-idle-cycle');
    await expect(requests).toHaveCount(2);
    const flowing = await requests
      .first()
      .evaluate((el) => el.getAnimations().some((a) => a.playState === 'running'));
    expect(flowing).toBe(true);
    await expect(
      canvas.locator('[data-kind="assignment"] path.animate-idle-cycle'),
    ).toHaveCount(0);

    await blur(page);
    await page.keyboard.press('End');
    await expect(canvas.locator('[data-tone="cycle"]')).toHaveCount(4);
    await expect(canvas.locator('[data-tone="cycle"]').first()).toContainText('cycle');

    // The two requests cross in the middle; their "cycle" labels must not overlap.
    const boxes = await canvas
      .locator('[data-tone="cycle"] .react-flow__edge-textwrapper')
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }),
      );
    expect(boxes).toHaveLength(4);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const [a, b] = [boxes[i]!, boxes[j]!];
        const overlap =
          a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(overlap, `labels ${i} and ${j} overlap`).toBe(false);
      }
    }
  });

  test('reduced motion: nothing is left running after a forward step', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSandbox(page);
    await expect(page.getByTestId('graph-canvas').locator('[data-edge]')).toHaveCount(4);
    await blur(page);
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    );
    expect(running).toBe(0);
    expect(await page.locator('[data-drawing], [data-flash]').count()).toBe(0);
  });
});

test.describe('touch screen', () => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } =
    devices['Pixel 7'];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test('the canvas is view-only and the page says so (D4)', async ({ page }) => {
    await openSandbox(page);
    const canvas = page.getByTestId('graph-canvas');
    await expect(canvas).toHaveAttribute('data-touch', 'view-only');
    await expect(page.getByTestId('canvas-caption')).toContainText(
      'On a touch screen the picture is view-only: drag to pan, pinch to zoom.',
    );
    await expect(canvas.locator('.react-flow__handle.connectable')).toHaveCount(0);
    await expect(canvas.locator('.react-flow__node.draggable')).toHaveCount(0);
  });
});
