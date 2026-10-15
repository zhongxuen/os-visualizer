import { expect, test, type Page } from '@playwright/test';

import { freePlay } from './routes';

/**
 * Guided mode after the U5.2 re-test (docs/UIUX.md §10.1):
 *
 * - Q1: opening a lesson part loads its example, so the text and the picture agree on the
 *   first screen; a `?s=` link is never overwritten, and keeps "Load this example".
 * - Q2: the first Play brings the picture into view, jumping under reduced motion.
 * - Q5: while a lesson example is loaded, the Presets dropdown says "Lesson example".
 */

test.use({ viewport: { width: 1366, height: 850 } });

function lessonOf(page: Page) {
  return page.locator('[data-lesson]');
}

test('Q1: the first part’s example is loaded as the lesson opens', async ({ page }) => {
  await page.goto('/scheduling');
  const lesson = lessonOf(page);
  await expect(lesson.getByText('(loaded)')).toBeVisible();
  await expect(lesson.getByRole('button', { name: 'Reload this example' })).toBeVisible();
  await expect(lesson.getByText(/The picture shows a different input/)).toHaveCount(0);
  // The picture is the example the text describes: FCFS, P1 first.
  await expect(page.getByRole('heading', { name: 'FCFS', exact: true })).toBeVisible();

  // The next part loads its own example too.
  await lesson.getByRole('button', { name: 'Next part' }).click();
  await expect(lesson.getByText(/^Part 2 of \d+ ·/)).toBeVisible();
  const bar = lesson.locator('[data-example]');
  if ((await bar.count()) > 0) await expect(lesson.getByText('(loaded)')).toBeVisible();
});

test('Q1: a ?s= link is never overwritten; the part offers its example instead', async ({
  page,
  context,
}) => {
  // Make a link to a preset that is not the lesson's.
  await page.goto('/scheduling');
  await freePlay(page);
  const preset = page.getByLabel('Preset', { exact: true });
  await expect(async () => {
    await preset.selectOption({ index: 0 });
    await page.getByRole('button', { name: 'Load preset' }).click();
    await expect(page.getByText(/^Loaded preset:/)).toBeVisible({ timeout: 500 });
  }).toPass();
  await expect(page).toHaveURL(/\?s=/);
  const link = page.url();

  // Opened fresh, in Guided mode.
  const other = await context.newPage();
  await other.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'osv:v1',
        JSON.stringify({ v: 1, prefs: { moduleModes: { scheduling: 'walkthrough' } } }),
      );
    } catch {
      // Storage blocked: the assertions below fail loudly.
    }
  });
  await other.goto(link);
  const lesson = lessonOf(other);
  await expect(lesson).toBeVisible();
  await other.waitForTimeout(500);
  await expect(lesson.getByRole('button', { name: 'Load this example' })).toBeVisible();
  await expect(lesson.getByText(/The picture shows a different input/)).toBeVisible();
  await expect(other).toHaveURL(link);
});

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`Q2: the first Play brings the picture into view (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/scheduling');
    await expect(lessonOf(page).getByText('(loaded)')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    const gantt = page.getByRole('heading', { name: 'FCFS', exact: true });
    await expect(gantt).not.toBeInViewport();

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    if (reducedMotion === 'reduce') {
      // A jump: there on the next frame, not after a glide.
      await page.waitForTimeout(50);
      await expect(gantt).toBeInViewport({ timeout: 100 });
    } else {
      await expect(gantt).toBeInViewport();
    }

    // Later plays leave the page where the learner put it.
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(600);
    await expect(gantt).not.toBeInViewport();
  });
}

for (const route of ['/compare', '/replacement']) {
  test(`Q5: ${route} names the loaded lesson example in the Presets dropdown`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(lessonOf(page).getByText('(loaded)')).toBeVisible();
    const preset = page.getByLabel('Preset', { exact: true });
    await expect(preset).toHaveValue('lesson-example');
    await expect(preset.locator('option:checked')).toHaveText('Lesson example');
    await expect(page.getByText(/^From the lesson: /)).toBeVisible();

    // Choosing a preset takes the dropdown back to the presets.
    await preset.selectOption({ index: 1 });
    await expect(preset).not.toHaveValue('lesson-example');
  });
}
