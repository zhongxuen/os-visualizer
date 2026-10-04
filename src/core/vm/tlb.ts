/**
 * A fully associative TLB with LRU or FIFO replacement (OSTEP §19.1, §19.6).
 *
 * The TLB is an array of slots, `null` when empty. Each entry remembers the access that
 * loaded it and the access that last used it; LRU evicts the smallest `lastUsed`, FIFO the
 * smallest `loadedAt`. A fill takes the lowest empty slot first. Both stamps are access
 * indexes, and one access touches at most one entry, so two full slots never tie; the
 * lowest-slot rule still decides, and is the tie-break, if they ever do.
 *
 * Every function returns a new array.
 */

import type { Prot, TlbPolicy } from './config';

export interface TlbEntry {
  vpn: number;
  pfn: number;
  prot: Prot;
  /** Index of the access that loaded the entry. FIFO evicts the smallest. */
  loadedAt: number;
  /** Index of the access that last used the entry. LRU evicts the smallest. */
  lastUsed: number;
}

export type Tlb = (TlbEntry | null)[];

export function createTlb(size: number): Tlb {
  return Array.from({ length: size }, () => null);
}

/** The slot holding `vpn`, or -1 on a miss. */
export function tlbLookup(tlb: Tlb, vpn: number): number {
  return tlb.findIndex((entry) => entry !== null && entry.vpn === vpn);
}

/** Record a hit on `slot` at access `now`. */
export function tlbTouch(tlb: Tlb, slot: number, now: number): Tlb {
  return tlb.map((entry, i) =>
    i === slot && entry ? { ...entry, lastUsed: now } : entry,
  );
}

/**
 * The slot a new entry goes in: the lowest empty slot, else the entry the policy evicts,
 * the lowest slot on a tie. -1 for a TLB with no slots.
 */
export function victimSlot(tlb: Tlb, policy: TlbPolicy): number {
  const empty = tlb.indexOf(null);
  if (empty !== -1) return empty;
  let best = -1;
  let bestKey = Infinity;
  tlb.forEach((entry, i) => {
    const key = policy === 'lru' ? entry!.lastUsed : entry!.loadedAt;
    if (key < bestKey) {
      best = i;
      bestKey = key;
    }
  });
  return best;
}

export interface TlbInsert {
  tlb: Tlb;
  /** -1 when the TLB has no slots. */
  slot: number;
  evicted: TlbEntry | null;
}

/** Load `vpn → pfn` at access `now`, evicting by `policy` when full. */
export function tlbInsert(
  tlb: Tlb,
  policy: TlbPolicy,
  entry: { vpn: number; pfn: number; prot: Prot },
  now: number,
): TlbInsert {
  const slot = victimSlot(tlb, policy);
  if (slot === -1) return { tlb, slot, evicted: null };
  const evicted = tlb[slot] ?? null;
  const next = [...tlb];
  next[slot] = { ...entry, loadedAt: now, lastUsed: now };
  return { tlb: next, slot, evicted };
}

/** Valid entries in the TLB. */
export function tlbOccupancy(tlb: Tlb): number {
  return tlb.filter((entry) => entry !== null).length;
}
