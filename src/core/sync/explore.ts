/**
 * `explore(program)`: every interleaving, run and grouped by how it ends.
 *
 * An interleaving is a sequence of picks, each among the threads that can make progress,
 * until every thread has finished or none can move. Spins are left out: a spin changes
 * nothing, so it cannot change how a run ends (rule `sync.explore`).
 *
 * The count is exact but not done by listing every sequence one at a time. The search is
 * a depth-first walk over machine states with memoisation: two prefixes that reach the
 * same state have the same futures, so each state's table (outcome → number of ways to
 * reach it, and the smallest such suffix) is worked out once. That turns "every
 * interleaving of 14 + 14 ops" from tens of millions of runs into a few thousand states.
 * `tests/oracle/sync.test.ts` checks the counts against a plain enumeration.
 */

import { describeWaiting, formatValues, isDeadlock } from './interleave';
import {
  allFinished,
  brokenBounds,
  initialMachine,
  meetsExpectations,
  progressable,
  step,
  type Machine,
} from './machine';
import type { Program } from './program';

/** States explored before giving up. */
export const MAX_STATES = 200_000;

export type OutcomeKind = 'done' | 'stuck' | 'error';

export interface OutcomeGroup {
  /** Stable id for the outcome, e.g. `'done:counter=2'`. */
  key: string;
  /** e.g. `'counter = 2'` or `'Stuck: T1 waits for m (held by T0): counter = 1'`. */
  label: string;
  kind: OutcomeKind;
  values: Record<string, number>;
  /** All threads finished and every expected value holds; `null` unless `done`. */
  correct: boolean | null;
  /** Interleavings that end this way. */
  count: number;
  /** The lexicographically smallest interleaving that ends this way, as manual picks. */
  example: number[];
}

export type Exploration =
  | {
      tooLarge: false;
      /** Every interleaving. */
      total: number;
      /** Correct first, then by count (most first), then by key. */
      groups: OutcomeGroup[];
      /** Distinct machine states reached. */
      states: number;
      /** No reachable state breaks a declared bound (e.g. a buffer's 0..size). */
      boundsHeld: boolean;
    }
  | { tooLarge: true; states: number };

interface Outcome {
  key: string;
  label: string;
  kind: OutcomeKind;
  values: Record<string, number>;
  correct: boolean | null;
}

interface Tally {
  count: number;
  example: number[];
}

class TooLarge extends Error {}

function keyOf(machine: Machine): string {
  return JSON.stringify(machine);
}

function valuesKey(values: Record<string, number>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join(',');
}

function terminal(program: Program, machine: Machine): Outcome | null {
  const values = { ...machine.vars };
  if (allFinished(program, machine)) {
    const correct = meetsExpectations(program, values);
    return {
      key: `done:${valuesKey(values)}`,
      label: formatValues(values),
      kind: 'done',
      values,
      correct,
    };
  }
  if (progressable(program, machine).length === 0) {
    const why = describeWaiting(program, machine);
    const deadlock = isDeadlock(program, machine);
    return {
      key: `stuck:${why.join(';')}:${valuesKey(values)}`,
      label: `${deadlock ? 'Deadlock' : 'Stuck'} (${why.join('; ')}): ${formatValues(values)}`,
      kind: 'stuck',
      values,
      correct: null,
    };
  }
  return null;
}

export function explore(program: Program, maxStates = MAX_STATES): Exploration {
  const memo = new Map<string, Map<string, Tally>>();
  // States entered so far, counted on the way in so the cap holds mid-walk.
  let entered = 0;
  const outcomes = new Map<string, Outcome>();
  let boundsHeld = true;

  const visit = (machine: Machine): Map<string, Tally> => {
    const key = keyOf(machine);
    const cached = memo.get(key);
    if (cached) return cached;
    if (entered >= maxStates) throw new TooLarge();
    entered += 1;
    if (brokenBounds(program, machine.vars).length > 0) boundsHeld = false;

    const table = new Map<string, Tally>();
    const end = terminal(program, machine);
    if (end) {
      outcomes.set(end.key, end);
      table.set(end.key, { count: 1, example: [] });
    } else {
      for (const t of progressable(program, machine)) {
        const { machine: next, effect } = step(program, machine, t);
        if (effect.kind === 'error') {
          const values = { ...machine.vars };
          const errorKey = `error:${effect.m}:${valuesKey(values)}`;
          outcomes.set(errorKey, {
            key: errorKey,
            label: `Error (unlock of ${effect.m} without holding it): ${formatValues(values)}`,
            kind: 'error',
            values,
            correct: null,
          });
          const tally = table.get(errorKey);
          if (tally) tally.count += 1;
          else table.set(errorKey, { count: 1, example: [t] });
          continue;
        }
        for (const [outcome, sub] of visit(next)) {
          const tally = table.get(outcome);
          // Picks are tried in ascending order, so the first example kept is the smallest.
          if (tally) tally.count += sub.count;
          else table.set(outcome, { count: sub.count, example: [t, ...sub.example] });
        }
      }
    }
    memo.set(key, table);
    return table;
  };

  let root: Map<string, Tally>;
  try {
    root = visit(initialMachine(program));
  } catch (error) {
    if (error instanceof TooLarge) return { tooLarge: true, states: entered };
    throw error;
  }

  const rank = (g: OutcomeGroup) => (g.correct === true ? 0 : 1);
  const groups: OutcomeGroup[] = [...root].map(([key, tally]) => ({
    ...outcomes.get(key)!,
    count: tally.count,
    example: tally.example,
  }));
  groups.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      b.count - a.count ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  return {
    tooLarge: false,
    total: groups.reduce((sum, g) => sum + g.count, 0),
    groups,
    states: memo.size,
    boundsHeld,
  };
}
