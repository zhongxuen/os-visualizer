/**
 * Banker's algorithm (OSC10 §8.6.3): the safety algorithm (§8.6.3.1) and the
 * resource-request algorithm (§8.6.3.2), each as a step run.
 *
 * Request: (1) Request ≤ Need, else an error (the thread exceeded its maximum claim);
 * (2) Request ≤ Available, else the thread waits; (3) pretend to allocate; (4) run the
 * safety algorithm on the pretend state; (5) safe → grant, unsafe → roll back and wait.
 * Each check is its own step.
 */

import { blankSnapshot, createEmitter, type DlRun, type Emitter } from './emitter';
import type { DlResult } from './events';
import { emitReduction, firstExcess, reduce } from './detect';
import {
  addVec,
  bankersTotal,
  copyMatrix,
  formatVector,
  leq,
  listProcesses,
  needOf,
  processName,
  subVec,
  type BankersRequest,
  type BankersState,
} from './model';

export interface Safety {
  safe: boolean;
  /** The safe sequence when safe; otherwise the threads that did finish. */
  order: number[];
  /** Threads that could not finish (empty when safe). */
  stuck: number[];
}

/** The safety algorithm, no events. */
export function safety(state: BankersState): Safety {
  const r = reduce(
    needOf(state),
    state.allocation,
    state.available,
    state.allocation.map(() => false),
  );
  const stuck = r.finish.flatMap((done, i) => (done ? [] : [i]));
  return { safe: stuck.length === 0, order: r.order, stuck };
}

export type RequestOutcome = 'granted' | 'error' | 'wait' | 'refused';

/** The state after granting `request` (no checks). */
export function allocate(
  state: BankersState,
  { t, request }: BankersRequest,
): BankersState {
  const allocation = copyMatrix(state.allocation);
  allocation[t] = addVec(allocation[t]!, request);
  return {
    max: copyMatrix(state.max),
    allocation,
    available: subVec(state.available, request),
  };
}

/** The resource-request algorithm, no events. `state` is the state afterwards. */
export function requestResources(
  state: BankersState,
  req: BankersRequest,
): { outcome: RequestOutcome; state: BankersState } {
  const need = needOf(state)[req.t]!;
  if (!leq(req.request, need)) return { outcome: 'error', state };
  if (!leq(req.request, state.available)) return { outcome: 'wait', state };
  const pretend = allocate(state, req);
  return safety(pretend).safe
    ? { outcome: 'granted', state: pretend }
    : { outcome: 'refused', state };
}

function bankersSnapshot(state: BankersState, algorithm: 'safety' | 'request') {
  return blankSnapshot({
    algorithm,
    total: bankersTotal(state),
    allocation: copyMatrix(state.allocation),
    available: [...state.available],
    max: copyMatrix(state.max),
    need: needOf(state),
  });
}

function emitSafety(e: Emitter, state: BankersState, prefix: string) {
  return emitReduction(e, {
    prefix,
    algorithm: e.state.algorithm,
    matrix: 'need',
    rows: needOf(state),
    allocation: state.allocation,
    available: state.available,
    finish: state.allocation.map(() => false),
    citation: 'osc10.8.6.3.1',
    initDetail:
      'Need = Max − Allocation is the most each thread may still ask for. A state is safe if the threads can all finish in some order even if each asks for its full Need.',
    result: (r) => {
      const stuck = r.finish.flatMap((done, i) => (done ? [] : [i]));
      const result: DlResult =
        stuck.length === 0 ? { kind: 'safe', order: r.order } : { kind: 'unsafe', stuck };
      return stuck.length === 0
        ? {
            label: `Safe: ⟨${r.order.map(processName).join(', ')}⟩ is a safe sequence.`,
            detail:
              'It is one safe sequence, not the only one: the scan always takes the lowest-numbered thread that fits. Any order the algorithm could have found is equally valid.',
            result,
          }
        : {
            label: `Unsafe: ${listProcesses(stuck)} cannot be sure to finish.`,
            detail:
              'No order lets every thread get its full Need. An unsafe state is not yet a deadlock, but the system can no longer guarantee to avoid one (OSC10 §8.6.1).',
            result,
          };
    },
  });
}

/** Banker's safety algorithm on `state`, as a step run. Expects a valid state. */
export function runSafety(state: BankersState): DlRun {
  const e = createEmitter(bankersSnapshot(state, 'safety'));
  emitSafety(e, state, '');
  return e.finish();
}

