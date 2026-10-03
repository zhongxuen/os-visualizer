import type { EventBase } from '../events/types';

/**
 * Placeholder so `OsEvent` compiles before the deadlock core exists. The deadlock core
 * replaces this with its real variants (each carrying a snapshot of the state after the
 * event). Keep the type name; `src/core/events/types.ts` imports it.
 */
export type DlEvent = EventBase & { kind: 'deadlock.placeholder' };
