/**
 * Synchronisation presets: the counter race and its fix (OSTEP §26.4, §28.7), two ways a
 * lock goes wrong, and producer/consumer with semaphores (OSTEP §31.4), correct and
 * broken. Every preset is in the scenario catalogue.
 */

import type { CitationId } from '../citations/types';
import type { Op, Program, Schedule } from './program';

export interface SyncPreset {
  id: string;
  title: string;
  /** What to look for. */
  summary: string;
  citation: CitationId;
  program: Program;
  schedule: Schedule;
}

const load = (v: string, reg = 'r'): Op => ({ op: 'load', reg, var: v });
const add = (k: number, reg = 'r'): Op => ({ op: 'add', reg, k });
const store = (v: string, reg = 'r'): Op => ({ op: 'store', var: v, reg });
const lock = (m: string): Op => ({ op: 'lock', m });
const unlock = (m: string): Op => ({ op: 'unlock', m });
const wait = (s: string): Op => ({ op: 'wait', s });
const signal = (s: string): Op => ({ op: 'signal', s });

/** `counter++` as the three instructions OSTEP Figure 26.7 shows. */
const increment = (v = 'counter'): Op[] => [load(v), add(1), store(v)];

/** A counter program: two threads each add 1 to `counter`, starting from `init`. */
export function counterProgram(init = 0, withLock = false): Program {
  const body = withLock ? [lock('m'), ...increment(), unlock('m')] : increment();
  return {
    vars: [{ name: 'counter', init }],
    locks: withLock ? ['m'] : [],
    sems: [],
    threads: [{ ops: body }, { ops: [...body] }],
    expect: [{ var: 'counter', value: init + 2 }],
    bounds: [],
  };
}

/**
 * Producer/consumer over a bounded buffer of `size`, two items each way. The buffer is
 * modelled by its `count` (items in it); putting is `count++` and getting `count--`,
 * each as load/add/store under the mutex.
 *
 * `broken` takes the mutex outside the semaphore waits (OSTEP §31.4, "Adding Mutual
 * Exclusion (Incorrectly)").
 */
export function prodconsProgram(size: number, broken = false): Program {
  const item = (mine: string, theirs: string, k: number): Op[] =>
    broken
      ? [
          lock('m'),
          wait(mine),
          load('count'),
          add(k),
          store('count'),
          signal(theirs),
          unlock('m'),
        ]
      : [
          wait(mine),
          lock('m'),
          load('count'),
          add(k),
          store('count'),
          unlock('m'),
          signal(theirs),
        ];
  const producer = item('empty', 'full', 1);
  const consumer = item('full', 'empty', -1);
  return {
    vars: [{ name: 'count', init: 0 }],
    locks: ['m'],
    sems: [
      { name: 'empty', init: size },
      { name: 'full', init: 0 },
    ],
    threads: [{ ops: [...producer, ...producer] }, { ops: [...consumer, ...consumer] }],
    expect: [{ var: 'count', value: 0 }],
    bounds: [{ var: 'count', min: 0, max: size }],
  };
}

const manual = (...picks: number[]): Schedule => ({ kind: 'manual', picks });

export const SYNC_PRESETS: readonly SyncPreset[] = [
  {
    id: 'counter-race',
    title: 'Counter race',
    summary:
      'Two threads each add 1 to counter, as load, add and store. T0 is interrupted after its add, T1 does the whole increment, then T0 stores its stale value: counter ends at 1, not 2.',
    citation: 'ostep.26.4',
    program: counterProgram(0),
    schedule: manual(0, 0, 1, 1, 1, 0),
  },
  {
    id: 'counter-mutex',
    title: 'Counter with a mutex',
    summary:
      'The same increment inside lock m … unlock m. When T1 tries to take the lock T0 holds, it spins. Every interleaving now gives 2.',
    citation: 'ostep.28.7',
    program: counterProgram(0, true),
    schedule: { kind: 'rr', quantum: 2 },
  },
  {
    id: 'forgotten-unlock',
    title: 'Forgotten unlock',
    summary:
      'T0 takes the lock and never releases it. If T0 gets there first, T1 waits for a lock nobody will ever free. Not a cycle, but stuck all the same: compare the Deadlock module.',
    citation: 'ostep.28.1',
    program: {
      vars: [{ name: 'counter', init: 0 }],
      locks: ['m'],
      sems: [],
      threads: [
        { ops: [lock('m'), ...increment()] },
        { ops: [lock('m'), ...increment(), unlock('m')] },
      ],
      expect: [{ var: 'counter', value: 2 }],
      bounds: [],
    },
    schedule: { kind: 'rr', quantum: 2 },
  },
  {
    id: 'lock-order',
    title: 'Lock ordering deadlock',
    summary:
      'T0 locks A then B; T1 locks B then A. If each takes its first lock before the other takes its second, both wait forever. Taking the locks in one global order prevents it.',
    citation: 'ostep.32.3',
    program: {
      vars: [{ name: 'x', init: 0 }],
      locks: ['A', 'B'],
      sems: [],
      threads: [
        { ops: [lock('A'), lock('B'), unlock('B'), unlock('A')] },
        { ops: [lock('B'), lock('A'), unlock('A'), unlock('B')] },
      ],
      expect: [],
      bounds: [],
    },
    schedule: manual(0, 1),
  },
  {
    id: 'prodcons-1',
    title: 'Producer/consumer, buffer of 1',
    summary:
      'The producer waits on empty, the consumer on full, and a mutex guards the buffer. Two items go through a one-slot buffer: count never leaves 0..1.',
    citation: 'ostep.31.4',
    program: prodconsProgram(1),
    schedule: { kind: 'rr', quantum: 3 },
  },
  {
    id: 'prodcons-2',
    title: 'Producer/consumer, buffer of 2',
    summary:
      'The same with two slots: the producer can run ahead by two items before it has to sleep on empty. count never leaves 0..2.',
    citation: 'ostep.31.4',
    program: prodconsProgram(2),
    schedule: { kind: 'rr', quantum: 4 },
  },
  {
    id: 'prodcons-broken',
    title: 'Producer/consumer, mutex outside the waits',
    summary:
      'The mutex is taken before waiting on the semaphore. If the consumer goes first it sleeps on full while holding the mutex, and the producer spins on the mutex forever.',
    citation: 'ostep.31.4',
    program: prodconsProgram(1, true),
    schedule: manual(1, 1),
  },
];

export const DEFAULT_PRESET: SyncPreset = SYNC_PRESETS[0]!;

export function presetById(id: string): SyncPreset | undefined {
  return SYNC_PRESETS.find((preset) => preset.id === id);
}
