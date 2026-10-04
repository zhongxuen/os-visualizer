/**
 * The detection algorithm (OSC10 §8.7.2) and the reduction it shares with Banker's safety
 * algorithm (§8.6.3.1): Work starts as Available; repeatedly find an unfinished thread
 * whose row (Request_i for detection, Need_i for safety) fits in Work, let it finish and
 * add its Allocation to Work. Whoever is left unfinished at the end is deadlocked
 * (detection) or the state is unsafe (safety).
 *
 * **Scan rule:** the textbook only says "find an i". This project restarts the scan from
 * T0 after every finish and takes the lowest-numbered thread that fits, so the order
 * reported is one valid order, not the only one.
 */

import type { CitationId } from '../citations/types';
import type { DlAlgorithm, DlResult } from './events';
import type { Emitter } from './emitter';
import {
  addVec,
  formatVector,
  isZero,
  leq,
  listProcesses,
  processName,
  resourceName,
  type RagMatrices,
} from './model';

export type ReductionStep =
  | { kind: 'check'; row: number; fits: boolean; work: number[] }
  | { kind: 'finish'; row: number; work: number[]; finish: boolean[]; order: number[] };

export interface Reduction {
  steps: ReductionStep[];
  /** Threads that finished during the scan, in order. */
  order: number[];
  finish: boolean[];
  work: number[];
}

/** The reduction with the lowest-index scan rule. Pure. */
export function reduce(
  rows: readonly (readonly number[])[],
  allocation: readonly (readonly number[])[],
  available: readonly number[],
  initialFinish: readonly boolean[],
): Reduction {
  let work = [...available];
  const finish = [...initialFinish];
  const order: number[] = [];
  const steps: ReductionStep[] = [];
  for (;;) {
    let found = -1;
    for (let i = 0; i < rows.length; i += 1) {
      if (finish[i]) continue;
      const fits = leq(rows[i]!, work);
      steps.push({ kind: 'check', row: i, fits, work: [...work] });
      if (fits) {
        found = i;
        break;
      }
    }
    if (found === -1) break;
    work = addVec(work, allocation[found]!);
    finish[found] = true;
    order.push(found);
    steps.push({
      kind: 'finish',
      row: found,
      work: [...work],
      finish: [...finish],
      order: [...order],
    });
  }
  return { steps, order, finish, work };
}

/** Detection's starting Finish: true for threads that hold nothing. */
export function detectionStart(allocation: readonly (readonly number[])[]): boolean[] {
  return allocation.map((row) => isZero(row));
}

export interface Detection {
  deadlocked: boolean;
  /** Threads that can never finish, ascending. */
  set: number[];
  /** Threads that finished during the scan, in order. */
  order: number[];
}

/** The detection algorithm, no events. */
export function detect(
  m: Pick<RagMatrices, 'allocation' | 'request' | 'available'>,
): Detection {
  const result = reduce(
    m.request,
    m.allocation,
    m.available,
    detectionStart(m.allocation),
  );
  const set = result.finish.flatMap((done, i) => (done ? [] : [i]));
  return { deadlocked: set.length > 0, set, order: result.order };
}

/** Where a row first exceeds a vector: `R0 2 > 0`. */
export function firstExcess(row: readonly number[], vector: readonly number[]): string {
  const r = row.findIndex((value, i) => value > (vector[i] ?? 0));
  return `${resourceName(r)}: ${row[r]} > ${vector[r]}`;
}

export interface ReductionSpec {
  /** Phase id prefix, so the same steps can run more than once in a run. */
  prefix: string;
  algorithm: DlAlgorithm;
  matrix: 'request' | 'need';
  rows: number[][];
  allocation: number[][];
  available: number[];
  finish: boolean[];
  citation: CitationId;
  /** Words for the result step. */
  result: (r: Reduction) => { label: string; detail: string; result: DlResult };
  /** Extra sentence for the set-up step. */
  initDetail: string;
}

