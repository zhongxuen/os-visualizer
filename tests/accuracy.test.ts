import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { citations } from '@/core/citations';
import { DL_RULES } from '@/core/deadlock/rules';
import { REPL_RULES } from '@/core/replace/rules';
import { scenarios } from '@/core/scenarios';
import { SCHED_RULES } from '@/core/sched/rules';
import { SYNC_RULES } from '@/core/sync/rules';
import { VM_RULES } from '@/core/vm/rules';

/**
 * `docs/ACCURACY.md` ⊇ everything the product cites.
 *
 * Every citation an event in any scenario uses, every citation registered at all, every
 * rule id a Rules panel shows, and every source a lesson's "Real systems" box links to
 * must appear in the accuracy document. A superset, not an exact match: the document may
 * list sources that back a preset or a lesson rather than a single event.
 */

const ROOT = process.cwd();
const ACCURACY = readFileSync(join(ROOT, 'docs/ACCURACY.md'), 'utf8');

function mentioned(id: string): boolean {
  return ACCURACY.includes(`\`${id}\``);
}

const RULES: readonly { id: string }[] = [
  ...SCHED_RULES,
  ...VM_RULES,
  ...REPL_RULES,
  ...DL_RULES,
  ...SYNC_RULES,
];

describe('docs/ACCURACY.md', () => {
  it('lists every citation an event uses', () => {
    const used = new Set<string>();
    for (const scenario of scenarios) {
      for (const event of scenario.run().events) used.add(event.citation);
    }
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((id) => !mentioned(id))).toEqual([]);
  });

  it('lists every registered citation, with its OSTEP chapter link', () => {
    expect(citations.all.filter((c) => !mentioned(c.id)).map((c) => c.id)).toEqual([]);
    const missingUrls = citations.all
      .filter((c) => c.url && !ACCURACY.includes(c.url))
      .map((c) => c.id);
    expect(missingUrls).toEqual([]);
  });

  it('lists every modelling rule', () => {
    expect(RULES.filter((r) => !mentioned(r.id)).map((r) => r.id)).toEqual([]);
  });

  it('lists every source quoted in a lesson’s Real systems box', () => {
    const dir = join(ROOT, 'src/content/lessons');
    const urls = readdirSync(dir)
      .filter((f) => f.endsWith('.mdx'))
      .flatMap((f) => {
        const source = readFileSync(join(dir, f), 'utf8');
        return [...source.matchAll(/url: '([^']+)'/g)].map((m) => m[1]!);
      });
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((url) => !ACCURACY.includes(url))).toEqual([]);
  });
});
