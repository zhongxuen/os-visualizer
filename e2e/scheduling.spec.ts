import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('scheduling: OSC10 SJF preset, keyboard to the end, average waiting 7, axe clean', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/scheduling');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CPU Scheduling');

  // Keyboard only: choose the preset, press Load, then End.
  await page.getByLabel('Preset', { exact: true }).focus();
  await page.getByLabel('Preset', { exact: true }).selectOption('osc-sjf');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Load preset' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Loaded preset: OSC10 SJF (6, 8, 7, 3)')).toBeVisible();

  await page.keyboard.press('End');
  await expect(page.getByTestId('avg-waiting')).toHaveText('7');
  await expect(
    page.getByRole('heading', { name: 'At t = 24', exact: true }),
  ).toBeVisible();

  // Step back one tick with the arrow key: P2 has not finished yet.
  await page.keyboard.press('ArrowLeft');
  await expect(
    page.getByRole('heading', { name: 'At t = 23', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('End');

  // "Show as table" works.
  await page.getByRole('button', { name: 'Show as table' }).first().click();
  await expect(page.getByRole('cell', { name: 'P2' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Show as chart' }).first().click();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('scheduling: the URL reproduces the workload, policy and step', async ({ page }) => {
  await page.goto('/scheduling');
  // Retry until hydrated: a change made before React attaches is lost.
  await expect(async () => {
    await page.getByLabel('Preset', { exact: true }).selectOption('osc-rr');
    await page.getByRole('button', { name: 'Load preset' }).click();
    await expect(page.getByText('Loaded preset: OSC10 Round Robin, q = 4')).toBeVisible({
      timeout: 500,
    });
  }).toPass();
  await page.keyboard.press('End');
  await expect(page.getByTestId('avg-waiting')).toHaveText('5.67');
  await expect(page).toHaveURL(/\?s=/);

  const url = page.url();
  await page.goto('about:blank');
  await page.goto(url);
  await expect(
    page.getByRole('heading', { name: 'At t = 30', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('avg-waiting')).toHaveText('5.67');
  await expect(page.getByRole('heading', { level: 2, name: 'RR q=4' })).toBeVisible();
});
