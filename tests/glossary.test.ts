import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GLOSSARY, glossaryEntry } from '@/content/glossary';
import { MODULES } from '@/modules/registry';

/**
 * The glossary's own invariants, and a static scan proving every `<Term id>` in the
 * source names an entry (docs/UIUX.md §2.2 G2). MDX lessons are not typechecked, so the
 * scan is what catches a typo there.
 */

const ROOT = join(__dirname, '..');

/** The terms the U2.2 prompt requires, by id. */
const REQUIRED = [
  'process',
  'thread',
  'tick',
  'burst',
  'cpu-burst',
  'io-burst',
  'arrival',
  'quantum',
  'preempt',
  'context-switch',
  'ready-queue',
  'waiting-time',
  'turnaround-time',
  'response-time',
  'throughput',
  'utilisation',
  'starvation',
  'aging',
  'mlfq',
  'virtual-address',
  'physical-address',
  'page',
  'frame',
  'offset',
  'vpn',
  'pfn',
  'pte',
  'pde',
  'ptbr',
  'tlb',
  'tlb-hit-miss',
  'valid-bit',
  'protection-bit',
  'page-fault',
  'reference-string',
  'victim',
  'cold-fault',
  'capacity-fault',
  'beladys-anomaly',
  'use-bit',
  'resource-allocation-graph',
  'wait-for-graph',
  'deadlock',
  'safe-state',
  'safe-sequence',
  'need',
  'work',
  'available',
  'mutual-exclusion',
  'hold-and-wait',
  'no-preemption',
  'circular-wait',
  'race-condition',
  'critical-section',
  'mutex',
  'semaphore',
  'lost-update',
];

function words(text: string): number {
  return text.trim().split(/\s+/).length;
}

describe('glossary', () => {
  it('has unique ids and unique terms', () => {
    const ids = GLOSSARY.map((e) => e.id);
    const terms = GLOSSARY.map((e) => e.term.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(terms).size).toBe(terms.length);
  });

  it('uses kebab-case ids', () => {
    for (const { id } of GLOSSARY) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('covers every required term', () => {
    expect(REQUIRED.filter((id) => !glossaryEntry(id))).toEqual([]);
  });

  it('keeps short definitions to 25 words, and fills every field', () => {
    for (const entry of GLOSSARY) {
      expect(words(entry.short), entry.id).toBeLessThanOrEqual(25);
      expect(entry.long.length, entry.id).toBeGreaterThan(entry.short.length / 2);
      expect(entry.modules.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('names only modules in the registry', () => {
    const slugs = new Set(MODULES.map((m) => m.slug));
    for (const entry of GLOSSARY) {
      for (const slug of entry.modules) expect(slugs, entry.id).toContain(slug);
    }
  });
});

/** Every `.ts`, `.tsx` and `.mdx` file under a directory. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => {
    const path = join(dir, dirent.name);
    if (dirent.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|mdx)$/.test(dirent.name) ? [path] : [];
  });
}

const TERM_TAG = /<Term\b[^>]*>/g;
const LITERAL_ID = /\bid=(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)')\s*\})/;

/**
 * The ids a file's `<Term>` tags use; a non-literal id is reported as `{dynamic}`. A tag
 * with no `id=` at all is prose about the component ("`<Term id>`" in a comment); in code
 * the prop type requires one.
 */
function termIds(source: string): string[] {
  return [...source.matchAll(TERM_TAG)].flatMap(([tag]) => {
    if (!/\bid=/.test(tag)) return [];
    const match = LITERAL_ID.exec(tag);
    if (!match) return ['{dynamic}'];
    return [match.slice(1).find((group) => group !== undefined)!];
  });
}

describe('<Term id> static scan', () => {
  it('reads literal ids in every quoting style, and flags anything else', () => {
    expect(
      termIds(`<Term id="tlb">x</Term> <Term id='vpn' /> <Term id={"pfn"}>y</Term>`),
    ).toEqual(['tlb', 'vpn', 'pfn']);
    expect(termIds('<Term id={someVariable}>z</Term>')).toEqual(['{dynamic}']);
    expect(termIds('<TermList /> <Terminal /> `<Term id>` <Term>')).toEqual([]);
  });

  it('finds only glossary ids in src/', () => {
    const uses = sourceFiles(join(ROOT, 'src')).flatMap((file) =>
      termIds(readFileSync(file, 'utf8')).map((id) => ({
        file: relative(ROOT, file),
        id,
      })),
    );
    // The component's own tests use it, so the scan is never vacuous.
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter(({ id }) => !glossaryEntry(id))).toEqual([]);
  });
});
