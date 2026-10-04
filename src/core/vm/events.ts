import type { EventBase } from '../events/types';
import type { Op } from './config';
import type { Pde, Pte, VaFields } from './memory';
import type { TlbEntry } from './tlb';

/**
 * Address translation events. One phase per access; one event per step of that access
 * that happens (06 §2). Every event carries the full state after it (`VmSnapshot`), so
 * the UI steps by lookup and never re-simulates.
 *
 * Plain JSON only: optional fields are left out, never `undefined`.
 */

export type VmEventKind =
  /** Step 1: the VA split into VPN (and directory/table index) and offset. */
  | 'vm.split'
  /** Step 2: the VPN is in the TLB. */
  | 'vm.tlbHit'
  /** Step 2: the VPN is not in the TLB (or there is no TLB). */
  | 'vm.tlbMiss'
  /** Step 3, two levels: the page-directory entry is read (one memory reference). */
  | 'vm.readPde'
  /** Step 3: the page-table entry is read (one memory reference). */
  | 'vm.readPte'
  /** Step 4: the access is allowed by the protection bits. */
  | 'vm.protOk'
  /** Step 3 or 4: an invalid PDE/PTE or a protection violation. The access stops. */
  | 'vm.fault'
  /** Step 5: the translation is loaded into the TLB. */
  | 'vm.tlbInsert'
  /** Step 6: accessed/dirty set and the physical address formed. */
  | 'vm.physical'
  /** Step 7: the data access itself (one memory reference). */
  | 'vm.memory';

/** The seven steps of 06 §2. */
export type VmStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type FaultKind = 'invalid' | 'protection';

/** What one finished access did, for the access list. */
export interface AccessResult {
  index: number;
  va: number;
  op: Op;
  tlb: 'hit' | 'miss';
  /** `null` when the access completed. */
  fault: FaultKind | null;
  /** `null` after a fault. */
  pa: number | null;
  /** Memory references the access made, page-table reads included. */
  memRefs: number;
}

export interface VmCounters {
  /** Accesses finished, faults included. */
  accesses: number;
  hits: number;
  misses: number;
  faults: number;
  /** Every memory reference so far: page-table reads and data accesses. */
  memRefs: number;
}

export interface VmSnapshot {
  /** Index of the access in progress (or just finished). */
  access: number;
  /** Its fields. */
  fields: VaFields;
  /** TLB slots, `null` when empty. Length = TLB size. */
  tlb: (TlbEntry | null)[];
  /** Listed page-table rows with their hardware bits, sorted by VPN. */
  ptes: Pte[];
  /** Two levels: the valid directory entries. */
  directory: Pde[];
  counters: VmCounters;
  /** Every finished access so far, in order. */
  log: AccessResult[];
}

export type VmEvent = EventBase & {
  kind: VmEventKind;
  step: VmStep;
  /** Same as `state.access`, kept on the event for filtering. */
  access: number;
  va: number;
  op: Op;
  vpn: number;
  /** The TLB slot hit, filled or (on a fault after a hit) consulted. */
  slot?: number;
  /** The physical address read: the PDE, the PTE, or the data. */
  address?: number;
  /** The TLB entry a fill evicted. */
  evicted?: TlbEntry;
  fault?: FaultKind;
  /** Which table an invalid-page fault was found in. */
  table?: 'pde' | 'pte';
  pfn?: number;
  pa?: number;
  state: VmSnapshot;
};
