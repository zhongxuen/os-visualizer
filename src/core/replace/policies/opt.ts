import { listPages, type ReplacementPolicy } from './types';

/**
 * The index of the next reference to `page` after `index`, or `null` when it is never
 * referenced again (which OPT treats as infinitely far away).
 */
export function nextUse(
  refString: readonly number[],
  page: number,
  index: number,
): number | null {
  for (let j = index + 1; j < refString.length; j += 1) {
    if (refString[j] === page) return j;
  }
  return null;
}

/**
 * OPT (Belady's MIN): evict the page whose next use is furthest away; a page never used
 * again is infinitely far (OSTEP §22.2, OSC10 §10.4.3). Two pages can only tie when
 * neither is used again; then the page in the lowest-numbered frame goes.
 */
export const opt: ReplacementPolicy = {
  id: 'opt',
  chooseVictim(memory, { refString, index }) {
    const next = memory.frames.map((page) => nextUse(refString, page!, index));
    const distance = (n: number | null) => (n === null ? Infinity : n);
    let frame = 0;
    next.forEach((n, f) => {
      if (distance(n) > distance(next[frame]!)) frame = f;
    });
    const page = memory.frames[frame]!;
    const at = next[frame]!;
    if (at === null) {
      const never = memory.frames.filter((_, f) => next[f] === null) as number[];
      return {
        frame,
        scans: [],
        memory,
        reason: 'not needed again (OPT)',
        detail:
          never.length > 1
            ? `Pages ${listPages(never)} are never referenced again. On a tie the page in the lowest-numbered frame goes: frame ${frame}.`
            : `Page ${page} is never referenced again, so evicting it costs nothing.`,
        citation: 'ostep.22.2',
      };
    }
    return {
      frame,
      scans: [],
      memory,
      reason: `next needed at reference ${at + 1}, the furthest away (OPT)`,
      detail:
        'Every other page in memory is needed sooner. OPT looks into the future, so no real system can run it; it is the yardstick for the others.',
      citation: 'ostep.22.2',
    };
  },
};
