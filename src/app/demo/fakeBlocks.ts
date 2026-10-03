/**
 * Hand-written inputs for the building blocks on /demo. None of this is an algorithm
 * core (those are phases 04 to 07); it only has to exercise every block from the one
 * fake run in `fakeRun.ts`, nine ticks or steps long.
 */

import type { FrameColumn } from '@/components/blocks/FrameStrip';
import type { GanttLane, GanttSegment } from '@/components/blocks/GanttChart';
import type { QueueItem } from '@/components/blocks/QueueView';
import type { Rule } from '@/components/inspector/RulesPanel';

import { DEMO_PROCESSES, type DemoEvent } from './fakeRun';

/** FCFS over the demo processes: the same schedule as the fake run. */
export function fcfsSegments(): GanttSegment[] {
  let t = 0;
  return DEMO_PROCESSES.map((p) => {
    const start = Math.max(t, p.arrival);
    t = start + p.burst;
    return { start, end: t, kind: 'run' as const, pid: p.pid };
  });
}

export const MLFQ_LANES: GanttLane[] = [
  { id: 0, label: 'Q0 (q = 1)' },
  { id: 1, label: 'Q1 (q = 2)' },
];

/**
 * Not a real MLFQ run: a hand-drawn chart with lanes, a context switch and idle time, so
 * every kind of segment is on screen next to the FCFS chart, under one cursor.
 */
export const MLFQ_SEGMENTS: GanttSegment[] = [
  { start: 0, end: 1, kind: 'run', pid: 1, lane: 0 },
  { start: 1, end: 2, kind: 'cs', lane: 0 },
  { start: 2, end: 3, kind: 'run', pid: 2, lane: 0 },
  { start: 3, end: 4, kind: 'run', pid: 3, lane: 0 },
  { start: 4, end: 6, kind: 'run', pid: 1, lane: 1 },
  { start: 6, end: 7, kind: 'run', pid: 2, lane: 1 },
  { start: 7, end: 8, kind: 'idle', lane: 1 },
  { start: 8, end: 9, kind: 'run', pid: 3, lane: 1 },
];

/** The FCFS ready queue while event `index` runs. */
export function queueAt(
  event: DemoEvent | undefined,
  index: number,
): { running: QueueItem | null; ready: QueueItem[] } {
  if (!event || event.pid === null) return { running: null, ready: [] };
  const running = { pid: event.pid, remaining: event.remaining[String(event.pid)] };
  const ready = DEMO_PROCESSES.filter(
    (p) =>
      p.pid !== event.pid &&
      p.arrival <= index &&
      (event.remaining[String(p.pid)] ?? 0) > 0,
  ).map((p) => ({ pid: p.pid, remaining: event.remaining[String(p.pid)] }));
  return { running, ready };
}

/** Nine references, one per step of the fake run. */
export const REFERENCES = [7, 0, 1, 2, 0, 3, 0, 4, 2];

/** FIFO or Clock over `refs` with `frames` frames, as `FrameStrip` columns. */
export function frameColumns(
  refs: readonly number[],
  frames: number,
  mode: 'fifo' | 'clock',
): FrameColumn[] {
  const slots: (number | null)[] = Array.from({ length: frames }, () => null);
  const use: (0 | 1)[] = Array.from({ length: frames }, () => 0);
  let hand = 0;

  return refs.map((ref) => {
    const at = slots.indexOf(ref);
    if (at >= 0) {
      use[at] = 1;
      return mode === 'clock'
        ? { ref, frames: [...slots], fault: false, useBits: [...use], hand }
        : { ref, frames: [...slots], fault: false };
    }
    // FIFO's hand only ever moves on, which is the same as the oldest frame.
    if (mode === 'clock') {
      while (slots[hand] !== null && use[hand] === 1) {
        use[hand] = 0;
        hand = (hand + 1) % frames;
      }
    }
    const loaded = hand;
    const evicted = slots[loaded];
    slots[loaded] = ref;
    use[loaded] = 1;
    hand = (hand + 1) % frames;
    return {
      ref,
      frames: [...slots],
      fault: true,
      loaded,
      ...(evicted === null || evicted === undefined ? {} : { evicted }),
      ...(mode === 'clock' ? { useBits: [...use], hand } : {}),
    };
  });
}

