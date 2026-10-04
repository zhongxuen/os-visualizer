import { describe, expect, it } from 'vitest';

import {
  formatRefString,
  generate,
  GENERATE_SCHEMA,
  hotPages,
  parseRefString,
  REPL_PRESETS,
  validateReplInput,
} from '@/core/replace';

describe('input schema', () => {
  it('accepts every preset', () => {
    for (const preset of REPL_PRESETS) {
      expect(validateReplInput(preset.input).ok, preset.id).toBe(true);
    }
  });

  it('enforces the limits with messages against the right field', () => {
    const bad = validateReplInput({
      refString: [1, 16, Number.NaN],
      frames: 9,
      policy: 'random',
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    const paths = bad.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining(['refString.1', 'refString.2', 'frames', 'policy']),
    );
    expect(validateReplInput({ refString: [], frames: 3, policy: 'lru' }).ok).toBe(false);
    expect(
      validateReplInput({ refString: Array(41).fill(0), frames: 3, policy: 'lru' }).ok,
    ).toBe(false);
    expect(validateReplInput({ refString: [0], frames: 0, policy: 'lru' }).ok).toBe(
      false,
    );
  });

  it('parses and formats reference strings, keeping bad tokens in place', () => {
    expect(parseRefString('7 0 1, 2;3\n4')).toEqual([7, 0, 1, 2, 3, 4]);
    const bad = parseRefString('1, x, 2');
    expect(bad[1]).toBeNaN();
    expect(parseRefString(formatRefString([7, 0, 1]))).toEqual([7, 0, 1]);
  });
});

describe('generated workloads', () => {
  it('the same options give the same string', () => {
    const options = { kind: 'uniform', length: 40, pages: 8, seed: 7 } as const;
    expect(generate(options)).toEqual(generate(options));
    expect(generate(options)).not.toEqual(generate({ ...options, seed: 8 }));
  });

  it('stays within the length and page range', () => {
    for (const kind of ['uniform', 'hotcold', 'loop'] as const) {
      for (const pages of [1, 5, 16]) {
        const refs = generate({ kind, length: 40, pages, seed: 3 });
        expect(refs).toHaveLength(40);
        expect(refs.every((p) => Number.isInteger(p) && p >= 0 && p < pages)).toBe(true);
      }
    }
  });

  it('looping is 0..N−1 repeated', () => {
    expect(generate({ kind: 'loop', length: 7, pages: 3, seed: 0 })).toEqual([
      0, 1, 2, 0, 1, 2, 0,
    ]);
  });

  it('80/20 sends most references to the hot 20% of pages', () => {
    let hot = 0;
    let total = 0;
    for (let seed = 0; seed < 50; seed += 1) {
      const refs = generate({ kind: 'hotcold', length: 40, pages: 10, seed });
      hot += refs.filter((p) => p < hotPages(10)).length;
      total += refs.length;
    }
    expect(hotPages(10)).toBe(2);
    expect(hot / total).toBeGreaterThan(0.75);
    expect(hot / total).toBeLessThan(0.85);
  });

  it('validates generator options', () => {
    expect(
      GENERATE_SCHEMA.safeParse({ kind: 'loop', length: 41, pages: 3, seed: 0 }).success,
    ).toBe(false);
    expect(
      GENERATE_SCHEMA.safeParse({ kind: 'hotcold', length: 10, pages: 16, seed: 1 })
        .success,
    ).toBe(true);
  });
});
