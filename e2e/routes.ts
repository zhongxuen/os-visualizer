import type { Page } from '@playwright/test';

import { MODULES } from '../src/modules/registry';

/**
 * Every URL the product serves, derived from the registry, so a module flipped to
 * `ready` is scanned the same day. Module routes have two modes (Walkthrough and Free
 * play); the rest have one.
 */

export interface Route {
  name: string;
  path: string;
  module: boolean;
}

export const ROUTES: readonly Route[] = [
  { name: 'Home', path: '/', module: false },
  ...MODULES.filter((m) => m.status === 'ready').map((m) => ({
    name: m.title,
    path: m.route,
    module: true,
  })),
  { name: 'Learn', path: '/learn', module: false },
  { name: 'About', path: '/about', module: false },
  { name: 'Not found', path: '/no-such-page', module: false },
];

export type Theme = 'light' | 'dark';

/** Store the theme the way the theme toggle does, before the page's pre-paint script. */
export async function useTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem(
        'osv:v1',
        JSON.stringify({ v: 1, prefs: { theme: value } }),
      );
    } catch {
      // Storage blocked: the page falls back to the system theme.
    }
  }, theme);
}

/** Switch a module page to Free play, retrying until React has hydrated. */
export async function freePlay(page: Page): Promise<void> {
  const radio = page.getByRole('radio', { name: 'Free play' });
  for (let i = 0; i < 20; i += 1) {
    await radio.check({ force: true });
    if (await radio.isChecked()) {
      // The walkthrough panel goes away once the mode has changed.
      if ((await page.locator('[data-lesson]').count()) === 0) return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error('Free play did not take effect');
}
