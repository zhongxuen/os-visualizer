/**
 * `OsEvent` -- the shared event contract.
 *
 * Each module declares its own variants in `src/core/<name>/events.ts`; this file only
 * joins them. Nobody edits it after phase 02.
 *
 * **Events carry snapshots.** Each variant includes the full module state after the
 * event (`state: SchedSnapshot` etc.), so stepping to any index is a lookup and stepping
 * back can never drift. Events must be plain JSON: no `undefined` values, `Map`s or
 * class instances, so a run survives the share/URL path and `toStrictEqual`.
 */

import type { CitationId } from '../citations/types';
import type { DlEvent } from '../deadlock/events';
import type { ReplEvent } from '../replace/events';
import type { SchedEvent } from '../sched/events';
import type { SimResult, TimedEvent } from '../sim/result';
import type { VmEvent } from '../vm/events';

export interface EventBase extends TimedEvent {
  /** Stable within a run: `${module}.${phase}.${index}`. */
  id: string;
  /** One short sentence, plain language, that says *why*. */
  label: string;
  /** Optional longer explanation. */
  detail?: string;
  /** Must resolve in the citation registry. */
  citation: CitationId;
}

export type OsEvent = SchedEvent | VmEvent | ReplEvent | DlEvent;

export type OsRun = SimResult<OsEvent>;
