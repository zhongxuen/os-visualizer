import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('sync: find a lost update with the keyboard, then the mutex leaves one outcome', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/sync');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Synchronisation');

  // Keyboard only: reach "Clear picks" with Tab, press it, then pick threads with 1 and 2.
  const clear = page.getByRole('button', { name: 'Clear picks' });
  await expect(async () => {
    await clear.focus();
    await expect(clear).toBeFocused({ timeout: 500 });
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('trace')).toHaveText('nothing yet', { timeout: 500 });
  }).toPass();

  // T0 loads and adds; T1 runs its whole increment; T0 stores its stale value.
  for (const key of ['1', '1', '2', '2', '2', '1']) await page.keyboard.press(key);
  await expect(page.getByTestId('trace')).toHaveText('T0 T0 T1 T1 T1 T0');
  await expect(page.getByTestId('var-counter')).toHaveText('1');
  await expect(page.getByTestId('run-verdict')).toContainText('1 update was lost');

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

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('sync: a seeded random schedule replays from the URL', async ({ page }) => {
  await page.goto('/sync');
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
  await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('7');
  await expect(page.getByTestId('trace')).toHaveText(trace!);
});