/** Emit the reduction as steps: set up, check rows, finish, result. */
export function emitReduction(e: Emitter, spec: ReductionSpec): Reduction {
  const reduction = reduce(spec.rows, spec.allocation, spec.available, spec.finish);
  const rowName = spec.matrix === 'request' ? 'Request' : 'Need';
  const work = [...spec.available];

  e.phase(
    `${spec.prefix}init`,
    'Set up Work and Finish',
    `Work starts as Available. Finish[i] says whether thread i is known to be able to finish.`,
    `Pretend the free resources are a bank balance and look for a thread whose ${rowName.toLowerCase()} the balance can cover.`,
  );
  const already = spec.finish.flatMap((done, i) => (done ? [i] : []));
  e.emit(
    'dl.init',
    spec.citation,
    already.length === 0
      ? `Work = Available = ${formatVector(work)}. Finish is false for every thread.`
      : `Work = Available = ${formatVector(work)}. Finish is true for ${listProcesses(already)}, which ${
          already.length === 1 ? 'holds' : 'hold'
        } nothing.`,
    {
      algorithm: spec.algorithm,
      work,
      finish: [...spec.finish],
      order: [],
      waitFor: null,
      dfs: null,
    },
    { detail: spec.initDetail },
  );

  let round = 0;
  let pending: ReductionStep[] = [];
  const flush = (finished: number | null) => {
    round += 1;
    e.phase(
      `${spec.prefix}round-${round}`,
      finished === null
        ? `Round ${round}: no thread fits`
        : `Round ${round}: ${processName(finished)} finishes`,
      finished === null
        ? `Scan from T0: no unfinished thread's ${rowName} fits in Work.`
        : `Scan from T0 for the lowest-numbered unfinished thread whose ${rowName} fits in Work.`,
    );
    for (const step of pending) {
      const name = processName(step.row);
      const row = spec.rows[step.row]!;
      if (step.kind === 'check') {
        e.emit(
          'dl.check',
          spec.citation,
          step.fits
            ? `${name}: ${rowName} ${formatVector(row)} ≤ Work ${formatVector(step.work)}? Yes.`
            : `${name}: ${rowName} ${formatVector(row)} ≤ Work ${formatVector(step.work)}? No (${firstExcess(row, step.work)}).`,
          {
            row: step.row,
            compare: {
              matrix: spec.matrix,
              against: 'work',
              row: step.row,
              values: [...row],
              fits: step.fits,
            },
          },
          {
            process: step.row,
            detail: step.fits
              ? `${name} can get everything it ${spec.matrix === 'request' ? 'is waiting for' : 'may still ask for'}, run to completion and release what it holds.`
              : `${name} could not get everything it ${spec.matrix === 'request' ? 'is waiting for' : 'may still ask for'} yet; try the next thread.`,
          },
        );
      } else {
        const released = spec.allocation[step.row]!;
        e.emit(
          'dl.finish',
          spec.citation,
          `${name} finishes and releases ${formatVector(released)}: Work = ${formatVector(step.work)}.`,
          {
            row: step.row,
            work: step.work,
            finish: step.finish,
            order: step.order,
          },
          {
            process: step.row,
            detail: `Finish[${name}] = true. The scan starts again from T0 (lowest index first).`,
          },
        );
      }
    }
    pending = [];
  };
  for (const step of reduction.steps) {
    pending.push(step);
    if (step.kind === 'finish') flush(step.row);
  }
  if (pending.length > 0) flush(null);

  const outcome = spec.result(reduction);
  e.phase(
    `${spec.prefix}result`,
    'Result',
    'Every thread has finished, or no unfinished thread can.',
  );
  e.emit(
    'dl.result',
    spec.citation,
    outcome.label,
    { result: outcome.result },
    {
      detail: outcome.detail,
    },
  );
  return reduction;
}

/** The detection algorithm as steps, on the matrices as they stand. */
export function emitDetection(e: Emitter, m: RagMatrices, prefix: string): Detection {
  const reduction = emitReduction(e, {
    prefix,
    algorithm: 'detect',
    matrix: 'request',
    rows: m.request,
    allocation: m.allocation,
    available: m.available,
    finish: detectionStart(m.allocation),
    citation: 'osc10.8.7.2',
    initDetail:
      'A thread that holds nothing cannot be part of a deadlock, so it starts finished. The algorithm is optimistic: it assumes a thread that gets its request will finish and release everything.',
    result: (r) => {
      const set = r.finish.flatMap((done, i) => (done ? [] : [i]));
      if (set.length === 0) {
        return {
          label:
            r.order.length === 0
              ? 'Not deadlocked: no thread holds anything.'
              : `Not deadlocked: the threads can finish in the order ⟨${r.order.map(processName).join(', ')}⟩.`,
          detail:
            'Every Finish[i] is true. The order shown is one that works; others may too.',
          result: { kind: 'not-deadlocked', order: r.order },
        };
      }
      return {
        label: `Deadlocked: ${listProcesses(set)} can never finish.`,
        detail: `Finish[i] is false for ${listProcesses(set)}: none of their requests can be met even if every other thread finishes. These threads are deadlocked (OSC10 §8.7.2).`,
        result: { kind: 'deadlocked', set },
      };
    },
  });
  const set = reduction.finish.flatMap((done, i) => (done ? [] : [i]));
  return { deadlocked: set.length > 0, set, order: reduction.order };
}
