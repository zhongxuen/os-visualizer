import type { EventBase } from '../events/types';
import type { SemState, ThreadStatus } from './machine';

/**
 * Synchronisation events. A run is a tick run: tick 0 is `sync.start` (nothing has run),
 * then one micro-op per tick. The event for the n-th op is stamped at tick n, so the
 * state on screen at tick n is the state after n ops. A thread finishing its last op
 * adds `sync.done` on the same tick; the run ends with `sync.end` (every thread
 * finished), `sync.stuck` (no thread can move), `sync.invalid` (a manual pick that can't
 * run), `sync.error` (unlock without holding the lock) or `sync.limit`. A manual run
 * whose picks run out before the program ends has no closing event, and its last
 * snapshot says which threads can be picked next.
 *
 * Every event carries the full state after it (`SyncSnapshot`). Plain JSON only.
 */

export type SyncEventKind =
  | 'sync.start'
  | 'sync.load'
  | 'sync.add'
  | 'sync.store'
  | 'sync.lock'
  | 'sync.spin'
  | 'sync.unlock'
  | 'sync.wait'
  | 'sync.block'
  | 'sync.signal'
  | 'sync.yield'
  | 'sync.done'
  | 'sync.end'
  | 'sync.stuck'
  | 'sync.invalid'
  | 'sync.error'
  | 'sync.limit';

export type SyncResultKind = 'done' | 'stuck' | 'invalid' | 'error' | 'limit';

export interface SyncResult {
  kind: SyncResultKind;
  /** Every thread finished and every expected value holds; `null` unless `done`. */
  correct: boolean | null;
  /** The shared variables at the end. */
  values: Record<string, number>;
}

export interface SyncSnapshot {
  /** Ops run so far. */
  tick: number;
  pcs: number[];
  regs: Record<string, number>[];
  status: ThreadStatus[];
  /** The lock or semaphore each thread waits for, or `null`. */
  waitingOn: (string | null)[];
  vars: Record<string, number>;
  /** Mutex holder, or `null` when free. */
  locks: Record<string, number | null>;
  sems: Record<string, SemState>;
  /** The thread that ran on each tick so far, spins included: the effective schedule. */
  trace: number[];
  /** The op this event is about. */
  last: { thread: number; op: number } | null;
  /** Threads that can make progress now: what a manual schedule may pick next. */
  next: number[];
  /** Set on the closing event. */
  result: SyncResult | null;
}

export type SyncEvent = EventBase & {
  kind: SyncEventKind;
  /** Same as `state.tick`. */
  tick: number;
  thread?: number;
  /** Index of the op in its thread. */
  op?: number;
  /** A store that overwrote another thread's update. */
  lost?: boolean;
  state: SyncSnapshot;
};
