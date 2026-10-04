import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('replacement: Belady preset, both runs to the end, 9 vs 10 faults, axe clean', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/replacement');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page Replacement');

  // Keyboard only: choose the preset, press Load, then End on the main run.
  await page.getByLabel('Preset', { exact: true }).focus();
  await page.getByLabel('Preset', { exact: true }).selectOption('belady');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Load preset' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Loaded preset: Belady’s anomaly (FIFO)')).toBeVisible();

  await page.keyboard.press('End');
  await expect(page.getByTestId('faults')).toHaveText('9');
  await expect(page.getByTestId('refs-done')).toHaveText('12 / 12');

  // The Belady panel: FIFO with 3 and 4 frames on one cursor, stepped to the end.
  const panel = page.getByRole('region', { name: /Belady’s anomaly: one frame more/ });
  await panel.getByRole('button', { name: 'Last' }).click();
  await expect(panel.getByTestId('belady-faults-small')).toHaveText('9');
  await expect(panel.getByTestId('belady-faults-large')).toHaveText('10');
  await expect(panel.getByText(/More memory, more faults/)).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('replacement: the URL keeps the string, policy and step', async ({ page }) => {
  await page.goto('/replacement');
  // Retry until hydrated: a change made before React attaches is lost.
  await expect(async () => {
    await page.getByLabel('Preset', { exact: true }).selectOption('ostep');
    await page.getByRole('button', { name: 'Load preset' }).click();
    await expect(page.getByText('Loaded preset: OSTEP reference string')).toBeVisible({
      timeout: 500,
    });
  }).toPass();
  await page.getByRole('tab', { name: /LRU/ }).click();
  await page.locator('body').click({ position: { x: 1, y: 1 } });
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
