import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Run axe on a rendered container, in light and then dark theme, and fail on any
 * violation. Same helper as Crypto Visualizer's `src/components/testing/axe.ts`.
 *
 * Colour contrast is off because jsdom doesn't lay out or paint; the e2e suite checks
 * contrast in a real browser. `region` is off because a component is tested outside a
 * page's landmarks.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  for (const theme of ['light', 'dark'] as const) {
    document.documentElement.setAttribute('data-theme', theme);
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    const summary = results.violations.map(
      (violation) =>
        `[${theme}] ${violation.id}: ${violation.nodes.map((node) => node.html).join(' | ')}`,
    );
    expect(summary).toEqual([]);
  }
  document.documentElement.removeAttribute('data-theme');
}
