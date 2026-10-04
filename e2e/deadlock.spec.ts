import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

/** Press End with nothing focused, so the playback shortcut takes it. */
async function toEnd(page: Page) {
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('End');
}

test('deadlock: build two locks with the form, find the cycle, terminate T1, axe clean', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/deadlock');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deadlock');

  // Retry until hydrated: a change made before React attaches is lost.
  await expect(async () => {
    await page.getByRole('button', { name: 'Clear graph' }).click();
    await expect(page.getByText(/^Cleared:/)).toBeVisible({ timeout: 500 });
  }).toPass();
  await expect(page.getByTestId('graph-summary')).toContainText('No cycle.');

  const form = page.getByRole('form', { name: 'Add an edge' });
  const addEdge = async (thread: string, verb: string, resource: string) => {
    await form.getByLabel('Thread').selectOption(thread);
    await form.getByLabel('Edge').selectOption(verb);
    await form.getByLabel('Resource').selectOption(resource);
    await form.getByRole('button', { name: 'Add edge' }).press('Enter');
    await expect(
      page.getByText(`Added: ${thread} ${verb} 1 of ${resource}.`, { exact: true }),
    ).toBeVisible();
  };
  await addEdge('T0', 'holds', 'R0');
  await addEdge('T1', 'holds', 'R1');
  await addEdge('T0', 'requests', 'R1');
  await addEdge('T1', 'requests', 'R0');

  await expect(page.getByTestId('graph-summary')).toContainText(
    'Cycle: T0 → R1 → T1 → R0 → T0.',
  );
  // The canvas is an extra view of the same graph.
  await expect(page.getByTestId('graph-canvas')).toContainText('R1');

  await toEnd(page);
  await expect(page.getByTestId('dl-result')).toHaveText(
    'Deadlocked: cycle T0 → R1 → T1 → R0 → T0.',
  );
  const inspector = page.getByRole('region', { name: 'Inspector' });
  await expect(inspector).toContainText('Deadlock: cycle T0 → R1 → T1 → R0 → T0.');
  await expect(
    page
      .locator('[data-condition="mutual-exclusion"]')
      .getByText('Assumed', { exact: true }),
  ).toBeVisible();

  await page.getByLabel('Thread to terminate').selectOption('T1');
  await page.getByRole('button', { name: 'Terminate T1' }).click();
  await expect(inspector).toContainText('Recovery: terminate T1.');
  await toEnd(page);
  await expect(page.getByTestId('dl-result')).toHaveText(
    'Not deadlocked: the wait-for graph has no cycle.',
  );
  await expect(page.getByTestId('graph-summary')).toContainText('T1 was terminated.');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('deadlock: Banker’s, grant T1, keep it, T0 (0, 2, 0) is refused, link round-trips, axe clean', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/deadlock');
  await expect(async () => {
    await page.getByRole('tab', { name: 'Banker’s' }).click();
    await expect(page.getByRole('tab', { name: 'Banker’s' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 500 },
    );
  }).toPass();

  await page.getByLabel('Preset', { exact: true }).selectOption('osc10-t1');
  await page.getByRole('button', { name: 'Load preset' }).click();
  await toEnd(page);
  await expect(page.getByTestId('dl-result')).toHaveText(
    'Granted: the state after the request is safe.',
  );
  await page.getByRole('button', { name: 'Keep the new state' }).click();
  await expect(page.getByText(/^Kept the new state/)).toBeVisible();

  const form = page.getByRole('form', { name: 'Make a request' });
  await form.getByLabel('Requesting thread').selectOption('T0');
  for (const [resource, value] of [
    ['R0', '0'],
    ['R1', '2'],
    ['R2', '0'],
  ] as const) {
    await form.getByLabel(`Request ${resource}`).fill(value);
  }
  await form.getByRole('button', { name: 'Run request' }).click();
  await toEnd(page);
  await expect(page.getByTestId('dl-result')).toHaveText(
    'Refused: the state after the request would be unsafe, so the thread waits.',
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  // The URL keeps the tab, the kept state, the request and the step.
  await expect
    .poll(() => {
      const s = new URL(page.url()).searchParams.get('s');
      if (!s) return null;
      const state = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
      return {
        view: state.input.view,
        query: state.input.query,
        available: state.input.bankers.available,
        moved: state.step > 0,
      };
    })
    .toEqual({
      view: 'bankers',
      query: { run: 'request', t: 0, request: [0, 2, 0] },
      available: [2, 3, 0],
      moved: true,
    });
  const url = page.url();
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.getByRole('tab', { name: 'Banker’s' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByTestId('dl-result')).toHaveText(/^Refused/);
  expect(errors).toEqual([]);
});
