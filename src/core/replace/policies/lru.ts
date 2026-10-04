import type { ReplacementPolicy } from './types';

/**
 * LRU: evict the page used least recently (OSTEP §22.5, OSC10 §10.4.4). Each reference
 * touches one page, so last-use times are distinct and there is never a tie.
 */
export const lru: ReplacementPolicy = {
  id: 'lru',
  chooseVictim(memory) {
    let frame = 0;
    memory.lastUse.forEach((at, f) => {
      if (at! < memory.lastUse[frame]!) frame = f;
    });
    const at = memory.lastUse[frame]!;
    return {
      frame,
      scans: [],
      memory,
      reason: 'not used for the longest time (LRU)',
      detail: `Page ${memory.frames[frame]} was last used at reference ${at + 1}, longer ago than every other page in memory. LRU bets that the recent past predicts the near future.`,
      citation: 'ostep.22.5',
    };
  },
};
