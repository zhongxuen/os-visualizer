import { describe, expect, it } from 'vitest';

import { MODULES } from './registry';

describe('module registry', () => {
  it('lists the six modules from 00-overview §3 in order', () => {
    expect(MODULES.map((m) => m.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('has unique slugs and routes', () => {
    expect(new Set(MODULES.map((m) => m.slug)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.route)).size).toBe(MODULES.length);
  });

  it('puts only Synchronisation in phase 2', () => {
    expect(MODULES.filter((m) => m.phase === 2).map((m) => m.slug)).toEqual(['sync']);
  });
});
