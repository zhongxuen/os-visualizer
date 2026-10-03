import type { EventBase } from '../events/types';

/**
 * CPU scheduling events. Every event carries the full scheduler state after it
 * (`SchedSnapshot`), so the UI steps by lookup and never re-simulates.
 *
 * Plain JSON only: optional fields are left out, never `undefined`.
 */

export type SchedEventKind =
  | 'sched.arrive'
  | 'sched.ioStart'
  | 'sched.ioDone'
  | 'sched.dispatch'
  | 'sched.preempt'
  | 'sched.quantumExpired'
  | 'sched.demote'
  | 'sched.boost'
  | 'sched.age'
  | 'sched.contextSwitch'
  | 'sched.run'
  | 'sched.idle'
  | 'sched.finish'
  | 'sched.limit';

/** One stretch of the Gantt chart. `pid` is a PID, `'idle'` or `'cs'`. */
export interface SchedSegment {
  pid: string;
  start: number;
  /** Exclusive. */
  end: number;
  /** MLFQ queue level (0 = top). Context switches take the level they switch to. */
  level?: number;
}

export interface SchedSnapshot {
  /** The instant the event happened at (decisions) or the tick it describes (run). */
  tick: number;
  /** Who holds the CPU. `null` while idle or while a context switch is in progress. */
  running: string | null;
  /** A context switch in progress: the process being switched to and ticks left. */
  cs: { to: string; left: number } | null;
  /** Ready queues, head first. One queue, or one per MLFQ level (index 0 = top). */
  queues: string[][];
  /** Waiting on I/O, and the tick each is ready again. */
  io: { pid: string; until: number }[];
  /** Ticks left in each process's current CPU burst (0 once done). */
  remaining: Record<string, number>;
  /** Finished processes, in completion order. */
  done: string[];
  /** MLFQ queue level per process. */
  levels?: Record<string, number>;
  /** Effective priority per process, when the policy uses priorities. */
  priorities?: Record<string, number>;
  /** The Gantt chart so far. */
  segments: SchedSegment[];
}

export type SchedEvent = EventBase & {
  kind: SchedEventKind;
  /** Same as `state.tick`, kept on the event for filtering. */
  tick: number;
  pid?: string;
  /** A second process: who was preempted, or who a context switch leaves. */
  other?: string;
  /** MLFQ level after a demotion, or of a dispatch. */
  level?: number;
  state: SchedSnapshot;
};
