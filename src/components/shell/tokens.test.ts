import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DURATION } from '@/components/motion/tokens';

/**
 * Contrast of every token pair that matters, in both themes, read straight out of
 * tokens.css so a changed value cannot slip past. WCAG 2 relative luminance.
 *
 * Aliases (`--bg-raised: var(--surface)`) are followed to the hex they end at, in the
 * theme being checked, so the old names are held to the same bar as the new ones.
 */

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

type Declarations = Record<string, string>;

/** The declarations in the first block that starts with `selector {`. */
function block(selector: string): Declarations {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No block for ${selector}`);
  // The block's own closing brace: the first `}` alone on its line.
  const rest = css.slice(start);
  const body = rest.slice(0, /\n\s*\}/.exec(rest)?.index ?? rest.length);
  return Object.fromEntries(
    [...body.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gim)].map((m) => [
      m[1]!,
      m[2]!.trim(),
    ]),
  );
}

const ROOT = block(':root');
const DARK_MEDIA = block(":root:not([data-theme='light'])");
const DARK_ATTR = block(":root[data-theme='dark']");

/** Follow `var(--x)` until a hex, in `theme`. */
function resolve(theme: Declarations, name: string, seen = new Set<string>()): string {
  const value = theme[name];
  if (value === undefined) throw new Error(`${name} is not declared`);
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const ref = /^var\((--[a-z0-9-]+)\)$/i.exec(value)?.[1];
  if (!ref || seen.has(ref))
    throw new Error(`${name} does not resolve to a hex: ${value}`);
  return resolve(theme, ref, seen.add(name));
}

const THEMES: [string, Declarations][] = [
  ['light', ROOT],
  ['dark', { ...ROOT, ...DARK_ATTR }],
];

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

const SLOTS = Array.from({ length: 10 }, (_, i) => i);

/** Every surface text or a control can sit on. */
const SURFACES = ['--bg', '--surface', '--surface-2'];

/** Everything drawn as text on a surface. */
const TEXT = [
  '--fg',
  '--fg-secondary',
  '--fg-muted',
  '--fg-dim',
  '--accent',
  '--accent-strong',
  '--ok',
  '--warn',
  '--danger',
  '--pending',
];

/** UI borders and the focus ring: WCAG 1.4.11, 3:1. */
const BORDERS = [
  '--border',
  '--border-strong',
  '--accent',
  ...SLOTS.map((i) => `--proc-edge-${i}`),
];

/** The names the built components read, each of which must land on a checked value. */
const ALIASES: Record<string, string> = {
  '--bg-base': '--bg',
  '--bg-raised': '--surface',
  '--bg-overlay': '--surface-2',
  '--text-primary': '--fg',
  '--text-secondary': '--fg-secondary',
  '--text-muted': '--fg-muted',
  '--text-dim': '--fg-dim',
  '--focus-ring': '--accent',
  '--state-ok': '--ok',
  '--state-warn': '--warn',
  '--state-error': '--danger',
  '--state-pending': '--pending',
};

describe.each(THEMES)('%s theme', (_, theme) => {
  const hex = (name: string) => resolve(theme, name);

  it.each(SURFACES)('every text token reads at 4.5:1 on %s', (surface) => {
    for (const text of TEXT) {
      expect(
        contrast(hex(text), hex(surface)),
        `${text} on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(SURFACES)('every UI border reads at 3:1 on %s', (surface) => {
    for (const border of BORDERS) {
      expect(
        contrast(hex(border), hex(surface)),
        `${border} on ${surface}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('accent ink reads on the filled accent and state colours', () => {
    for (const fill of ['--accent', '--accent-strong', '--danger']) {
      expect(contrast(hex('--accent-ink'), hex(fill)), fill).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the PID ink reads at 4.5:1 on every process fill', () => {
    for (const i of SLOTS) {
      expect(
        contrast(hex('--proc-ink'), hex(`--proc-${i}`)),
        `--proc-ink on --proc-${i}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the "idle" and "CS" labels read on their fills', () => {
    for (const fill of ['--idle-fill', '--cs-fill']) {
      expect(contrast(hex('--fg'), hex(fill)), fill).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('every alias the components read lands on its §5.1 token', () => {
    for (const [alias, target] of Object.entries(ALIASES)) {
      expect(hex(alias), alias).toBe(hex(target));
    }
  });

  it('keeps the tick grid and rules decorative: faint, never a text colour', () => {
    for (const surface of SURFACES) {
      expect(contrast(hex('--grid'), hex(surface))).toBeLessThan(3);
    }
  });
});

describe('the two dark blocks', () => {
  it('declare the same values, so OS dark and chosen dark look the same', () => {
    expect(DARK_MEDIA).toEqual(DARK_ATTR);
  });

  it('only override values, never aliases, so an alias follows the theme', () => {
    for (const name of Object.keys(DARK_ATTR)) {
      expect(DARK_ATTR[name], name).not.toMatch(/^var\(/);
    }
  });
});

describe('process palette', () => {
  it('has ten distinct fills and ten distinct edges per theme', () => {
    for (const [, theme] of THEMES) {
      const fills = SLOTS.map((i) => resolve(theme, `--proc-${i}`));
      const edges = SLOTS.map((i) => resolve(theme, `--proc-edge-${i}`));
      expect(new Set(fills).size).toBe(10);
      expect(new Set(edges).size).toBe(10);
    }
  });
});

describe('motion tokens', () => {
  it('match the durations the JS primitives use', () => {
    expect(ROOT['--dur-1']).toBe(`${DURATION.highlight}ms`);
    expect(ROOT['--dur-2']).toBe(`${DURATION.move}ms`);
    expect(ROOT['--dur-3']).toBe(`${DURATION.enter}ms`);
  });

  it('declare the three easings of §6.2', () => {
    expect(ROOT['--ease-out']).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(ROOT['--ease-inout']).toBe('cubic-bezier(0.6, 0, 0.3, 1)');
    expect(ROOT['--ease-snap']).toBe('cubic-bezier(0.3, 1.4, 0.5, 1)');
  });
});
