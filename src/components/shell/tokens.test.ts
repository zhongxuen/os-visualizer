import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Contrast of the token pairs that matter, in both themes, read straight out of
 * tokens.css so a changed value cannot slip past. WCAG 2 relative luminance.
 */

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

/** The declarations in the first block that starts with `selector {`. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No block for ${selector}`);
  const end = css.indexOf('}', start);
  const body = css.slice(start, end);
  return Object.fromEntries(
    [...body.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1]!, m[2]!]),
  );
}

const LIGHT = block(':root');
const DARK_MEDIA = block(":root:not([data-theme='light'])");
const DARK = { ...LIGHT, ...block(":root[data-theme='dark']") };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const SURFACES = ['--bg-base', '--bg-raised', '--bg-overlay'];
const TEXT = [
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--text-dim',
  '--accent',
];
const STATE = ['--state-ok', '--state-warn', '--state-error', '--state-pending'];

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
])('%s theme', (_, theme) => {
  it.each(SURFACES)('text and accent read at 4.5:1 on %s', (surface) => {
    for (const text of [...TEXT, ...STATE]) {
      expect(
        contrast(theme[text]!, theme[surface]!),
        `${text} on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(SURFACES)('borders read at 3:1 on %s', (surface) => {
    expect(contrast(theme['--border']!, theme[surface]!)).toBeGreaterThanOrEqual(3);
  });

  it('accent ink reads on the filled accent and state colours', () => {
    for (const fill of ['--accent', '--state-error']) {
      expect(contrast(theme['--accent-ink']!, theme[fill]!), fill).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

describe('the two dark blocks', () => {
  it('declare the same values, so OS dark and chosen dark look the same', () => {
    expect(DARK_MEDIA).toEqual(block(":root[data-theme='dark']"));
  });
});

describe('process palette', () => {
  it('has ten fills, each carrying its PID text at 4.5:1', () => {
    const fills = Array.from({ length: 10 }, (_, i) => LIGHT[`--proc-${i}`]);
    expect(fills.every(Boolean)).toBe(true);
    expect(new Set(fills).size).toBe(10);
    for (const [i, fill] of fills.entries()) {
      expect(contrast(LIGHT['--proc-ink']!, fill!), `--proc-${i}`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});
