import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('translation: a fault step links to Page Replacement and the URL keeps the step', async ({
  page,
}) => {
  await page.goto('/translation');
  await page.getByLabel('Preset', { exact: true }).selectOption('invalid-page');
  await page.getByRole('button', { name: 'Load preset' }).click();
  await page.keyboard.press('End');
  const inspector = page.getByRole('region', { name: 'Inspector' });
  await expect(inspector.getByRole('link', { name: /Page Replacement/ })).toHaveAttribute(
    'href',
    '/replacement',
  );
  await expect(page.getByTestId('faults')).toHaveText('3');
  await expect(page).toHaveURL(/\?s=/);

  const url = page.url();
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.getByTestId('faults')).toHaveText('3');
  await expect(page.getByTestId('accesses-done')).toHaveText('5 / 5');
});
