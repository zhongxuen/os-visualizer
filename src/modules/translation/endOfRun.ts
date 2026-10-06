/**
 * The end-of-run card's words (G16): the result in one sentence, and "Try this next", a
 * preset that contrasts with the run just watched. Pure, read off the run's last event.
 */

import { canonicalJson } from '@/components/lesson/examples';
import type { VmInput } from '@/core/vm/config';
import type { VmCounters } from '@/core/vm/events';
import { VM_PRESETS, type VmPreset } from '@/core/vm/presets';

import { hitRate } from './adapters';

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** "10 accesses: 7 TLB hits and 3 misses (70%), 13 memory references, no faults." */
export function resultSentence(counters: VmCounters): string {
  const { accesses, hits, misses, faults, memRefs } = counters;
  const rate = hits + misses > 0 ? ` (${hitRate(counters)} hit rate)` : '';
  const faultText = faults === 0 ? 'no faults' : plural(faults, 'fault');
  const perAccess =
    accesses > 0 ? `, ${Math.round((memRefs / accesses) * 10) / 10} per access` : '';
  return `${plural(accesses, 'access', 'accesses')}: ${plural(hits, 'TLB hit')} and ${plural(misses, 'miss', 'misses')}${rate}; ${plural(memRefs, 'memory reference')}${perAccess}; ${faultText}.`;
}

/** Which preset contrasts with which, and why, in one line. */
const CONTRAST: Record<string, { id: string; why: string }> = {
  'ostep-array': {
    id: 'ostep-array-twice',
    why: 'Walk the same array again: its pages are still in the TLB, so every access hits.',
  },
  'ostep-array-twice': {
    id: 'tlb-thrash',
    why: 'A loop over one page more than the TLB holds: LRU evicts each page just before it is needed.',
  },
  'tlb-thrash': {
    id: 'ostep-array',
    why: 'Back to the array: neighbouring ints share a page, so most accesses hit.',
  },
  'ostep-paging': {
    id: 'ostep-array',
    why: 'The same translation with a TLB: watch a hit skip the page-table walk.',
  },
  'invalid-page': {
    id: 'read-only-write',
    why: 'A different fault: the page is mapped, but writing to it is not allowed.',
  },
  'read-only-write': {
    id: 'two-level',
    why: 'Two levels of page table: every miss costs one more memory reference.',
  },
  'two-level': {
    id: 'invalid-page',
    why: 'What happens when a page isn’t mapped at all: a page fault.',
  },
};

/** The preset `input` is, if any (the sizing panel's input doesn't count). */
export function presetOf(input: VmInput): VmPreset | null {
  const key = canonicalJson({
    config: input.config,
    pages: input.pages,
    directory: input.directory,
    accesses: input.accesses,
  });
  return VM_PRESETS.find((p) => canonicalJson(p.input) === key) ?? null;
}

/** The preset to try after this run, and why. */
export function tryNextFor(
  input: VmInput,
  counters: VmCounters,
): { preset: VmPreset; why: string } {
  const current = presetOf(input);
  const pick = current
    ? CONTRAST[current.id]
    : counters.hits >= counters.misses
      ? CONTRAST['ostep-array-twice']
      : CONTRAST['tlb-thrash'];
  const preset = VM_PRESETS.find((p) => p.id === pick?.id) ?? VM_PRESETS[0]!;
  return { preset, why: pick?.why ?? preset.summary };
}
