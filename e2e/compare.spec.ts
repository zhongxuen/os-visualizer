import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('compare: RR quantum sweep, context switches fall as the quantum grows, axe clean', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/compare');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compare schedulers');

  await page.getByLabel('Preset', { exact: true }).focus();
  await page.getByLabel('Preset', { exact: true }).selectOption('rr-sweep');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  for (const q of [1, 2, 4, 8]) {
    await expect(
      page.getByRole('group', { name: `Gantt chart, RR q=${q}`, exact: true }),
    ).toBeVisible();
  }

  await page.keyboard.press('End');
  await expect(page.getByRole('heading', { name: /^Metrics at t = \d+$/ })).toBeVisible();
  const row = page.getByRole('table', { name: /Side by side/ }).getByRole('row', {
    name: /Context switches/,
  });
  const cells = await row.getByRole('cell').allTextContents();
  const values = cells.map((text) => parseFloat(text));
  expect(values).toHaveLength(4);
  for (let i = 1; i < values.length; i += 1) {
    expect(values[i]!).toBeLessThan(values[i - 1]!);
  }
  await expect(page.getByTestId('why-line')).toContainText(
    'lowest average response time',
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(errors).toEqual([]);
});