export const ADDRESS_FIELDS = [
  { id: 'pd', name: 'PD index', bits: 10 },
  { id: 'pt', name: 'PT index', bits: 10 },
  { id: 'off', name: 'Offset', bits: 12 },
];

/** A different address per step, and the field that step is about. */
export function addressAt(index: number): { value: number; highlight: string } {
  return {
    value: 0x00403abc + index * 0x1010,
    highlight: ADDRESS_FIELDS[index % ADDRESS_FIELDS.length]!.id,
  };
}

export const RESOURCES = ['A', 'B', 'C'];
export const BANKER_PROCESSES = ['P0', 'P1', 'P2', 'P3', 'P4'];

/** OSC10's Banker's example (§8.6.3.3): Max, Allocation and Available. */
export const BANKER_MAX = [
  [7, 5, 3],
  [3, 2, 2],
  [9, 0, 2],
  [2, 2, 2],
  [4, 3, 3],
];
export const BANKER_ALLOCATION = [
  [0, 1, 0],
  [2, 0, 0],
  [3, 0, 2],
  [2, 1, 1],
  [0, 0, 2],
];
export const BANKER_AVAILABLE = [3, 3, 2];

export function need(max: number[][], allocation: number[][]): number[][] {
  return max.map((row, r) => row.map((v, c) => v - (allocation[r]?.[c] ?? 0)));
}

/** FCFS and Round Robin (q = 2, no switch cost) on the demo workload, worked by hand. */
export const COMPARE = {
  columns: [
    { id: 'fcfs', label: 'FCFS' },
    { id: 'rr', label: 'RR (q = 2)' },
  ],
  rows: [
    {
      id: 'wait',
      label: 'Avg waiting',
      values: [5 / 3, 8 / 3],
      better: 'lower' as const,
    },
    {
      id: 'tat',
      label: 'Avg turnaround',
      values: [14 / 3, 17 / 3],
      better: 'lower' as const,
    },
    {
      id: 'throughput',
      label: 'Throughput (per tick)',
      values: [3 / 9, 3 / 9],
      better: 'higher' as const,
    },
  ],
};

/** Per-process FCFS metrics: completion, turnaround, waiting. */
export const FCFS_PER_PROCESS = {
  columns: [
    { id: 'done', label: 'Completion' },
    { id: 'tat', label: 'Turnaround' },
    { id: 'wait', label: 'Waiting' },
  ],
  rows: [
    { id: 'p1', label: 'P1', values: [3, 3, 0] },
    { id: 'p2', label: 'P2', values: [5, 4, 2] },
    { id: 'p3', label: 'P3', values: [9, 7, 3] },
  ],
};

/** Faults for Belady's string 1 2 3 4 1 2 5 1 2 3 4 5, with 1 to 5 frames. */
export const BELADY = {
  x: [1, 2, 3, 4, 5],
  series: [
    { id: 'fifo', label: 'FIFO', values: [12, 12, 9, 10, 5] },
    { id: 'lru', label: 'LRU', values: [12, 12, 10, 8, 5] },
    { id: 'opt', label: 'OPT', values: [12, 9, 7, 6, 5] },
  ],
};

export const DEMO_RULES: Rule[] = [
  {
    id: 'demo.fcfs.order',
    text: 'FCFS runs processes in arrival order; a tie goes to the lower PID.',
  },
  {
    id: 'demo.metrics',
    text: 'Waiting time = turnaround − burst; turnaround = completion − arrival.',
    detail: 'The textbook definitions (OSTEP ch. 7). Response time is not shown here.',
  },
  {
    id: 'demo.fake',
    text: 'Everything on this page is hand-written test data, not an algorithm core.',
  },
];
