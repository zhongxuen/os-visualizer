import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { MODULES } from '../src/modules/registry';

test('home renders every registry module and is axe clean', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('OS Visualizer');

  for (const m of MODULES) {
    await expect(page.getByRole('heading', { level: 3, name: m.title })).toBeVisible();
  }

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(errors).toEqual([]);
});
