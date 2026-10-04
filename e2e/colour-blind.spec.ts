import { expect, test, type Page } from '@playwright/test';

/**
 * The colour-blind check: the Gantt chart and the frame strip under a simulated
 * deuteranopia filter (the commonest form, red-green), screenshotted for a person to
 * look at and checked by machine for what must survive without colour.
 *
 * - Gantt: every process has its own fill pattern, and a segment wide enough for text
 *   carries its PID, so two processes never differ by hue alone.
 * - Frame strip: a hit and a fault, and the frame a page was loaded into, are words
 *   ("hit", "fault", "in"), not colours.
 *
 * The screenshots are attached to the test report (and written to test-results/).
 */

/** Machado et al. (2009) deuteranopia matrix, severity 1.0. */
const DEUTERANOPIA = [
  '0.367 0.861 -0.228 0 0',
  '0.280 0.673 0.047 0 0',
  '-0.012 0.043 0.969 0 0',
  '0 0 0 1 0',
].join(' ');

async function simulateDeuteranopia(page: Page) {
  await page.evaluate((matrix) => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('style', 'position:absolute;width:0;height:0');
    svg.innerHTML = `<filter id="deuteranopia"><feColorMatrix type="matrix" values="${matrix}"/></filter>`;
    document.body.appendChild(svg);
    document.documentElement.style.filter = 'url(#deuteranopia)';
  }, DEUTERANOPIA);
}

async function load(page: Page, path: string, preset: string, loaded: string) {
  await page.goto(path);
  await expect(async () => {
    await page.getByLabel('Preset', { exact: true }).selectOption(preset);
    await page.getByRole('button', { name: 'Load preset' }).click();
    await expect(page.getByText(loaded)).toBeVisible({ timeout: 500 });
  }).toPass();
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('End');
}

test('Gantt chart: every process keeps its own pattern and label', async ({
  page,
}, testInfo) => {
  await load(page, '/scheduling', 'osc-srtf', 'Loaded preset: OSC10 SRTF (arrivals 0–3)');
  await simulateDeuteranopia(page);

  const chart = page.getByRole('group', { name: /^Gantt chart/ }).first();
  const shot = await chart.screenshot({
    path: testInfo.outputPath('gantt-deuteranopia.png'),
  });
  await testInfo.attach('gantt-deuteranopia', { body: shot, contentType: 'image/png' });

  const segments = await chart.locator('g[data-kind="run"]').evaluateAll((groups) =>
    groups.map((g) => ({
      pattern: g.querySelector('rect')?.getAttribute('fill') ?? '',
      label: g.querySelector('text')?.textContent ?? null,
    })),
  );
  expect(segments.length).toBeGreaterThan(0);
  // One pattern per process, and every label names the process its pattern belongs to.
  const byPattern = new Map<string, Set<string>>();
  for (const s of segments) {
    expect(s.pattern).toMatch(/^url\(#/);
    if (!byPattern.has(s.pattern)) byPattern.set(s.pattern, new Set());
    if (s.label) byPattern.get(s.pattern)!.add(s.label);
  }
  expect(byPattern.size).toBe(4); // P1..P4
  for (const labels of byPattern.values()) expect(labels.size).toBeLessThanOrEqual(1);
  const labels = [...byPattern.values()].flatMap((set) => [...set]);
  expect(new Set(labels).size).toBe(labels.length);
});

test('Frame strip: hits, faults and loads are words', async ({ page }, testInfo) => {
  await load(page, '/replacement', 'belady', 'Loaded preset: Belady’s anomaly (FIFO)');
  await simulateDeuteranopia(page);

  const strip = page.getByRole('table', { name: /frames after each reference/ });
  const shot = await strip.screenshot({
    path: testInfo.outputPath('framestrip-deuteranopia.png'),
  });
  await testInfo.attach('framestrip-deuteranopia', {
    body: shot,
    contentType: 'image/png',
  });

  const results = await strip.locator('tfoot td').allTextContents();
  expect(results).toHaveLength(12);
  expect(results.filter((r) => r === 'fault')).toHaveLength(9);
  expect(results.filter((r) => r === 'hit')).toHaveLength(3);
  // Every fault loads a page into a frame, and says so in words.
  await expect(strip.locator('td[data-loaded]')).toHaveCount(9);
  for (const cell of await strip.locator('td[data-loaded]').all()) {
    await expect(cell).toContainText('in');
  }
});
