import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * Runs against a production build (`next build && next start`), not the dev server: the
 * dev server logs hydration and Fast Refresh noise a shipped page never will, and a
 * production build is what Vercel serves. Port 3100 so it never attaches to `npm run dev`.
 *
 * Chromium only locally; Chromium, Firefox and WebKit in CI.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
const DEPLOYED_URL = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/+$/, '');
const BASE_URL = DEPLOYED_URL || LOCAL_URL;
const CI = !!process.env.CI;

const browsers = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: CI ? browsers : browsers.slice(0, 1),

  webServer: DEPLOYED_URL
    ? undefined
    : {
        command: `npm run build && npx next start --port ${PORT}`,
        url: LOCAL_URL,
        reuseExistingServer: !CI,
        timeout: 300_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
