import type { EventBase } from '../events/types';

/**
 * Placeholder so `OsEvent` compiles before the CPU scheduling core exists. The sched core
 * replaces this with its real variants (each carrying a snapshot of the state after the
 * event). Keep the type name; `src/core/events/types.ts` imports it.
 */
export type SchedEvent = EventBase & { kind: 'sched.placeholder' };
