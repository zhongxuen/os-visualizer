// README and portfolio screenshots, taken from a production build.
//
//   npm run build && npx next start --port 3100   # in another shell
//   node scripts/screenshots.mjs [baseUrl]
//
// Writes docs/media/<name>.png at 1440 × 900, light theme, Free play, each module at the
// end of a preset's run.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from '@playwright/test';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:3100').replace(/\/+$/, '');
const OUT = join(process.cwd(), 'docs', 'media');
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: 'home', path: '/' },
  { name: 'scheduling', path: '/scheduling', preset: 'mlfq-gaming-old' },
  { name: 'translation', path: '/translation', preset: 'two-level' },
  { name: 'replacement', path: '/replacement', preset: 'belady' },
  { name: 'deadlock', path: '/deadlock', preset: 'osc10-detect-after' },
  { name: 'sync', path: '/sync', preset: 'counter-race' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  window.localStorage.setItem(
    'osv:v1',
    JSON.stringify({ v: 1, prefs: { theme: 'light' } }),
  );
});

for (const shot of SHOTS) {
  await page.goto(BASE + shot.path);
  await page.waitForLoadState('networkidle');
  if (shot.preset) {
    // Retry until hydrated: a change made before React attaches is lost.
    for (let i = 0; i < 30; i += 1) {
      await page.getByLabel('Preset', { exact: true }).selectOption(shot.preset);
      await page.getByRole('button', { name: 'Load preset' }).click();
      if (await page.getByText(/^Loaded preset:/).isVisible()) break;
      await page.waitForTimeout(200);
    }
    await page.getByRole('radio', { name: 'Free play' }).check({ force: true });
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.keyboard.press('End');
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.screenshot({ path: join(OUT, `${shot.name}.png`) });
  console.log('wrote', `docs/media/${shot.name}.png`);
}

await browser.close();
