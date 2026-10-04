/**
 * What every replacement policy works on: the frames and the bookkeeping each policy
 * reads. All four policies share one `Memory`, so the engine (`../engine.ts`) keeps every
 * field up to date and each policy only decides which frame to empty.
 *
 * Every function returns a new value; a snapshot can share them safely.
 */

import type { CitationId } from '../../citations/types';
import type { Policy } from '../input';

export interface Memory {
  /** Page in each frame, `null` when empty. */
  frames: (number | null)[];
  /** Reference index that loaded each frame's page (FIFO); `null` when empty. */
  loadedAt: (number | null)[];
  /** Reference index of each frame's last use (LRU); `null` when empty. */
  lastUse: (number | null)[];
  /** Clock's use bit per frame; 0 when empty. */
  useBits: (0 | 1)[];
  /** Clock's hand: the frame the next sweep starts at. */
  hand: number;
}

/** One step of a Clock sweep: a frame whose use bit was 1, cleared, and the hand moved on. */
export interface ClockScan {
  frame: number;
  page: number;
  /** Memory after the bit is cleared and the hand has moved. */
  memory: Memory;
}

export interface VictimChoice {
  frame: number;
  /** Clock only: the frames passed over before the victim. Empty for the others. */
  scans: ClockScan[];
  /** Memory after the scans (Clock: bits cleared, hand on the victim). */
  memory: Memory;
  /** Completes "Evict P: …", e.g. "loaded first (FIFO)". Always says why. */
  reason: string;
  /** A longer explanation, e.g. the tie-break when there was one. */
  detail: string;
  citation: CitationId;
}

export interface VictimContext {
  refString: readonly number[];
  /** Index of the reference being served. */
  index: number;
}

export interface ReplacementPolicy {
  id: Policy;
  /** Called on a fault when every frame is full. */
  chooseVictim(memory: Memory, context: VictimContext): VictimChoice;
}

export function emptyMemory(frames: number): Memory {
  return {
    frames: Array.from({ length: frames }, () => null),
    loadedAt: Array.from({ length: frames }, () => null),
    lastUse: Array.from({ length: frames }, () => null),
    useBits: Array.from({ length: frames }, () => 0 as const),
    hand: 0,
  };
}

export function copyMemory(memory: Memory): Memory {
  return {
    frames: [...memory.frames],
    loadedAt: [...memory.loadedAt],
    lastUse: [...memory.lastUse],
    useBits: [...memory.useBits],
    hand: memory.hand,
  };
}

/** The frame holding `page`, or -1. */
export function frameOf(memory: Memory, page: number): number {
  return memory.frames.indexOf(page);
}

/** Pages listed in a sentence: "2", "2 and 5", "2, 5 and 7". */
export function listPages(pages: readonly number[]): string {
  if (pages.length <= 1) return pages.join('');
  return `${pages.slice(0, -1).join(', ')} and ${pages.at(-1)}`;
}