/** Banker's resource-request algorithm, as a step run. Expects a valid state and request. */
export function runRequest(state: BankersState, req: BankersRequest): DlRun {
  const e = createEmitter(bankersSnapshot(state, 'request'));
  const { t, request } = req;
  const name = processName(t);
  const need = needOf(state)[t]!;
  const asks = `${name} requests ${formatVector(request)}`;

  e.phase(
    'req-need',
    'Request ≤ Need?',
    `Step 1: a thread may never ask for more than its declared maximum claim.`,
    'A thread said up front the most it would ever need. Is it keeping its word?',
  );
  const withinClaim = leq(request, need);
  e.emit(
    'dl.req.need',
    'osc10.8.6.3.2',
    withinClaim
      ? `${asks}. Request ≤ Need ${formatVector(need)}? Yes.`
      : `${asks}. Request ≤ Need ${formatVector(need)}? No (${firstExcess(request, need)}).`,
    {
      row: t,
      compare: {
        matrix: 'need',
        against: 'need',
        row: t,
        values: [...request],
        fits: withinClaim,
      },
    },
    {
      process: t,
      detail: withinClaim
        ? 'The request is within what the thread said it might need.'
        : undefined,
    },
  );
  if (!withinClaim) {
    e.emit(
      'dl.result',
      'osc10.8.6.3.2',
      `Error: ${name} has exceeded its maximum claim.`,
      { row: t, result: { kind: 'error' } },
      {
        process: t,
        detail: `Need[${name}] = ${formatVector(need)} is all it may still ask for. The request is rejected as an error; nothing changes.`,
      },
    );
    return e.finish();
  }

  e.phase(
    'req-available',
    'Request ≤ Available?',
    'Step 2: the resources must be free right now.',
  );
  const free = leq(request, state.available);
  e.emit(
    'dl.req.available',
    'osc10.8.6.3.2',
    free
      ? `Request ${formatVector(request)} ≤ Available ${formatVector(state.available)}? Yes.`
      : `Request ${formatVector(request)} ≤ Available ${formatVector(state.available)}? No (${firstExcess(request, state.available)}).`,
    {
      row: t,
      compare: {
        matrix: 'need',
        against: 'available',
        row: t,
        values: [...request],
        fits: free,
      },
    },
    { process: t },
  );
  if (!free) {
    e.emit(
      'dl.result',
      'osc10.8.6.3.2',
      `${name} must wait: the resources are not available.`,
      { row: t, result: { kind: 'wait' } },
      {
        process: t,
        detail:
          'Nothing is allocated. The thread waits until other threads release enough, then asks again.',
      },
    );
    return e.finish();
  }

  const pretend = allocate(state, req);
  const pretendNeed = needOf(pretend);
  const changed = request.flatMap((n, r) => (n > 0 ? [[t, r] as [number, number]] : []));
  e.phase(
    'req-pretend',
    'Pretend to allocate',
    'Step 3: change the state as if the request were granted, then ask whether that state is safe.',
  );
  e.emit(
    'dl.req.pretend',
    'osc10.8.6.3.2',
    `Pretend to allocate: Available = ${formatVector(pretend.available)}, Allocation[${name}] = ${formatVector(pretend.allocation[t]!)}, Need[${name}] = ${formatVector(pretendNeed[t]!)}.`,
    {
      allocation: copyMatrix(pretend.allocation),
      need: pretendNeed,
      available: [...pretend.available],
      row: t,
      changed,
    },
    {
      process: t,
      detail:
        'Available −= Request, Allocation[i] += Request, Need[i] −= Request. Nothing is final until the safety check passes.',
    },
  );

  const r = emitSafety(e, pretend, 'safety-');
  const safe = r.finish.every(Boolean);
  e.phase(
    'req-decision',
    safe ? 'Grant' : 'Roll back',
    safe
      ? 'The pretend state is safe, so it becomes the real state.'
      : 'The pretend state is unsafe, so the old state is restored.',
  );
  if (safe) {
    e.emit(
      'dl.req.grant',
      'osc10.8.6.3.2',
      `Granted: the new state is safe, so ${name} gets ${formatVector(request)}.`,
      { row: t, changed, result: { kind: 'granted' } },
      {
        process: t,
        detail: `Safe sequence: ⟨${r.order.map(processName).join(', ')}⟩.`,
      },
    );
  } else {
    e.emit(
      'dl.req.rollback',
      'osc10.8.6.3.2',
      `Refused: granting ${formatVector(request)} would leave the system unsafe. Roll back; ${name} waits.`,
      {
        allocation: copyMatrix(state.allocation),
        need: needOf(state),
        available: [...state.available],
        work: null,
        finish: null,
        order: [],
        row: t,
        result: { kind: 'refused' },
      },
      {
        process: t,
        detail:
          'The resources are free, but handing them over could let the threads reach a deadlock. Banker’s algorithm avoids that by making the thread wait.',
      },
    );
  }
  return e.finish();
}
