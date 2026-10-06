import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { useTheme, type Theme } from './routes';

/**
 * The learning path, the glossary and a Guided lesson (docs/UIUX.md §4.1, §7.3, U4.1):
 *
 * - a checkpoint answered from the keyboard alone, with the result announced and focused;
 * - /learn shows that progress, and still does after a reload;
 * - a station opens its module in Guided mode, even one last left in Sandbox;
 * - the glossary searches, and links each term to its modules;
 * - axe on /learn and /learn/glossary in both themes (/about is in about.spec.ts).
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

/** Tab forwards until `match` holds for the focused element. */
async function tabUntil(
  page: Page,
  match: (el: { text: string; inCheckpoint: string | null; tag: string }) => boolean,
  limit = 60,
): Promise<void> {
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press('Tab');
    const el = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        text: (active?.textContent ?? '').trim(),
        inCheckpoint:
          active?.closest('[data-checkpoint]')?.getAttribute('data-checkpoint') ?? null,
        tag: active?.tagName ?? '',
      };
    });
    if (match(el)) return;
  }
  throw new Error('Tab never reached the element');
}

test('a checkpoint can be answered by keyboard, and /learn keeps the progress', async ({
  page,
}) => {
  await page.goto('/scheduling');
  await page.waitForLoadState('networkidle');
  const lesson = page.locator('[data-lesson="lesson.scheduling"]');
  await expect(lesson).toBeVisible();

  // Load the example from the keyboard (retried until React has hydrated).
  const load = lesson.getByRole('button', { name: 'Load this example' });
  await expect(async () => {
    await load.focus();
    await page.keyboard.press('Enter');
    await expect(lesson.getByText('(loaded)')).toBeVisible({ timeout: 1000 });
  }).toPass();

  // Tab to the right answer: FCFS runs P2 next, first in the ready queue.
  const card = lesson.locator('[data-checkpoint="convoy-16"]');
  await expect(card).toHaveAttribute('data-state', /asking|held/);
  await tabUntil(
    page,
    (el) => el.inCheckpoint === 'convoy-16' && el.tag === 'BUTTON' && el.text === 'P2',
  );
  await page.keyboard.press('Enter');

  await expect(card).toHaveAttribute('data-state', 'correct');
  const result = card.getByText('Correct.');
  await expect(result).toBeFocused();
  await expect(card.getByText('Why:')).toBeVisible();
  await expect(lesson.getByText(/1 of 4 checkpoints/)).toBeVisible();

  // "Show the next step" is reachable from the result by keyboard too.
  await tabUntil(page, (el) => el.text === 'Show the next step');
  await page.keyboard.press('Enter');

  // The learning path shows it, and still does after a reload.
  await page.goto('/learn');
  const count = page.getByTestId('station-checkpoints-lesson.scheduling');
  await expect(count).toHaveText('1 of 4 checkpoints');
  await expect(
    page.locator('[data-station="scheduling"] [data-fraction]'),
  ).toHaveAttribute('data-fraction', '0.25');
  await expect(page.getByTestId('learn-progress')).toContainText('checkpoints answered');
  await page.reload();
  await expect(count).toHaveText('1 of 4 checkpoints');
  await expect(
    page.locator('[data-station="scheduling"]').getByText('In progress'),
  ).toBeVisible();
});

test('/learn is a path of stations in course order, each opening Guided mode', async ({
  page,
}) => {
  // Scheduling was last left in Sandbox.
  await page.addInitScript(() => {
    try {
      if (!window.sessionStorage.getItem('seeded')) {
        window.sessionStorage.setItem('seeded', '1');
        window.localStorage.setItem(
          'osv:v1',
          JSON.stringify({ v: 1, prefs: { moduleModes: { scheduling: 'free' } } }),
        );
      }
    } catch {
      // Storage blocked: the test below fails loudly.
    }
  });
  await page.goto('/learn');
  await page.waitForLoadState('networkidle');

  const stations = page.locator('[data-station]');
  await expect(stations).toHaveCount(6);
  expect(
    await stations.evaluateAll((els) => els.map((e) => e.getAttribute('data-station'))),
  ).toEqual(['scheduling', 'compare', 'translation', 'replacement', 'deadlock', 'sync']);
  await expect(page.getByTestId('learn-progress')).toContainText(
    '0 of 6 lessons complete',
  );
  await expect(stations.first()).toContainText('Station 1');
  await expect(stations.first()).toContainText('Start in Guided mode');
  await expect(stations.last()).toContainText('After that');

  // The glossary is one link away.
  await expect(page.getByRole('link', { name: 'The glossary' })).toHaveAttribute(
    'href',
    '/learn/glossary',
  );

  const link = page.getByRole('link', {
    name: /^CPU Scheduling\s*, lesson in Guided mode/,
  });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/scheduling$/);
  await expect(page.getByRole('radio', { name: 'Guided' })).toBeChecked();
  await expect(page.locator('[data-lesson="lesson.scheduling"]')).toBeVisible();
});

test('the glossary filters as you type and links terms to their modules', async ({
  page,
}) => {
  await page.goto('/learn/glossary');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1, name: 'Glossary' })).toBeVisible();
  const all = await page.locator('[data-term]').count();
  expect(all).toBeGreaterThan(50);

  const search = page.getByRole('searchbox', { name: 'Search the glossary' });
  await expect(async () => {
    await search.fill('quantum');
    await expect(page.locator('[data-term]')).not.toHaveCount(all, { timeout: 1000 });
  }).toPass();
  const first = page.locator('[data-term]').first();
  await expect(first).toHaveAttribute('data-term', 'quantum');
  await expect(page.getByRole('status')).toContainText('match');
  await expect(first.getByRole('link', { name: 'CPU Scheduling' })).toHaveAttribute(
    'href',
    '/scheduling',
  );

  await search.fill('zzzz-no-such-term');
  await expect(page.getByText('No term matches.')).toBeVisible();

  // A term has its own anchor, so a link can point at it.
  await search.fill('');
  await page.goto('about:blank');
  await page.goto('/learn/glossary#tlb');
  await expect(page.locator('#tlb')).toBeInViewport();
});

const THEMES: readonly Theme[] = ['light', 'dark'];

for (const path of ['/learn', '/learn/glossary']) {
  for (const theme of THEMES) {
    test(`${path}, ${theme}: axe clean`, async ({ page }) => {
      await useTheme(page, theme);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await scan(page, `${path} (${theme})`);
    });
  }
}
