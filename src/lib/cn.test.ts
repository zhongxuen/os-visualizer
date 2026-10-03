import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cn, TYPE_SCALE } from './cn';

describe('cn', () => {
  it('keeps a text colour next to a named type-scale step', () => {
    expect(cn('text-fg-muted', 'text-caption')).toBe('text-fg-muted text-caption');
    expect(cn('text-small text-fg')).toBe('text-small text-fg');
  });

  it('still lets the last of two sizes win', () => {
    expect(cn('text-caption', 'text-story')).toBe('text-story');
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('registers every step tokens.css declares', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    const declared = [...css.matchAll(/--text-([a-z]+):/g)].map((m) => m[1]);
    // `--text-primary` and friends are colour tokens in :root, not scale steps.
    const scale = declared.filter(
      (name) => !['primary', 'secondary', 'muted', 'dim'].includes(name!),
    );
    expect(new Set(scale)).toEqual(new Set(TYPE_SCALE));
  });
});
