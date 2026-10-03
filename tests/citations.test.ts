import { describe, expect, it } from 'vitest';

import { citations } from '@/core/citations';
import { scenarios } from '@/core/scenarios';

/**
 * Every event in every scenario cites something real, and every OSTEP citation links to
 * its chapter. Passes on an empty catalogue and gains a test per scenario as modules
 * land.
 */

const OSTEP_URL = /^https:\/\/pages\.cs\.wisc\.edu\/~remzi\/OSTEP\/[\w-]+\.pdf$/;

describe('citations', () => {
  it('gives every OSTEP citation a chapter PDF url', () => {
    for (const citation of citations.all) {
      if (citation.source === 'OSTEP')
        expect(citation.url, citation.id).toMatch(OSTEP_URL);
    }
  });

  for (const scenario of scenarios) {
    it(`${scenario.id}: every event's citation is registered`, () => {
      const unknown = scenario
        .run()
        .events.filter((event) => !citations.has(event.citation))
        .map((event) => `${event.id} → ${event.citation}`);
      expect(unknown).toEqual([]);
    });
  }
});
