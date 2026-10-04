/**
 * The one place deadlock events are stamped. An emitter keeps the snapshot as it stands;
 * each `emit` applies a patch, records a deep copy (so no two events share an array) and
 * moves one step on. `row`, `changed`, `compare` and `result` describe a single step and
 * reset on every emit; everything else carries over until patched.
 */

import type { CitationId } from '../citations/types';
import { createRun, type RunBuilder } from '../events/builder';
import type { SimResult } from '../sim/result';
import type { DlEvent, DlEventKind, DlSnapshot } from './events';

export type DlRun = SimResult<DlEvent>;

export interface EmitExtra {
  process?: number;
  resource?: number;
  detail?: string;
}

export interface Emitter {
  /** The snapshot after the last emit. */
  readonly state: DlSnapshot;
  /** Start a phase; event ids are numbered within it. */
  phase(id: string, title: string, description: string, plain?: string): void;
  emit(
    kind: DlEventKind,
    citation: CitationId,
    label: string,
    patch?: Partial<DlSnapshot>,
    extra?: EmitExtra,
  ): void;
  finish(): DlRun;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createEmitter(initial: DlSnapshot): Emitter {
  const run: RunBuilder<DlEvent> = createRun<DlEvent>({ unit: 'step' });
  let state = clone(initial);
  let phaseId = 'start';
  let n = 0;

  return {
    get state() {
      return state;
    },
    phase(id, title, description, plain) {
      run.phase(id, title, description, plain);
      phaseId = id;
      n = 0;
    },
    emit(kind, citation, label, patch = {}, extra = {}) {
      state = clone({
        ...state,
        row: null,
        changed: [],
        compare: null,
        result: null,
        ...patch,
      });
      run.emit({
        kind,
        id: `dl.${phaseId}.${n++}`,
        label,
        citation,
        ...(extra.detail === undefined ? {} : { detail: extra.detail }),
        ...(extra.process === undefined ? {} : { process: extra.process }),
        ...(extra.resource === undefined ? {} : { resource: extra.resource }),
        state: clone(state),
      });
      run.advance();
    },
    finish() {
      return run.finish();
    },
  };
}

/** A snapshot with nothing computed yet. */
export function blankSnapshot(
  fields: Pick<DlSnapshot, 'algorithm' | 'total' | 'allocation' | 'available'> &
    Partial<DlSnapshot>,
): DlSnapshot {
  return {
    request: null,
    max: null,
    need: null,
    work: null,
    finish: null,
    order: [],
    row: null,
    changed: [],
    compare: null,
    waitFor: null,
    dfs: null,
    cycle: null,
    terminated: [],
    preempted: [],
    result: null,
    ...fields,
  };
}
