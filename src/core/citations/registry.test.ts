import { describe, expect, it } from 'vitest';

import { citations } from './index';
import { createRegistry } from './registry';
import type { Citation } from './types';

const OSTEP: Citation = {
  id: 'ostep.7',
  source: 'OSTEP',
  chapter: 7,
  title: 'Scheduling: Introduction',
  url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf',
};

describe('createRegistry', () => {
  it('looks citations up by id across lists', () => {
    const osc: Citation = {
      id: 'osc10.5',
      source: 'OSC10',
      chapter: 5,
      title: 'CPU Scheduling',
    };
    const registry = createRegistry([[OSTEP], [osc]]);
    expect(registry.get('osc10.5')).toBe(osc);
    expect(registry.has('ostep.7')).toBe(true);
    expect(registry.has('ostep.99')).toBe(false);
    expect(registry.all).toEqual([OSTEP, osc]);
  });

  it('rejects duplicate ids', () => {
    expect(() => createRegistry([[OSTEP], [OSTEP]])).toThrow(/Duplicate citation id/);
  });

  it('requires a url on OSTEP citations', () => {
    expect(() => createRegistry([[{ ...OSTEP, url: undefined }]])).toThrow(
      /must have a url/,
    );
  });
});

describe('the project registry', () => {
  it('builds and includes the general citations', () => {
    expect(citations.get('ostep.4')?.url).toMatch(
      /^https:\/\/pages\.cs\.wisc\.edu\/~remzi\/OSTEP\/.+\.pdf$/,
    );
  });
});
