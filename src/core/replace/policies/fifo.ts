import type { ReplacementPolicy } from './types';

/**
 * FIFO: evict the page that was loaded earliest (OSTEP §22.3, OSC10 §10.4.2). Load times
 * are distinct reference indexes, so there is never a tie.
 */
export const fifo: ReplacementPolicy = {
  id: 'fifo',
  chooseVictim(memory) {
    let frame = 0;
    memory.loadedAt.forEach((at, f) => {
      if (at! < memory.loadedAt[frame]!) frame = f;
    });
    const at = memory.loadedAt[frame]!;
    return {
      frame,
      scans: [],
      memory,
      reason: 'loaded first (FIFO)',
      detail: `Page ${memory.frames[frame]} was loaded at reference ${at + 1}, before every other page in memory. FIFO ignores how recently or how often a page is used.`,
      citation: 'ostep.22.3',
    };
  },
};
