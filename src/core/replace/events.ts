import type { EventBase } from '../events/types';

/**
 * Page replacement events. One phase per reference; its events are `repl.hit`, or
 * `repl.fault` → (Clock: `repl.scan` for each use bit cleared) → `repl.victim` →
 * `repl.evict` → `repl.load`. A fault while a frame is empty skips straight to the load.
 * Every event carries the full state after it (`ReplSnapshot`), so the UI steps by
 * lookup and never re-simulates.
 *
 * Plain JSON only: optional fields are left out, never `undefined`.
 */

export type ReplEventKind =
  /** The page is resident. */
  | 'repl.hit'
  /** The page is not resident: a page fault. */
  | 'repl.fault'
  /** Clock: the hand passes a frame with use bit 1, clears it and moves on. */
  | 'repl.scan'
  /** The policy picks the frame to empty, and says why. */
  | 'repl.victim'
  /** The victim page leaves its frame. */
  | 'repl.evict'
  /** The referenced page is loaded into a frame. */
  | 'repl.load';

export interface ReplCounters {
  hits: number;
  faults: number;
  /** Faults on a page's first reference (compulsory misses). The rest are capacity misses. */
  cold: number;
}

export interface ReplSnapshot extends ReplCounters {
  /** Index of the reference being served (0-based). */
  index: number;
  /** Page in each frame, `null` when empty. */
  frames: (number | null)[];
  /** Clock: use bit per frame. */
  useBits?: (0 | 1)[];
  /** Clock: the frame the hand points at. */
  hand?: number;
  /** FIFO: resident pages, loaded first at the front. */
  queue?: number[];
  /** LRU: reference index of each frame's last use; `null` when empty. */
  lastUse?: (number | null)[];
  /**
   * OPT: reference index of each frame's next use after `index`; `null` when the frame is
   * empty or its page is never used again.
   */
  nextUse?: (number | null)[];
}

export type ReplEvent = EventBase & {
  kind: ReplEventKind;
  /**
   * The page the event is about: the page referenced (hit, fault, load), the page in the
   * frame passed over (scan), or the page leaving (victim, evict).
   */
  page: number;
  /** The frame the event is about; absent on a fault. */
  frame?: number;
  /** On a fault: true when this is the page's first reference. */
  cold?: boolean;
  /** On a load: the page this load replaced, when it replaced one. */
  evicted?: number;
  state: ReplSnapshot;
};
